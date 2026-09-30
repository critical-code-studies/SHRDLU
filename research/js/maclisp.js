/*
 * maclisp.js - a MacLisp interpreter, to run SHRDLU in the browser from the
 * source of each version.
 *
 * It follows MacLisp as SHRDLU's files expect it, in two dialects:
 *   'old'  MacLisp 1.6 (1972): the MIT and Stanford files. " and # are
 *          letters; no backquote; (CAR sym) and (CDR sym) are allowed, CDR
 *          giving the property list, as the old interpreter did.
 *   'new'  the later MacLisp of Swenson's 2024 restoration: "strings",
 *          |symbols|, backquote, #/ characters, DEFMACRO, LET, IF and kin.
 * In both, variables are special (dynamically bound, shallow: a symbol's
 * value cell is its value), numbers are read in octal unless they end in a
 * point, and lower case reads as upper case.
 *
 * The evaluator keeps its own stack of frames instead of using JavaScript's:
 * it can stop at any step (to wait for the teletype, or to be stepped), and
 * SHRDLU's deep backtracking cannot overflow the browser's stack. Errors
 * unwind to the nearest ERRSET, as MacLisp's did; with none, the machine
 * halts with the error and its backtrace.
 *
 * Not in the machine: memory allocation (ALLOC is accepted and ignored),
 * compiled code (FASLOAD of SHRDLU's own files reads their source instead;
 * system libraries are supplied here), and the DEC 340 display, whose calls
 * go to a display object the page provides.
 */
(function (root) {
  'use strict';

  // ---------- data ----------
  var UNBOUND = { unbound: true };
  function Sym(name) { this.name = name; this.value = UNBOUND; this.plist = null; this.fgen = -1; this.fk = null; this.fd = null; }
  Sym.prototype.toString = function () { return this.name; };
  function Cons(a, d) { this.car = a; this.cdr = d; }
  function Flo(v) { this.v = v; }
  function Str(s) { this.s = s; }
  function Subr(name, kind, fn) { this.name = name; this.kind = kind; this.fn = fn; }
  function LispError(msg, obj, errValue) { this.msg = msg; this.obj = obj; this.errValue = errValue; }
  var NOVALUE = { novalue: true };   // a native pushed frames; its value comes later

  function isNum(x) { return typeof x === 'number' || x instanceof Flo; }
  function numVal(x) { return typeof x === 'number' ? x : x.v; }

  // ---------- the machine ----------
  function Machine(opts) {
    opts = opts || {};
    var m = this;
    m.dialect = opts.dialect || 'old';
    m.obarray = new Map();
    m.pgen = 0;
    m.NIL = m.intern('NIL'); m.NIL.value = m.NIL; m.NIL.plist = m.NIL;
    m.T = m.intern('T'); m.T.value = m.T;
    m.stack = []; m.floor = 0;
    m.v = m.NIL; m.x = null; m.pend = false;
    m.waiting = null;             // a function to call with the teletype's input
    m.halted = null;              // the error the machine stopped on
    m.steps = 0;
    m.out = opts.out || function () {};
    m.files = opts.files || {};   // the virtual DSK: name (upper case) -> text
    m.display = opts.display || null;
    m.skip = opts.skip || [];      // files the version does not hold, skipped by a recorded repair
    m.tty = '';                   // characters typed and not yet read
    m.col = 0;                    // the teletype's column
    m.gensymN = 0; m.gensymPrefix = 'G';
    m.readtable = {};             // character -> function (a Lisp function) for read macros
    m.inStack = [];               // UREAD files; the current input when ^Q is set
    m.loadIn = [];                // files being LOADed: the current input while their forms run
    m.lexpr = [];
    m.traced = {};
    m.onCall = null;              // hooks for the bench's tracer: onCall(sym, args), onReturn(sym, value)
    m.S = {};
    'QUOTE FUNCTION LAMBDA EXPR FEXPR MACRO SUBR FSUBR LSUBR ARRAY LINEL CHRCT ^Q ^W ^R ^D ^A BASE IBASE *NOPOINT ERRLIST *RSET OBARRAY READTABLE BACKQUOTE CONS LIST APPEND LIST* COMMENT DSK GENSYM PNAME &OPTIONAL &REST &BODY &AUX STRING'.split(' ').forEach(function (n) { m.S[n] = m.intern(n); });
    m.S.BASE.value = 8; m.S.IBASE.value = 8; m.S.OBARRAY.value = m.S.OBARRAY; m.S.LINEL.value = 79; m.S.CHRCT.value = 79; m.intern('PURE').value = m.NIL; m.S.READTABLE.value = m.S.READTABLE; m.S['*NOPOINT'].value = m.NIL;
    ['^Q', '^W', '^R', '^D', '^A', 'ERRLIST', '*RSET'].forEach(function (n) { m.S[n].value = m.NIL; });
    m.carOfAtom = new Sym('*CAR-OF-ATOM*');
    install(m);
  }
  var M = Machine.prototype;

  M.intern = function (name) {
    var s = this.obarray.get(name);
    if (!s) { s = new Sym(name); s.plist = this.NIL || null; this.obarray.set(name, s); }
    if (s.plist === null && this.NIL) s.plist = this.NIL;
    return s;
  };
  M.sym = function (name) { return this.intern(name); };
  M.list = function () { var r = this.NIL; for (var i = arguments.length - 1; i >= 0; i--) r = new Cons(arguments[i], r); return r; };
  M.fromArray = function (a, tail) { var r = tail || this.NIL; for (var i = a.length - 1; i >= 0; i--) r = new Cons(a[i], r); return r; };
  M.toArray = function (l) { var a = []; while (l instanceof Cons) { a.push(l.car); l = l.cdr; } return a; };
  M.truth = function (b) { return b ? this.T : this.NIL; };
  M.err = function (msg, obj) { throw new LispError(msg, obj); };

  // ---------- property lists ----------
  // A symbol's property list is its plist; a list's is its cdr (MacLisp's
  // "disembodied" property lists), so GET and PUTPROP work on both.
  M.plistOf = function (s) { return s instanceof Sym ? s.plist : s instanceof Cons ? s.cdr : this.NIL; };
  M.setPlist = function (s, pl) { if (s instanceof Sym) s.plist = pl; else s.cdr = pl; };
  M.get = function (s, ind) {
    if (!(s instanceof Sym) && !(s instanceof Cons)) return this.NIL;
    for (var p = this.plistOf(s); p instanceof Cons && p.cdr instanceof Cons; p = p.cdr.cdr) if (p.car === ind) return p.cdr.car;
    return this.NIL;
  };
  M.putprop = function (s, val, ind) {
    if (!(s instanceof Sym) && !(s instanceof Cons)) this.err('PUTPROP ON AN ATOM THAT IS NOT A SYMBOL', s);
    this.pgen++;
    for (var p = this.plistOf(s); p instanceof Cons && p.cdr instanceof Cons; p = p.cdr.cdr) if (p.car === ind) { p.cdr.car = val; return val; }
    this.setPlist(s, new Cons(ind, new Cons(val, this.plistOf(s))));
    return val;
  };
  M.remprop = function (s, ind) {
    if (!(s instanceof Sym) && !(s instanceof Cons)) return this.NIL;
    this.pgen++;
    var prev = null;
    for (var p = this.plistOf(s); p instanceof Cons && p.cdr instanceof Cons; prev = p.cdr, p = p.cdr.cdr) {
      if (p.car === ind) { if (prev) prev.cdr = p.cdr.cdr; else this.setPlist(s, p.cdr.cdr); return p.cdr; }
    }
    return this.NIL;
  };
  var FNKINDS = { EXPR: 1, FEXPR: 1, MACRO: 1, SUBR: 1, FSUBR: 1, LSUBR: 1 };
  // A symbol's function: the first functional property on its property list.
  M.fnOf = function (s) {
    if (s.fgen === this.pgen) return s.fk ? s : null;
    s.fgen = this.pgen; s.fk = null; s.fd = null;
    for (var p = s.plist; p instanceof Cons && p.cdr instanceof Cons; p = p.cdr.cdr) {
      if (p.car instanceof Sym && FNKINDS[p.car.name]) { s.fk = p.car.name; s.fd = p.cdr.car; break; }
    }
    return s.fk ? s : null;
  };

  // ---------- the stepping loop ----------
  M.ev = function (x) { this.x = x; this.pend = true; return NOVALUE; };
  M.ret = function (v) { this.v = v; this.pend = false; return NOVALUE; };

  // Run up to budget steps. Returns 'done' (the stack is back to where it
  // started), 'input' (waiting for the teletype), 'budget', or 'error'.
  M.run = function (budget) {
    var st = this.stack;
    for (;;) {
      try {
        while (budget-- > 0) {
          if (this.waiting) return 'input';
          if (this.halted) return 'error';
          this.steps++;
          if (this.pend) { this.pend = false; this.evalForm(this.x); }
          else {
            if (st.length <= this.floor) return 'done';
            var f = st.pop();
            f.k.call(this, f, this.v);
          }
        }
        return 'budget';
      } catch (e) {
        if (!(e instanceof LispError)) {
          if (e instanceof RangeError) e = new LispError('JAVASCRIPT STACK EXHAUSTED', null);
          else e = new LispError('INTERNAL: ' + (e && e.message || e), null);
        }
        if (this.signal(e) === 'halt') return 'error';
      }
    }
  };

  // An error: unwind to the nearest ERRSET (printing the message unless it
  // was given NIL), or halt. A barrier (a nested run) passes it outward.
  M.signal = function (e) {
    var st = this.stack;
    for (var i = st.length - 1; i >= this.floor; i--) {
      var f = st[i];
      if (f.barrier) { this.unwindTo(i + 1); throw e; }
      if (f.errset) {
        this.unwindTo(i + 1);
        st.pop();
        if (e.errValue === undefined && f.flag !== this.NIL) this.errorMessage(e);
        this.pend = false; this.v = e.errValue !== undefined ? e.errValue : this.NIL;
        return 'caught';
      }
    }
    this.halted = e;
    this.haltedStack = this.backtrace();
    if (e.errValue === undefined) this.errorMessage(e);
    this.unwindTo(this.floor);
    this.pend = false;
    return 'halt';
  };
  M.errorMessage = function (e) {
    this.terpriIfNeeded();
    this.print(';' + (e.obj !== undefined && e.obj !== null ? this.prin1String(e.obj) + ' ' : '') + e.msg + '\n');
  };
  M.unwindTo = function (n) {
    var st = this.stack;
    while (st.length > n) { var f = st.pop(); if (f.unwind) f.unwind.call(this, f); }
  };
  M.backtrace = function () {
    var out = [];
    for (var i = this.stack.length - 1; i >= 0 && out.length < 40; i--) {
      var f = this.stack[i];
      if (f.fnName) out.push(f.fnName);
    }
    return out;
  };

  // Call a Lisp function from native code and wait for its value (read
  // macros, SORT's predicate). The call runs on the same stack, above a barrier.
  M.callNested = function (fn, args) {
    var saveFloor = this.floor, savePend = this.pend, saveX = this.x, saveV = this.v;
    this.stack.push({ k: kBarrier, barrier: true });
    this.floor = this.stack.length;
    this.applyFn(fn, args);
    var budget = 5e7, r;
    try {
      for (;;) {
        r = this.run(budget);
        if (r === 'done') break;
        if (r === 'input') this.err('THE TELETYPE WAS READ INSIDE A READ MACRO');
        if (r === 'error') { var h = this.halted; this.halted = null; throw h; }
        if (r === 'budget') this.err('A READ MACRO RAN TOO LONG');
      }
    } finally {
      this.floor = saveFloor;
      if (this.stack.length && this.stack[this.stack.length - 1].barrier) this.stack.pop();
    }
    var v = this.v;
    this.pend = savePend; this.x = saveX; this.v = saveV;
    return v;
  };
  function kBarrier() {}

  // ---------- evaluation ----------
  M.evalForm = function (x) {
    if (x instanceof Sym) {
      var v = x.value;
      if (v === UNBOUND) this.err('UNBOUND VARIABLE', x);
      this.v = v; return;
    }
    if (!(x instanceof Cons)) { this.v = x; return; }
    var h = x.car;
    if (h instanceof Sym) {
      var s = this.fnOf(h);
      if (!s) {
        // MacLisp: a symbol with no function but a value uses its value as the function
        if (h.value !== UNBOUND && h.value !== this.NIL && !(h.value instanceof Sym && h.value === h)) { this.evalArgs(x, h.value, h); return; }
        this.err('UNDEFINED FUNCTION', h);
      }
      switch (s.fk) {
        case 'FSUBR': s.fd.fn.call(this, x.cdr, x); return;
        case 'SUBR': case 'LSUBR': case 'EXPR': this.evalArgs(x, s, h); return;
        case 'FEXPR': this.applyLambda(s.fd, [x.cdr], h); return;
        case 'MACRO': this.expandMacro(s.fd, x, h); return;
      }
    }
    if (h instanceof Cons && h.car === this.S.LAMBDA) { this.evalArgs(x, h, null); return; }
    if (h instanceof Cons) { this.stack.push({ k: kFnThenArgs, form: x }); this.ev(h); return; }
    this.err('BAD FUNCTION', h);
  };
  function kFnThenArgs(f, fn) { this.evalArgs(f.form, fn, null); }

  M.evalArgs = function (form, fn, name) {
    var rest = form.cdr;
    if (rest === this.NIL) { this.applyFn(fn, [], name); return; }
    this.stack.push({ k: kArgs, rest: rest.cdr, args: [], fn: fn, name: name });
    this.ev(rest.car);
  };
  function kArgs(f, v) {
    f.args.push(v);
    if (f.rest instanceof Cons) { var a = f.rest.car; f.rest = f.rest.cdr; this.stack.push(f); this.ev(a); return; }
    this.applyFn(f.fn, f.args, f.name);
  }

  // Apply a function (a symbol, a lambda expression, a native) to evaluated arguments.
  M.applyFn = function (fn, args, name) {
    if (fn instanceof Sym) {
      var s = this.fnOf(fn);
      if (!s) {
        if (fn.value !== UNBOUND && fn.value !== this.NIL && fn.value !== fn) return this.applyFn(fn.value, args, fn);
        this.err('UNDEFINED FUNCTION', fn);
      }
      name = fn;
      switch (s.fk) {
        case 'SUBR': case 'LSUBR': return this.callSubr(s.fd, args, fn);
        case 'EXPR': return this.applyLambda(s.fd, args, fn);
        case 'FEXPR': return this.applyLambda(s.fd, [this.fromArray(args)], fn);
        case 'FSUBR': return this.callFsubr(s.fd, this.fromArray(args), fn);
        case 'MACRO': this.err('A MACRO CANNOT BE APPLIED', fn);
      }
    }
    if (fn instanceof Subr) return this.callSubr(fn, args, name);
    if (fn instanceof Cons && fn.car === this.S.LAMBDA) return this.applyLambda(fn, args, name);
    if (fn instanceof Cons && fn.car === this.S.FUNCTION) return this.applyFn(fn.cdr.car, args, name);
    this.err('BAD FUNCTION', fn);
  };
  M.callSubr = function (sub, args, name) {
    if (this.onCall && name && this.traced[name.name]) this.traceCall(name, args);
    var r = sub.fn.call(this, args);
    if (r !== NOVALUE) { this.v = r; this.pend = false; }
  };
  // an FSUBR applied (APPLY 'COND ...): the arguments are its form's cdr, unevaluated
  M.callFsubr = function (sub, argList) { sub.fn.call(this, argList, new Cons(this.S.QUOTE, argList)); };

  // (LAMBDA params . body): bind params dynamically, run the body, unbind.
  M.applyLambda = function (lam, args, name) {
    if (!(lam instanceof Cons) || lam.car !== this.S.LAMBDA) {
      if (lam instanceof Subr) return this.callSubr(lam, args, name);
      this.err('BAD LAMBDA EXPRESSION', lam);
    }
    var params = lam.cdr.car, body = lam.cdr.cdr, b = [];
    if (name && this.traced[name.name]) this.traceCall(name, args);
    if (params instanceof Sym && params !== this.NIL) {
      // an LEXPR: the parameter is the number of arguments; ARG reads them
      b.push(params, params.value); params.value = args.length;
      this.lexpr.push(args);
      this.stack.push({ k: kUnbindLexpr, b: b, unwind: unbindLexpr, fnName: name ? name.name : 'LAMBDA', traced: name && this.traced[name.name] ? name : null });
    } else {
      var p = params, i = 0, opt = false;
      while (p instanceof Cons) {
        var s = p.car;
        if (s === this.S['&OPTIONAL']) { opt = true; p = p.cdr; continue; }
        if (s === this.S['&REST'] || s === this.S['&BODY']) { var rs = p.cdr.car; b.push(rs, rs.value); rs.value = this.fromArray(args.slice(i)); i = args.length; break; }
        var sym = s, dflt = null;
        if (s instanceof Cons) { sym = s.car; dflt = s.cdr instanceof Cons ? s.cdr.car : null; }
        if (i >= args.length && !opt) { this.unbindList(b); this.err('WRONG NUMBER OF ARGS', name || lam); }
        b.push(sym, sym.value);
        sym.value = i < args.length ? args[i] : (dflt === null ? this.NIL : this.evalNow(dflt));
        i++; p = p.cdr;
      }
      if (i < args.length) { this.unbindList(b); this.err('WRONG NUMBER OF ARGS', name || lam); }
      this.stack.push({ k: kUnbind, b: b, unwind: unbind, fnName: name ? name.name : 'LAMBDA', traced: name && this.traced[name.name] ? name : null });
    }
    this.progn(body);
  };
  M.unbindList = function (b) { for (var i = b.length - 2; i >= 0; i -= 2) b[i].value = b[i + 1]; };
  function unbind(f) { this.unbindList(f.b); }
  function kUnbind(f, v) { this.unbindList(f.b); if (f.traced) this.traceReturn(f.traced, v); this.ret(v); }
  function unbindLexpr(f) { this.unbindList(f.b); this.lexpr.pop(); }
  function kUnbindLexpr(f, v) { this.unbindList(f.b); this.lexpr.pop(); if (f.traced) this.traceReturn(f.traced, v); this.ret(v); }

  // A value computed at once, for the few places that need one synchronously
  // (a default for an &OPTIONAL parameter): a nested run.
  M.evalNow = function (x) {
    if (!(x instanceof Cons)) { if (x instanceof Sym) { if (x.value === UNBOUND) this.err('UNBOUND VARIABLE', x); return x.value; } return x; }
    if (x.car === this.S.QUOTE) return x.cdr.car;
    return this.callNested(this.list(this.S.LAMBDA, this.NIL, x), []);
  };

  M.progn = function (body) {
    if (!(body instanceof Cons)) { this.ret(this.NIL); return; }
    if (body.cdr instanceof Cons) this.stack.push({ k: kProgn, rest: body.cdr });
    this.ev(body.car);
  };
  function kProgn(f) {
    var r = f.rest;
    if (r.cdr instanceof Cons) { f.rest = r.cdr; this.stack.push(f); }
    this.ev(r.car);
  }

  M.expandMacro = function (def, form) {
    this.stack.push({ k: kAfterMacro });
    this.applyFn(def, [form]);
  };
  function kAfterMacro(f, expansion) { this.ev(expansion); }

  // tracing (TRACE, and the bench's call panel)
  M.traceCall = function (name, args) {
    if (this.onCall) this.onCall(name, args);
    else { this.terpriIfNeeded(); this.print('(' + this.stack.length + ' ENTER ' + name.name + ' ' + args.map(this.prin1String, this).join(' ') + ')\n'); }
  };
  M.traceReturn = function (name, v) {
    if (this.onReturn) this.onReturn(name, v);
    else { this.terpriIfNeeded(); this.print('(' + this.stack.length + ' EXIT ' + name.name + ' ' + this.prin1String(v) + ')\n'); }
  };

  // ---------- the teletype and output ----------
  M.print = function (s) {
    if (!s) return;
    if (this.S['^W'].value !== this.NIL) return;
    this.out(s);
    var nl = s.lastIndexOf('\n');
    this.col = nl >= 0 ? s.length - nl - 1 : this.col + s.length;
    // MacLisp 1.6 keeps the line's remaining room in the variable CHRCT
    var linel = typeof this.S.LINEL.value === 'number' ? this.S.LINEL.value : 79;
    this.S.CHRCT.value = Math.max(0, linel - this.col);
  };
  M.terpriIfNeeded = function () { if (this.col) this.print('\n'); };
  // Characters from the user. The machine, if waiting, continues.
  M.type = function (text) {
    this.tty += text.replace(/\r\n?|\n/g, '\r');
    if (this.waiting) { var w = this.waiting; this.waiting = null; w.call(this); }
  };
  // Wait for the teletype: retry is called (with the machine as this) when characters come.
  M.waitTTY = function (retry) { this.waiting = retry; return NOVALUE; };

  // the current input: a file read with UREAD while ^Q is set, else the teletype
  M.fileInput = function () {
    if (this.loadIn.length) return { st: this.loadIn[this.loadIn.length - 1], loading: true };
    return this.S['^Q'].value !== this.NIL && this.inStack.length ? this.inStack[this.inStack.length - 1] : null;
  };

  // ---------- the reader ----------
  function Stream(text, name) { this.text = text; this.pos = 0; this.name = name || ''; }
  Stream.prototype.peek = function () { return this.pos < this.text.length ? this.text[this.pos] : null; };
  Stream.prototype.next = function () { return this.pos < this.text.length ? this.text[this.pos++] : null; };
  M.Stream = Stream;

  var WHITE = { ' ': 1, '\t': 1, '\n': 1, '\r': 1, '\f': 1, '\v': 1, '\u0003': 1, '\u0000': 1 };
  M.isDelim = function (c) {
    if (c === null || WHITE[c] || c === '(' || c === ')' || c === "'" || c === ';') return true;
    if (this.dialect === 'new' && (c === '"' || c === '`' || c === ',' || c === '|')) return true;
    return false;   // read macros (Micro-Planner's $) act at the start of a token only: *$ is a name
  };
  // Read one object from a stream. EOF: returns eofValue, or signals.
  M.readFrom = function (st, eofValue) {
    for (;;) {
      var c = st.peek();
      if (c === null) { if (eofValue !== undefined) return eofValue; this.err('END OF FILE WITHIN READ'); }
      if (WHITE[c] || c === ')') { st.next(); continue; }   // a stray closing parenthesis at top level is read as nothing
      if (c === ';') { while (st.peek() !== null && st.peek() !== '\n') st.next(); continue; }
      break;
    }
    return this.readObj(st);
  };
  M.readObj = function (st) {
    var c = st.next();
    if (c === '(') return this.readList(st);
    if (c === ')') return this.readObj(st);   // a stray closing parenthesis is read as nothing
    if (c === "'") return this.list(this.S.QUOTE, this.readFrom(st));
    if (this.readtable[c]) {
      var saveIn = this.curReadStream; this.curReadStream = st;
      try { return this.callNested(this.readtable[c], []); } finally { this.curReadStream = saveIn; }
    }
    if (this.dialect === 'new') {
      if (c === '`') return this.backquote(this.readFrom(st));
      if (c === ',') {
        if (st.peek() === '@') { st.next(); return this.list(this.sym('*COMMA-AT*'), this.readFrom(st)); }
        if (st.peek() === '.') { st.next(); return this.list(this.sym('*COMMA-AT*'), this.readFrom(st)); }
        return this.list(this.sym('*COMMA*'), this.readFrom(st));
      }
      if (c === '"') { var s = ''; while (st.peek() !== null && st.peek() !== '"') { var ch = st.next(); if (ch === '/' || ch === '\\') ch = st.next(); s += ch; } st.next(); return new Str(s); }
      if (c === '|') { var n = ''; while (st.peek() !== null && st.peek() !== '|') { var q = st.next(); if (q === '/') q = st.next(); n += q; } st.next(); return this.intern(n); }
      if (c === '#') return this.readSharp(st);
    }
    st.pos--;
    return this.readAtom(st);
  };
  M.readList = function (st) {
    var items = [], tail = this.NIL;
    for (;;) {
      var c = st.peek();
      if (c === null) this.err('END OF FILE WITHIN A LIST');
      if (WHITE[c]) { st.next(); continue; }
      if (c === ';') { while (st.peek() !== null && st.peek() !== '\n') st.next(); continue; }
      if (c === ')') { st.next(); break; }
      if (c === '.' && items.length && this.isDelim(st.text[st.pos + 1] === undefined ? null : st.text[st.pos + 1])) {
        st.next(); tail = this.readFrom(st);
        for (;;) { var d = st.next(); if (d === ')' || d === null) break; }
        break;
      }
      items.push(this.readFrom(st));
    }
    return this.fromArray(items, tail);
  };
  M.readAtom = function (st) {
    var name = '', slashed = false;
    for (;;) {
      var c = st.peek();
      if (c === null || this.isDelim(c)) break;
      st.next();
      if (c === '/') { var e = st.next(); if (e !== null) { name += e; slashed = true; } continue; }
      name += c;
    }
    if (!slashed) {
      var n = this.parseNumber(name);
      if (n !== null) return n;
      return this.intern(name.toUpperCase());
    }
    return this.intern(this.upcaseUnslashed(st, name));
  };
  // A name with slashes: its slashed characters keep their case. (Re-read the
  // raw text so that "I/'M" becomes I'M with the escaped quote kept.)
  M.upcaseUnslashed = function (st, name) {
    var end = st.pos, i = end, raw;
    // walk back over the atom's raw text
    var n = 0, j = end - 1, out = [];
    while (j >= 0 && n < name.length) {
      var ch = st.text[j];
      if (j > 0 && st.text[j - 1] === '/' && !(j > 1 && st.text[j - 2] === '/')) { out.unshift(ch); j -= 2; n++; continue; }
      out.unshift(ch.toUpperCase()); j--; n++;
    }
    void i; void raw;
    return out.join('');
  };
  M.parseNumber = function (t) {
    if (/^[+-]?\d+\.$/.test(t)) return parseInt(t.slice(0, -1), 10);
    if (/^[+-]?\d+$/.test(t)) {
      var base = typeof this.S.IBASE.value === 'number' ? this.S.IBASE.value : 8;
      if (base === 8 && /[89]/.test(t)) return parseInt(t, 10);
      return parseInt(t, base);
    }
    if (/^[+-]?\d*\.\d+([eE][+-]?\d+)?$/.test(t) || /^[+-]?\d+\.?\d*[eE][+-]?\d+$/.test(t)) return new Flo(parseFloat(t));
    return null;
  };
  M.readSharp = function (st) {
    var c = st.next();
    if (c === '/') return st.next().charCodeAt(0);
    if (c === "'") return this.list(this.S.FUNCTION, this.readFrom(st));
    if (c === 'o' || c === 'O') { var a = this.readAtom(st); return parseInt(a.name || String(a), 8); }
    if (c === '+' || c === '-') { var feat = this.readFrom(st), form = this.readFrom(st); void feat; return c === '+' ? this.readFrom(new Stream('NIL')) : form; }
    st.pos--;
    var s = this.readAtom(st);
    return this.intern('#' + (s.name || String(s)));
  };
  // backquote, expanded as it is read into CONS, LIST and APPEND
  M.backquote = function (x) {
    var COMMA = this.sym('*COMMA*'), AT = this.sym('*COMMA-AT*');
    if (!(x instanceof Cons)) return x instanceof Sym && x !== this.NIL && x !== this.T ? this.list(this.S.QUOTE, x) : x;
    if (x.car === COMMA) return x.cdr.car;
    if (x.car === AT) this.err(',@ AFTER ` WITH NOTHING TO SPLICE INTO');
    var parts = [], p = x;
    while (p instanceof Cons) {
      if (p.car === COMMA) { parts.push(this.list(this.S.LIST, p.cdr.car)); p = this.NIL; break; }
      var e = p.car;
      if (e instanceof Cons && e.car === AT) parts.push(e.cdr.car);
      else parts.push(this.list(this.S.LIST, this.backquote(e)));
      p = p.cdr;
    }
    if (p !== this.NIL) parts.push(this.list(this.S.QUOTE, p));
    return this.fromArray([this.S.APPEND].concat(parts));
  };

  // ---------- the printer ----------
  M.numString = function (n) {
    if (n instanceof Flo) { var s = String(n.v); if (!/[.e]/.test(s)) s += '.0'; return s; }
    var base = typeof this.S.BASE.value === 'number' ? this.S.BASE.value : 8;
    var t = (n < 0 ? '-' : '') + Math.abs(n).toString(base).toUpperCase();
    if (base === 10 && this.S['*NOPOINT'].value === this.NIL) t += '.';
    return t;
  };
  M.symString = function (s, slash) {
    var n = s.name;
    if (!slash) return n;
    var out = '';
    for (var i = 0; i < n.length; i++) {
      var c = n[i];
      if (c === '(' || c === ')' || c === "'" || c === ';' || c === '/' || WHITE[c] || (c >= 'a' && c <= 'z') || (this.dialect === 'new' && (c === '"' || c === '|' || c === '`' || c === ','))) out += '/';
      out += c;
    }
    if (!out) return '||';
    if (this.parseNumber(n) !== null) out = '/' + out;
    return out;
  };
  M.toStr = function (x, slash, depth) {
    depth = depth || 0;
    if (depth > 200) return '...';
    if (x instanceof Sym) return this.symString(x, slash);
    if (typeof x === 'number' || x instanceof Flo) return this.numString(x);
    if (x instanceof Str) return slash ? '"' + x.s + '"' : x.s;
    if (x instanceof Subr) return '#<' + x.kind + ' ' + x.name + '>';
    if (x === UNBOUND) return '#<UNBOUND>';
    if (x instanceof Cons) {
      if (x.car === this.S.QUOTE && x.cdr instanceof Cons && x.cdr.cdr === this.NIL) return "'" + this.toStr(x.cdr.car, slash, depth + 1);
      var parts = [], p = x, n = 0;
      while (p instanceof Cons && n++ < 2000) { parts.push(this.toStr(p.car, slash, depth + 1)); p = p.cdr; }
      return '(' + parts.join(' ') + (p !== this.NIL ? ' . ' + this.toStr(p, slash, depth + 1) : '') + ')';
    }
    return String(x);
  };
  M.prin1String = function (x) { return this.toStr(x, true); };
  M.princString = function (x) { return this.toStr(x, false); };

  // ---------- loading source files ----------
  // A file named by a MacLisp file spec: (NAME VERSION DEV DIR), (NAME > DSK SHRDLU),
  // ((DIR) NAME EXT), or a symbol. Returns the text, or null.
  M.fileName = function (spec) {
    if (spec instanceof Sym) return spec.name;
    if (spec instanceof Str) return spec.s.split(/[;\s]/).filter(Boolean).pop();
    var a = this.toArray(spec);
    if (a[0] instanceof Cons) return a[1] instanceof Sym ? a[1].name + (a[2] instanceof Sym && !/^(FASL|>)$/.test(a[2].name) ? ' ' + a[2].name : '') : null;
    return a[0] instanceof Sym ? a[0].name : null;
  };
  M.findFile = function (spec) {
    var name = this.fileName(spec);
    if (!name) return null;
    var key = name.toUpperCase();
    if (this.files[key] != null) return { name: key, text: this.files[key] };
    var base = key.split(' ')[0];
    if (this.files[base] != null) return { name: base, text: this.files[base] };
    return null;
  };
  // Read and evaluate a file's forms one after another, on the machine's stack.
  M.loadText = function (text, name) {
    var st = new Stream(text, name);
    this.stack.push({ k: kLoadNext, st: st, name: name, fnName: 'LOAD ' + name });
    this.ret(this.T);
  };
  var EOF = { eof: true };
  function kLoadNext(f) {
    var saveIn = this.loading; this.loading = f.name;
    var x;
    try { x = this.readFrom(f.st, EOF); } finally { this.loading = saveIn; }
    if (x === EOF) { this.ret(this.T); return; }
    this.stack.push(f);
    // while the form runs, the file is the current input: a READ inside it
    // (Micro-Planner's THDATA) reads the file's next forms
    this.loadIn.push(f.st);
    this.stack.push({ k: kLoadFormDone, unwind: popLoadIn });
    this.ev(x);
  }
  function popLoadIn() { this.loadIn.pop(); }
  function kLoadFormDone(f, v) { this.loadIn.pop(); this.ret(v); }

  // ---------- the primitives ----------
  function install(m) {
    var NIL = m.NIL, T = m.T;
    function def(names, kind, fn) { names.split(' ').forEach(function (n) { var s = m.intern(n); m.putprop(s, new Subr(n, kind, fn), m.intern(kind)); }); }
    function subr(names, fn) { def(names, 'SUBR', fn); }
    function lsubr(names, fn) { def(names, 'LSUBR', fn); }
    function fsubr(names, fn) { def(names, 'FSUBR', fn); }
    var tr = function (b) { return b ? T : NIL; };
    function car(x) {
      if (x instanceof Cons) return x.car;
      if (x === NIL) return NIL;
      if (x instanceof Sym && m.dialect === 'old') return m.carOfAtom;
      m.err('CAR OF A NON-LIST', x);
    }
    function cdr(x) {
      if (x instanceof Cons) return x.cdr;
      if (x === NIL) return NIL;
      if (x instanceof Sym && m.dialect === 'old') return x.plist;
      m.err('CDR OF A NON-LIST', x);
    }
    m.car = car; m.cdr = cdr;
    // c[ad]+r up to four letters
    ['a', 'd'].forEach(function (a) { ['', 'a', 'd'].forEach(function (b) { ['', 'a', 'd'].forEach(function (c) { ['', 'a', 'd'].forEach(function (d) {
      var ops = (a + b + c + d);
      if ((b === '' && (c !== '' || d !== '')) || (c === '' && d !== '')) return;
      var chain = ops.split('').reverse();
      subr('C' + ops.toUpperCase() + 'R', function (args) { var x = args[0]; for (var i = 0; i < chain.length; i++) x = chain[i] === 'a' ? car(x) : cdr(x); return x; });
    }); }); }); });
    subr('CONS', function (a) { return new Cons(a[0], a[1]); });
    subr('NCONS', function (a) { return new Cons(a[0], NIL); });
    subr('XCONS', function (a) { return new Cons(a[1], a[0]); });
    lsubr('LIST', function (a) { return m.fromArray(a); });
    lsubr('LIST*', function (a) { return m.fromArray(a.slice(0, -1), a[a.length - 1]); });
    subr('RPLACA', function (a) { if (a[0] instanceof Cons) { a[0].car = a[1]; return a[0]; } m.err('RPLACA OF A NON-LIST', a[0]); });
    subr('RPLACD', function (a) {
      if (a[0] instanceof Cons) { a[0].cdr = a[1]; return a[0]; }
      if (a[0] instanceof Sym && m.dialect === 'old') { a[0].plist = a[1]; m.pgen++; return a[0]; }
      m.err('RPLACD OF A NON-LIST', a[0]);
    });
    function append2(x, y) { var a = m.toArray(x); return m.fromArray(a, y); }
    lsubr('APPEND', function (a) { if (!a.length) return NIL; var r = a[a.length - 1]; for (var i = a.length - 2; i >= 0; i--) r = append2(a[i], r); return r; });
    lsubr('NCONC', function (a) {
      var r = NIL, last = null;
      a.forEach(function (x) { if (x === NIL) return; if (last) last.cdr = x; else r = x; if (x instanceof Cons) { last = x; while (last.cdr instanceof Cons) last = last.cdr; } });
      return r;
    });
    subr('REVERSE', function (a) { var r = NIL; for (var p = a[0]; p instanceof Cons; p = p.cdr) r = new Cons(p.car, r); return r; });
    subr('NREVERSE', function (a) { var r = NIL, p = a[0]; while (p instanceof Cons) { var n = p.cdr; p.cdr = r; r = p; p = n; } return r; });
    subr('NRECONC', function (a) { var r = a[1], p = a[0]; while (p instanceof Cons) { var n = p.cdr; p.cdr = r; r = p; p = n; } return r; });
    subr('RECONC', function (a) { var r = a[1]; for (var p = a[0]; p instanceof Cons; p = p.cdr) r = new Cons(p.car, r); return r; });
    subr('LENGTH', function (a) { var n = 0; for (var p = a[0]; p instanceof Cons; p = p.cdr) n++; return n; });
    subr('LAST', function (a) { var p = a[0]; if (!(p instanceof Cons)) return p; while (p.cdr instanceof Cons) p = p.cdr; return p; });
    subr('NTH', function (a) { var p = a[1]; for (var i = 0; i < a[0] && p instanceof Cons; i++) p = p.cdr; return p instanceof Cons ? p.car : NIL; });
    subr('NTHCDR', function (a) { var p = a[1]; for (var i = 0; i < a[0] && p instanceof Cons; i++) p = p.cdr; return p; });
    function equal(x, y) {
      for (;;) {
        if (x === y) return true;
        if (typeof x === 'number' || x instanceof Flo) return isNum(y) && numVal(x) === numVal(y) && (typeof x === typeof y);
        if (x instanceof Str) return y instanceof Str && x.s === y.s;
        if (!(x instanceof Cons) || !(y instanceof Cons)) return false;
        if (!equal(x.car, y.car)) return false;
        x = x.cdr; y = y.cdr;
      }
    }
    m.equal = equal;
    function eq(x, y) { return x === y || (typeof x === 'number' && typeof y === 'number' && x === y); }
    subr('EQ', function (a) { return tr(eq(a[0], a[1])); });
    subr('EQUAL', function (a) { return tr(equal(a[0], a[1])); });
    subr('ATOM', function (a) { return tr(!(a[0] instanceof Cons)); });
    subr('NULL NOT', function (a) { return tr(a[0] === NIL); });
    subr('NUMBERP', function (a) { return tr(isNum(a[0])); });
    subr('FIXP', function (a) { return tr(typeof a[0] === 'number'); });
    subr('FLOATP', function (a) { return tr(a[0] instanceof Flo); });
    subr('SYMBOLP', function (a) { return tr(a[0] instanceof Sym); });
    subr('STRINGP', function (a) { return tr(a[0] instanceof Str); });
    subr('LISTP', function (a) { return tr(a[0] instanceof Cons || a[0] === NIL); });
    subr('PAIRP', function (a) { return tr(a[0] instanceof Cons); });
    subr('BOUNDP', function (a) { return tr(a[0] instanceof Sym && a[0].value !== UNBOUND); });
    subr('MEMQ', function (a) { for (var p = a[1]; p instanceof Cons; p = p.cdr) if (eq(a[0], p.car)) return p; return NIL; });
    subr('MEMBER', function (a) { for (var p = a[1]; p instanceof Cons; p = p.cdr) if (equal(a[0], p.car)) return p; return NIL; });
    subr('ASSQ', function (a) { for (var p = a[1]; p instanceof Cons; p = p.cdr) if (p.car instanceof Cons && eq(a[0], p.car.car)) return p.car; return NIL; });
    subr('ASSOC', function (a) { for (var p = a[1]; p instanceof Cons; p = p.cdr) if (p.car instanceof Cons && equal(a[0], p.car.car)) return p.car; return NIL; });
    function sass(test) {
      return function (a) {
        for (var p = a[1]; p instanceof Cons; p = p.cdr) if (p.car instanceof Cons && test(a[0], p.car.car)) return p.car;
        m.applyFn(a[2], []); return NOVALUE;
      };
    }
    subr('SASSQ', sass(eq)); subr('SASSOC', sass(equal));
    function del(test) {
      return function (a) {
        var head = new Cons(NIL, a[1]), prev = head, n = a.length > 2 ? a[2] : Infinity;
        for (var p = a[1]; p instanceof Cons; p = p.cdr) { if (n > 0 && test(a[0], p.car)) { prev.cdr = p.cdr; n--; } else prev = p; }
        return head.cdr;
      };
    }
    lsubr('DELQ', del(eq)); lsubr('DELETE', del(equal));
    subr('SUBST', function (a) { function s(x) { if (equal(x, a[1])) return a[0]; if (x instanceof Cons) return new Cons(s(x.car), s(x.cdr)); return x; } return s(a[2]); });
    subr('SUBLIS', function (a) {
      var al = m.toArray(a[0]);
      function s(x) { if (x instanceof Sym) { for (var i = 0; i < al.length; i++) if (al[i].car === x) return al[i].cdr; return x; } if (x instanceof Cons) return new Cons(s(x.car), s(x.cdr)); return x; }
      return s(a[1]);
    });
    subr('COPY', function (a) { function c(x) { return x instanceof Cons ? new Cons(c(x.car), c(x.cdr)) : x; } return c(a[0]); });

    // property lists
    subr('GET', function (a) { return m.get(a[0], a[1]); });
    subr('PUTPROP', function (a) { return m.putprop(a[0], a[1], a[2]); });
    subr('REMPROP', function (a) { return m.remprop(a[0], a[1]); });
    subr('PLIST', function (a) { return a[0] instanceof Sym ? a[0].plist : NIL; });
    subr('SETPLIST', function (a) { a[0].plist = a[1]; m.pgen++; return a[1]; });
    subr('GETL', function (a) {
      if (!(a[0] instanceof Sym) && !(a[0] instanceof Cons)) return NIL;
      var inds = m.toArray(a[1]);
      for (var p = m.plistOf(a[0]); p instanceof Cons && p.cdr instanceof Cons; p = p.cdr.cdr) if (inds.indexOf(p.car) >= 0) return p;
      return NIL;
    });
    fsubr('DEFPROP', function (args) { m.ret(m.putprop(args.car, args.cdr.car, args.cdr.cdr.car)); });

    // symbols
    subr('SET', function (a) { if (!(a[0] instanceof Sym) || a[0] === NIL || a[0] === T) m.err('CANNOT SET', a[0]); a[0].value = a[1]; return a[1]; });
    subr('SYMEVAL', function (a) { if (a[0].value === UNBOUND) m.err('UNBOUND VARIABLE', a[0]); return a[0].value; });
    subr('MAKUNBOUND', function (a) { a[0].value = UNBOUND; return a[0]; });
    subr('INTERN', function (a) { if (a[0] instanceof Sym) { var s = m.obarray.get(a[0].name); if (s) return s; m.obarray.set(a[0].name, a[0]); return a[0]; } return m.intern(String(a[0].s || a[0])); });
    subr('REMOB', function (a) { m.obarray.delete(a[0].name); return a[0]; });
    lsubr('GENSYM', function (a) {
      if (a.length && a[0] instanceof Sym) m.gensymPrefix = a[0].name.charAt(0);
      else if (a.length && typeof a[0] === 'number') m.gensymN = a[0];
      m.gensymN++;
      var s = new Sym(m.gensymPrefix + ('000' + m.gensymN).slice(-4)); s.plist = NIL;
      return s;
    });
    function pname(x) { return x instanceof Sym ? x.name : x instanceof Str ? x.s : m.princString(x); }
    function charSym(ch) { return m.intern(ch); }
    subr('EXPLODE', function (a) { return m.fromArray(m.prin1String(a[0]).split('').map(charSym)); });
    subr('EXPLODEC', function (a) { return m.fromArray(m.princString(a[0]).split('').map(charSym)); });
    subr('EXPLODEN', function (a) { return m.fromArray(m.princString(a[0]).split('').map(function (c) { return c.charCodeAt(0); })); });
    function charsOf(l) { return m.toArray(l).map(function (c) { return typeof c === 'number' ? String.fromCharCode(c) : pname(c).charAt(0); }).join(''); }
    subr('MAKNAM', function (a) { var s = new Sym(charsOf(a[0])); s.plist = NIL; return s; });
    subr('IMPLODE', function (a) { return m.intern(charsOf(a[0])); });
    subr('READLIST', function (a) { return m.readFrom(new Stream(charsOf(a[0]) + ' ')); });
    subr('FLATSIZE', function (a) { return m.prin1String(a[0]).length; });
    subr('FLATC', function (a) { return m.princString(a[0]).length; });
    subr('ASCII', function (a) { return charSym(String.fromCharCode(a[0])); });
    subr('GETCHAR', function (a) { var s = pname(a[0]), i = a[1]; return i >= 1 && i <= s.length ? charSym(s.charAt(i - 1)) : NIL; });
    subr('GETCHARN', function (a) { var s = pname(a[0]), i = a[1]; return i >= 1 && i <= s.length ? s.charCodeAt(i - 1) : 0; });
    subr('PNGET', function (a) { return m.fromArray([pname(a[0])].map(charSym)); });
    subr('SAMEPNAMEP', function (a) { return tr(pname(a[0]) === pname(a[1])); });
    subr('ALPHALESSP', function (a) { return tr(pname(a[0]) < pname(a[1])); });

    // numbers
    function arith(name, op, init, fixonly) {
      lsubr(name, function (a) {
        if (!a.length) return init;
        var flo = false, r = null;
        for (var i = 0; i < a.length; i++) {
          if (!isNum(a[i])) m.err('NON-NUMERIC ARGUMENT', a[i]);
          if (a[i] instanceof Flo) flo = true;
          var v = numVal(a[i]);
          r = r === null ? (a.length === 1 && (name === 'DIFFERENCE' || name === '-' || name === '-$') ? op(0, v) : v) : op(r, v, flo);
        }
        if (fixonly || !flo) return Math.trunc(r);
        return new Flo(r);
      });
    }
    arith('PLUS', function (x, y) { return x + y; }, 0);
    arith('+', function (x, y) { return x + y; }, 0, true);
    arith('+$', function (x, y) { return x + y; }, 0);
    arith('DIFFERENCE', function (x, y) { return x - y; }, 0);
    arith('-', function (x, y) { return x - y; }, 0, true);
    arith('-$', function (x, y) { return x - y; }, 0);
    arith('TIMES', function (x, y) { return x * y; }, 1);
    arith('*', function (x, y) { return x * y; }, 1, true);
    arith('*$', function (x, y) { return x * y; }, 1);
    arith('QUOTIENT', function (x, y, flo) { if (y === 0) m.err('DIVISION BY ZERO'); return flo ? x / y : Math.trunc(x / y); }, 1);
    // the fixnum and flonum quotients are the symbols / and /$ (written // and //$, / being the escape)
    arith('/', function (x, y) { if (y === 0) m.err('DIVISION BY ZERO'); return Math.trunc(x / y); }, 1, true);
    arith('/$', function (x, y) { return x / y; }, 1);
    subr('*DIF', function (a) { var r = numVal(a[0]) - numVal(a[1]); return a[0] instanceof Flo || a[1] instanceof Flo ? new Flo(r) : r; });
    subr('*PLUS', function (a) { var r = numVal(a[0]) + numVal(a[1]); return a[0] instanceof Flo || a[1] instanceof Flo ? new Flo(r) : r; });
    subr('*QUO', function (a) { var r = numVal(a[0]) / numVal(a[1]); return a[0] instanceof Flo || a[1] instanceof Flo ? new Flo(r) : Math.trunc(r); });
    subr('ADD1 1+', function (a) { return a[0] instanceof Flo ? new Flo(a[0].v + 1) : a[0] + 1; });
    subr('SUB1 1-', function (a) { return a[0] instanceof Flo ? new Flo(a[0].v - 1) : a[0] - 1; });
    subr('1+$', function (a) { return new Flo(numVal(a[0]) + 1); });
    subr('1-$', function (a) { return new Flo(numVal(a[0]) - 1); });
    subr('MINUS', function (a) { return a[0] instanceof Flo ? new Flo(-a[0].v) : -a[0]; });
    subr('ABS', function (a) { return a[0] instanceof Flo ? new Flo(Math.abs(a[0].v)) : Math.abs(a[0]); });
    subr('REMAINDER \\', function (a) { return numVal(a[0]) % numVal(a[1]); });
    lsubr('MAX', function (a) { var r = a[0]; a.forEach(function (x) { if (numVal(x) > numVal(r)) r = x; }); return r; });
    lsubr('MIN', function (a) { var r = a[0]; a.forEach(function (x) { if (numVal(x) < numVal(r)) r = x; }); return r; });
    subr('FIX', function (a) { return Math.floor(numVal(a[0])); });
    subr('IFIX', function (a) { return Math.trunc(numVal(a[0])); });
    subr('FLOAT', function (a) { return new Flo(numVal(a[0])); });
    subr('SQRT', function (a) { return new Flo(Math.sqrt(numVal(a[0]))); });
    subr('SIN', function (a) { return new Flo(Math.sin(numVal(a[0]))); });
    subr('COS', function (a) { return new Flo(Math.cos(numVal(a[0]))); });
    subr('ATAN', function (a) { return new Flo(Math.atan2(numVal(a[0]), numVal(a[1]))); });
    subr('EXPT', function (a) { var r = Math.pow(numVal(a[0]), numVal(a[1])); return a[0] instanceof Flo || a[1] instanceof Flo ? new Flo(r) : r; });
    function cmp(name, test) {
      lsubr(name, function (a) { for (var i = 0; i + 1 < a.length; i++) if (!test(numVal(a[i]), numVal(a[i + 1]))) return NIL; return T; });
    }
    cmp('GREATERP', function (x, y) { return x > y; }); cmp('>', function (x, y) { return x > y; }); cmp('>$', function (x, y) { return x > y; });
    cmp('LESSP', function (x, y) { return x < y; }); cmp('<', function (x, y) { return x < y; }); cmp('<$', function (x, y) { return x < y; });
    cmp('=', function (x, y) { return x === y; });
    subr('ZEROP', function (a) { return tr(numVal(a[0]) === 0); });
    subr('MINUSP', function (a) { return tr(numVal(a[0]) < 0); });
    subr('PLUSP', function (a) { return tr(numVal(a[0]) > 0); });
    subr('ODDP', function (a) { return tr(Math.abs(a[0]) % 2 === 1); });
    subr('EVENP', function (a) { return tr(a[0] % 2 === 0); });
    lsubr('BOOLE', function (a) {
      var op = a[0], r = a[1];
      for (var i = 2; i < a.length; i++) {
        var x = r, y = a[i];
        switch (op) { case 1: r = x & y; break; case 7: r = x | y; break; case 6: r = x ^ y; break; case 2: r = ~x & y; break; case 4: r = x & ~y; break; default: r = x; }
      }
      return r;
    });
    subr('LSH', function (a) { return a[1] >= 0 ? a[0] << a[1] : a[0] >>> -a[1]; });
    subr('ASH', function (a) { return a[1] >= 0 ? a[0] * Math.pow(2, a[1]) : Math.floor(a[0] / Math.pow(2, -a[1])); });
    // RANDOM: a fixed, seeded generator, so that a run can be repeated exactly
    m.seed = 1972;
    lsubr('RANDOM', function (a) {
      m.seed = (m.seed * 1103515245 + 12345) & 0x7fffffff;
      if (a.length && typeof a[0] === 'number' && a[0] > 0) return m.seed % a[0];
      return m.seed;
    });

    // ---------- special forms ----------
    fsubr('QUOTE', function (args) { m.ret(args.car); });
    fsubr('FUNCTION', function (args) { m.ret(args.car); });
    fsubr('COMMENT', function () { m.ret(m.S.COMMENT); });
    fsubr('DECLARE', function () { m.ret(NIL); });
    fsubr('SETQ', function (args) {
      if (args === NIL) { m.ret(NIL); return; }
      m.stack.push({ k: kSetq, rest: args });
      m.ev(args.cdr.car);
    });
    function kSetq(f, v) {
      var s = f.rest.car;
      if (!(s instanceof Sym) || s === NIL || s === T) m.err('CANNOT SETQ', s);
      s.value = v;
      var r = f.rest.cdr.cdr;
      if (r instanceof Cons) { f.rest = r; m.stack.push(f); m.ev(r.cdr.car); return; }
      m.ret(v);
    }
    fsubr('COND', function (args) { condNext(args); });
    function condNext(clauses) {
      if (!(clauses instanceof Cons)) { m.ret(NIL); return; }
      m.stack.push({ k: kCond, clause: clauses.car, rest: clauses.cdr });
      m.ev(clauses.car.car);
    }
    function kCond(f, v) {
      if (v !== NIL) { if (f.clause.cdr instanceof Cons) m.progn(f.clause.cdr); else m.ret(v); return; }
      condNext(f.rest);
    }
    fsubr('AND', function (args) { if (args === NIL) { m.ret(T); return; } andOr(args, true); });
    fsubr('OR', function (args) { if (args === NIL) { m.ret(NIL); return; } andOr(args, false); });
    function andOr(args, isAnd) {
      if (args.cdr instanceof Cons) m.stack.push({ k: kAndOr, rest: args.cdr, and: isAnd });
      m.ev(args.car);
    }
    function kAndOr(f, v) {
      if (f.and ? v === NIL : v !== NIL) { m.ret(v); return; }
      andOr(f.rest, f.and);
    }
    fsubr('PROGN', function (args) { m.progn(args); });
    lsubr('PROG2', function (a) { return a.length > 1 ? a[1] : NIL; });
    lsubr('PROG1', function (a) { return a.length ? a[0] : NIL; });
    fsubr('IF', function (args) { m.stack.push({ k: kIf, then: args.cdr.car, els: args.cdr.cdr }); m.ev(args.car); });
    function kIf(f, v) { if (v !== NIL) m.ev(f.then); else m.progn(f.els); }
    fsubr('WHEN', function (args) { m.stack.push({ k: kWhen, body: args.cdr, not: false }); m.ev(args.car); });
    fsubr('UNLESS', function (args) { m.stack.push({ k: kWhen, body: args.cdr, not: true }); m.ev(args.car); });
    function kWhen(f, v) { if ((v !== NIL) !== f.not) m.progn(f.body); else m.ret(NIL); }

    // PROG: variables bound to NIL, atoms in the body are tags for GO, RETURN leaves.
    fsubr('PROG', function (args) {
      var b = [];
      for (var p = args.car; p instanceof Cons; p = p.cdr) { var s = p.car; b.push(s, s.value); s.value = NIL; }
      var items = m.toArray(args.cdr), tags = {};
      items.forEach(function (x, i) { if (!(x instanceof Cons) && x instanceof Sym) tags[x.name] = i; else if (typeof x === 'number') tags['#' + x] = i; });
      var f = { k: kProg, items: items, pc: -1, tags: tags, b: b, prog: true, unwind: unbind };
      progStep(f);
    });
    function progStep(f) {
      var items = f.items;
      while (++f.pc < items.length) {
        var x = items[f.pc];
        if (x instanceof Cons) { m.stack.push(f); m.ev(x); return; }
      }
      m.unbindList(f.b);
      m.ret(NIL);
    }
    function kProg(f) { progStep(f); }
    m.progStep = progStep;
    // the nearest frame that GO can use for this tag
    function findProg(tagKey) {
      for (var i = m.stack.length - 1; i >= m.floor; i--) {
        var f = m.stack[i];
        if (f.barrier) break;
        if (f.prog && f.tags[tagKey] !== undefined) return i;
      }
      return -1;
    }
    fsubr('GO', function (args) {
      var t = args.car;
      if (t instanceof Cons) { m.stack.push({ k: kGoComputed }); m.ev(t); return; }
      doGo(t);
    });
    function kGoComputed(f, v) { doGo(v); }
    function doGo(t) {
      var key = t instanceof Sym ? t.name : '#' + t;
      var i = findProg(key);
      if (i < 0) m.err('UNSEEN GO TAG', t);
      m.unwindTo(i + 1);
      var f = m.stack.pop();
      f.pc = f.tags[key];
      if (f.doLoop) { m.stack.push(f); doBody(f); return; }
      progStep(f);
    }
    subr('RETURN', function (a) {
      for (var i = m.stack.length - 1; i >= m.floor; i--) {
        var f = m.stack[i];
        if (f.barrier) break;
        if (f.prog) {
          m.unwindTo(i + 1);
          m.stack.pop();
          m.unbindList(f.b);
          return a.length ? a[0] : NIL;
        }
      }
      m.err('RETURN FROM NO PROG');
    });

    // DO: (DO ((var init step) ...) (end-test result ...) body ...), and the old
    // form (DO var init step end-test body ...).
    fsubr('DO', function (args) {
      var specs, endc, body;
      if (args.car instanceof Sym && args.car !== NIL) {
        specs = [[args.car, args.cdr.car, args.cdr.cdr.car]];
        endc = m.list(args.cdr.cdr.cdr.car);
        body = args.cdr.cdr.cdr.cdr;
      } else {
        specs = m.toArray(args.car).map(function (s) { return s instanceof Sym ? [s, NIL, null] : [s.car, s.cdr instanceof Cons ? s.cdr.car : NIL, s.cdr instanceof Cons && s.cdr.cdr instanceof Cons ? s.cdr.cdr.car : null]; });
        endc = args.cdr.car;
        body = args.cdr.cdr;
      }
      var items = m.toArray(body), tags = {};
      items.forEach(function (x, i) { if (x instanceof Sym) tags[x.name] = i; });
      var f = { k: kDo, specs: specs, endc: endc, items: items, tags: tags, b: [], vals: [], phase: 'init', i: 0, prog: true, doLoop: true, unwind: unbind, pc: -1 };
      doInit(f);
    });
    function doInit(f) {
      if (f.i < f.specs.length) { m.stack.push(f); m.ev(f.specs[f.i][1]); return; }
      f.specs.forEach(function (s, j) { f.b.push(s[0], s[0].value); s[0].value = f.vals[j]; });
      doTest(f);
    }
    function doTest(f) {
      if (f.endc === NIL) { f.phase = 'body'; f.pc = -1; m.stack.push(f); doBody(f); return; }   // (DO (...) NIL ...): once through
      f.phase = 'test'; m.stack.push(f); m.ev(f.endc.car);
    }
    function doBody(f) {
      m.stack.pop();
      var items = f.items;
      while (++f.pc < items.length) {
        var x = items[f.pc];
        if (x instanceof Cons) { f.phase = 'body'; m.stack.push(f); m.ev(x); return; }
      }
      if (f.endc === NIL) { m.unbindList(f.b); m.ret(NIL); return; }
      f.phase = 'step'; f.i = 0; f.vals = []; doStep(f);
    }
    function doStep(f) {
      while (f.i < f.specs.length && f.specs[f.i][2] === null) { f.vals.push(undefined); f.i++; }
      if (f.i < f.specs.length) { m.stack.push(f); m.ev(f.specs[f.i][2]); return; }
      f.specs.forEach(function (s, j) { if (f.vals[j] !== undefined) s[0].value = f.vals[j]; });
      doTest(f);
    }
    function kDo(f, v) {
      if (f.phase === 'init') { f.vals.push(v); f.i++; doInit(f); return; }
      if (f.phase === 'test') {
        if (v !== NIL) { m.unbindList(f.b); if (f.endc.cdr instanceof Cons) m.progn(f.endc.cdr); else m.ret(NIL); return; }
        f.pc = -1; m.stack.push(f); doBody(f); return;
      }
      if (f.phase === 'body') { m.stack.push(f); doBody(f); return; }
      if (f.phase === 'step') { f.vals.push(v); f.i++; doStep(f); }
    }
    // LET and LET* (the later dialect)
    fsubr('LET', function (args) { letStart(args, false); });
    fsubr('LET*', function (args) { letStart(args, true); });
    function letStart(args, seq) {
      var specs = m.toArray(args.car).map(function (s) { return s instanceof Sym ? [s, null] : [s.car, s.cdr instanceof Cons ? s.cdr.car : null]; });
      var f = { k: kLet, specs: specs, i: 0, vals: [], b: [], seq: seq, body: args.cdr, unwind: unbind };
      letNext(f);
    }
    function letNext(f) {
      while (f.i < f.specs.length && f.specs[f.i][1] === null) { f.vals.push(NIL); if (f.seq) { var s0 = f.specs[f.i][0]; f.b.push(s0, s0.value); s0.value = NIL; } f.i++; }
      if (f.i < f.specs.length) { m.stack.push(f); m.ev(f.specs[f.i][1]); return; }
      if (!f.seq) f.specs.forEach(function (s, j) { f.b.push(s[0], s[0].value); s[0].value = f.vals[j]; });
      m.stack.push({ k: kUnbind, b: f.b, unwind: unbind });
      m.progn(f.body);
    }
    function kLet(f, v) {
      if (f.seq) { var s = f.specs[f.i][0]; f.b.push(s, s.value); s.value = v; }
      f.vals.push(v); f.i++; letNext(f);
    }

    // CATCH and THROW: (CATCH form tag) and (THROW value tag) in 1.6, the tags
    // unevaluated; *CATCH and *THROW take evaluated tags first.
    fsubr('CATCH', function (args) {
      var tag = args.cdr instanceof Cons ? args.cdr.car : null;
      m.stack.push({ k: kPass, catchTag: tag, catcher: true });
      m.ev(args.car);
    });
    fsubr('*CATCH', function (args) { m.stack.push({ k: kStarCatch, body: args.cdr }); m.ev(args.car); });
    function kStarCatch(f, tag) { m.stack.push({ k: kPass, catchTag: tag, catcher: true }); m.progn(f.body); }
    function kPass(f, v) { m.ret(v); }
    fsubr('THROW', function (args) {
      var tag = args.cdr instanceof Cons ? args.cdr.car : null;
      m.stack.push({ k: kThrow, tag: tag });
      m.ev(args.car);
    });
    function kThrow(f, v) { doThrow(v, f.tag); }
    subr('*THROW', function (a) { doThrow(a[1], a[0]); return NOVALUE; });
    function doThrow(v, tag) {
      for (var i = m.stack.length - 1; i >= m.floor; i--) {
        var f = m.stack[i];
        if (f.barrier) break;
        if (f.catcher && (tag === null || f.catchTag === null || f.catchTag === tag || f.catchTag === NIL && tag === NIL)) {
          m.unwindTo(i); m.ret(v); return;
        }
      }
      m.err('NO CATCH FOR THIS TAG', tag === null ? NIL : tag);
    }
    fsubr('UNWIND-PROTECT', function (args) {
      m.stack.push({ k: kUnwindProtect, cleanup: args.cdr, unwind: function (f) { runCleanup(f.cleanup); } });
      m.ev(args.car);
    });
    function kUnwindProtect(f, v) { m.stack.push({ k: kPassValue, value: v }); m.progn(f.cleanup); }
    function kPassValue(f) { m.ret(f.value); }
    function runCleanup(forms) { try { m.callNested(m.list(m.S.LAMBDA, NIL).concat ? null : m.fromArray([m.S.LAMBDA, NIL].concat(m.toArray(forms))), []); } catch (e) { /* a cleanup's error is dropped while unwinding */ } }

    // ERRSET and ERR
    fsubr('ERRSET', function (args) {
      var flag = args.cdr instanceof Cons ? args.cdr.car : T;
      if (flag instanceof Cons || (flag instanceof Sym && flag !== T && flag !== NIL)) { m.stack.push({ k: kErrsetFlag, form: args.car }); m.ev(flag); return; }
      m.stack.push({ k: kErrset, errset: true, flag: flag });
      m.ev(args.car);
    });
    function kErrsetFlag(f, flag) { m.stack.push({ k: kErrset, errset: true, flag: flag }); m.ev(f.form); }
    function kErrset(f, v) { m.ret(new Cons(v, NIL)); }
    lsubr('ERR', function (a) { throw new LispError('ERR', null, a.length ? a[0] : NIL); });
    lsubr('ERROR', function (a) { m.err(a.length ? m.princString(a[0]) : 'ERROR', a.length > 1 ? a[1] : undefined); });

    // defining
    fsubr('DEFUN', function (args) {
      var name = args.car, kind = 'EXPR', rest = args.cdr;
      if (name instanceof Cons) { kind = name.cdr.car.name; name = name.car; }
      if (rest.car instanceof Sym && rest.car !== NIL && FNKINDS[rest.car.name]) { kind = rest.car.name; rest = rest.cdr; }
      else if (rest.cdr instanceof Cons && rest.cdr.car instanceof Sym && FNKINDS[rest.cdr.car.name] && rest.car instanceof Sym && rest.car !== NIL) {
        // (DEFUN NAME ARGS FEXPR ...)? not MacLisp; leave as written
      }
      var lam = new Cons(m.S.LAMBDA, rest);
      ['EXPR', 'FEXPR', 'MACRO', 'SUBR', 'FSUBR', 'LSUBR'].forEach(function (k) { if (k !== kind) m.remprop(name, m.S[k]); });
      m.putprop(name, lam, m.S[kind]);
      m.ret(name);
    });
    fsubr('DEFMACRO', function (args) {
      var name = args.car, params = args.cdr.car, body = args.cdr.cdr;
      var mac = new Subr(name.name, 'SUBR', function (a) { return destructureCall(params, a[0].cdr, body, name); });
      m.remprop(name, m.S.EXPR); m.remprop(name, m.S.FEXPR);
      m.putprop(name, mac, m.S.MACRO);
      m.ret(name);
    });
    // bind a DEFMACRO lambda list against the form's arguments, then run the body
    function destructureCall(params, args, body, name) {
      var b = [];
      function bind(p, a) {
        var opt = false;
        while (p instanceof Cons) {
          var s = p.car;
          if (s === m.S['&OPTIONAL']) { opt = true; p = p.cdr; continue; }
          if (s === m.S['&REST'] || s === m.S['&BODY']) { var r = p.cdr.car; b.push(r, r.value); r.value = a; return; }
          if (s instanceof Cons && !opt) bind(s, a instanceof Cons ? a.car : NIL);
          else { var sym = s instanceof Cons ? s.car : s; b.push(sym, sym.value); sym.value = a instanceof Cons ? a.car : (s instanceof Cons && s.cdr instanceof Cons ? m.evalNow(s.cdr.car) : NIL); }
          a = a instanceof Cons ? a.cdr : NIL; p = p.cdr;
        }
        if (p instanceof Sym && p !== NIL) { b.push(p, p.value); p.value = a; }
      }
      bind(params, args);
      m.stack.push({ k: kUnbind, b: b, unwind: unbind, fnName: name.name });
      m.progn(body);
      return NOVALUE;
    }
    fsubr('DEFVAR DEFCONST', function (args) {
      var s = args.car;
      if (args.cdr instanceof Cons && (s.value === UNBOUND || this === null)) { m.stack.push({ k: kDefvar, s: s }); m.ev(args.cdr.car); return; }
      m.ret(s);
    });
    function kDefvar(f, v) { if (f.s.value === UNBOUND) f.s.value = v; m.ret(f.s); }
    fsubr('EVAL-WHEN', function (args) {
      var when = m.toArray(args.car).map(function (s) { return s.name; });
      if (when.indexOf('EVAL') >= 0 || when.indexOf('LOAD') >= 0) m.progn(args.cdr); else m.ret(NIL);
    });
    fsubr('PUSH', function (args) { m.ev(m.list(m.sym('SETQ'), args.cdr.car, m.list(m.S.CONS, args.car, args.cdr.car))); });
    fsubr('POP', function (args) {
      var v = args.car; m.ev(m.list(m.sym('PROG1'), m.list(m.sym('CAR'), v), m.list(m.sym('SETQ'), v, m.list(m.sym('CDR'), v))));
    });
    fsubr('DOTIMES', function (args) {
      var v = args.car.car, n = args.car.cdr.car, res = args.car.cdr.cdr instanceof Cons ? args.car.cdr.cdr.car : NIL, lim = m.sym('*DOTIMES-LIMIT*');
      m.ev(m.fromArray([m.sym('DO'), m.list(m.list(v, 0, m.list(m.sym('1+'), v)), m.list(lim, n)), m.list(m.list(m.sym('NOT'), m.list(m.sym('<'), v, lim)), res)].concat(m.toArray(args.cdr))));
    });
    fsubr('DOLIST', function (args) {
      var v = args.car.car, l = args.car.cdr.car, tmp = m.sym('*DOLIST-TAIL*');
      m.ev(m.fromArray([m.sym('DO'), m.list(m.list(tmp, l, m.list(m.sym('CDR'), tmp))), m.list(m.list(m.sym('NULL'), tmp)),
        m.fromArray([m.sym('LET'), m.list(m.list(v, m.list(m.sym('CAR'), tmp)))].concat(m.toArray(args.cdr)))]));
    });
    fsubr('SELECTQ CASEQ', function (args) { m.stack.push({ k: kSelectq, clauses: args.cdr }); m.ev(args.car); });
    function kSelectq(f, v) {
      for (var c = f.clauses; c instanceof Cons; c = c.cdr) {
        var keys = c.car.car;
        if (keys === T || keys === m.sym('OTHERWISE') || (keys instanceof Cons ? m.toArray(keys).some(function (k) { return eq(k, v); }) : eq(keys, v))) { m.progn(c.car.cdr); return; }
      }
      m.ret(NIL);
    }
    fsubr('SIGNP', function (args) { m.stack.push({ k: kSignp, test: args.car.name }); m.ev(args.cdr.car); });
    function kSignp(f, v) {
      if (!isNum(v)) { m.ret(NIL); return; }
      var x = numVal(v), t = f.test;
      m.ret(tr(t === 'L' ? x < 0 : t === 'E' ? x === 0 : t === 'LE' ? x <= 0 : t === 'G' ? x > 0 : t === 'GE' ? x >= 0 : t === 'N' ? x !== 0 : false));
    }

    // eval and apply
    lsubr('EVAL', function (a) { m.ev(a[0]); return NOVALUE; });
    lsubr('APPLY', function (a) { m.applyFn(a[0], m.toArray(a[1])); return NOVALUE; });
    lsubr('FUNCALL', function (a) { m.applyFn(a[0], a.slice(1)); return NOVALUE; });
    lsubr('ARG', function (a) { var args = m.lexpr[m.lexpr.length - 1] || []; return a.length ? args[a[0] - 1] : args.length; });
    subr('LISTIFY', function (a) { var args = m.lexpr[m.lexpr.length - 1] || []; var n = a[0]; return m.fromArray(n >= 0 ? args.slice(0, n) : args.slice(args.length + n)); });
    subr('SETARG', function (a) { var args = m.lexpr[m.lexpr.length - 1] || []; args[a[0] - 1] = a[1]; return a[1]; });

    // mapping: MAPCAR MAPC MAPLIST MAPCAN MAPCON MAP, over one list or several
    function mapper(name, onCars, collect) {
      lsubr(name, function (a) {
        var f = { k: kMap, fn: a[0], lists: a.slice(1), onCars: onCars, collect: collect, acc: [], first: a[1] };
        mapNext(f);
        return NOVALUE;
      });
    }
    function mapNext(f) {
      if (f.lists.some(function (l) { return !(l instanceof Cons); })) {
        if (f.collect === 'list') m.ret(m.fromArray(f.acc));
        else if (f.collect === 'nconc') { var r = NIL, last = null; f.acc.forEach(function (x) { if (x instanceof Cons) { if (last) last.cdr = x; else r = x; last = x; while (last.cdr instanceof Cons) last = last.cdr; } }); m.ret(r); }
        else m.ret(f.first);
        return;
      }
      var args = f.lists.map(function (l) { return f.onCars ? l.car : l; });
      f.lists = f.lists.map(function (l) { return l.cdr; });
      m.stack.push(f);
      m.applyFn(f.fn, args);
    }
    function kMap(f, v) { if (f.collect) f.acc.push(v); mapNext(f); }
    mapper('MAPCAR', true, 'list'); mapper('MAPC', true, null); mapper('MAPLIST', false, 'list');
    mapper('MAPCAN', true, 'nconc'); mapper('MAPCON', false, 'nconc'); mapper('MAP', false, null);
    subr('SORT', function (a) {
      var arr = m.toArray(a[0]), fn = a[1];
      arr.sort(function (x, y) { return m.callNested(fn, [x, y]) !== NIL ? -1 : (m.callNested(fn, [y, x]) !== NIL ? 1 : 0); });
      return m.fromArray(arr);
    });

    // ---------- input and output ----------
    function out(s) { m.print(s); }
    lsubr('PRINT', function (a) { out('\n' + m.prin1String(a[0]) + ' '); return a[0]; });
    lsubr('PRIN1', function (a) { out(m.prin1String(a[0])); return a[0]; });
    lsubr('PRINC', function (a) { out(m.princString(a[0])); return a[0]; });
    lsubr('TERPRI', function () { out('\n'); return NIL; });
    lsubr('TYO', function (a) { var c = a[0]; out(c === 13 ? '\n' : c === 10 ? '' : c === 12 ? '\n' : String.fromCharCode(c)); return a[0]; });
    lsubr('CURSORPOS', function (a) {
      if (!a.length) return new Cons(0, m.col);
      if (a[0] instanceof Sym) { var c = a[0].name; if (c === 'C' || c === 'E') out('\n'); return T; }
      if (a.length === 2) { if (a[1] > m.col) out(new Array(a[1] - m.col + 1).join(' ')); return T; }
      return T;
    });
    lsubr('CLEAR-OUTPUT FORCE-OUTPUT', function () { return NIL; });
    lsubr('LINEL', function () { return m.S.LINEL.value; });
    lsubr('CHRCT', function () { return m.S.CHRCT.value; });
    lsubr('SPRINTER GRINDEF SPRINT', function (a) { out('\n' + m.prin1String(a[0]) + '\n'); return NIL; });
    // FORMAT: the few directives SHRDLU's restoration uses
    lsubr('FORMAT', function (a) {
      var ctl = a[1] instanceof Str ? a[1].s : pname(a[1]), i = 2, s = '';
      s = ctl.replace(/~([ASD%&~])/gi, function (all, d) {
        d = d.toUpperCase();
        if (d === '%') return '\n'; if (d === '&') return m.col ? '\n' : ''; if (d === '~') return '~';
        var x = a[i++];
        return d === 'S' ? m.prin1String(x) : m.princString(x);
      });
      if (a[0] === NIL) return new Str(s);
      out(s); return NIL;
    });

    // reading: from the file being UREAD while ^Q is set, else the teletype
    function ttyReadForm(eofv) {
      // try to read a whole form from what has been typed; wait if it is not all there
      var st = new Stream(m.tty);
      try {
        var x = m.readFrom(st, EOF);
        if (x === EOF) return null;
        m.tty = m.tty.slice(st.pos);
        if (m.tty.charAt(0) === '\r') m.tty = m.tty.slice(1);
        return { x: x };
      } catch (e) { if (e instanceof LispError && /END OF FILE/.test(e.msg)) return null; throw e; }
      void eofv;
    }
    lsubr('READ', function (a) {
      var st = m.curReadStream || null;
      if (st) return m.readFrom(st, a.length ? a[0] : undefined);
      var fin = m.fileInput();
      if (fin) {
        var x = m.readFrom(fin.st, EOF);
        if (x === EOF) { if (!fin.loading) m.inStack.pop(); if (a.length) return a[0]; m.err('END OF FILE'); }
        return x;
      }
      var r = ttyReadForm();
      if (r) return r.x;
      return m.waitTTY(function () { var q = ttyReadForm(); if (q) m.ret(q.x); else m.waitTTY(arguments.callee); });
    });
    function ttyChar(consume) {
      if (!m.tty.length) return null;
      var c = m.tty.charCodeAt(0);
      if (consume) { m.tty = m.tty.slice(1); m.echo(c); }
      return c;
    }
    m.echo = function (c) { void c; };   // the page echoes typing itself
    function readChar(consume, asSym) {
      var st = m.curReadStream || (m.fileInput() && m.fileInput().st);
      if (st) {
        var ch = consume ? st.next() : st.peek();
        if (ch === null) return asSym ? m.err('END OF FILE') : -1;
        return asSym ? m.intern(ch) : ch.charCodeAt(0);
      }
      var c = ttyChar(consume);
      if (c === null) return m.waitTTY(function retry() { var d = ttyChar(consume); if (d === null) { m.waitTTY(retry); return; } m.ret(asSym ? m.intern(String.fromCharCode(d)) : d); });
      return asSym ? m.intern(String.fromCharCode(c)) : c;
    }
    lsubr('TYI', function () { return readChar(true, false); });
    lsubr('TYIPEEK', function () { return readChar(false, false); });
    lsubr('READCH', function () { return readChar(true, true); });
    subr('LISTEN', function () { return m.tty.length; });

    // files: UREAD opens a file for READ (with ^Q), LOAD reads and evaluates one
    fsubr('UREAD', function (args) {
      var f = m.findFile(args.car instanceof Cons ? args : args.car === NIL ? NIL : args);
      if (!f) m.err('FILE NOT FOUND', args);
      m.inStack.push({ name: f.name, st: new Stream(f.text, f.name), spec: args });
      m.ret(m.fromArray(m.toArray(args)));
    });
    fsubr('UWRITE UFILE UKILL UCLOSE UPROBE UAPPEND', function () { m.ret(T); });
    subr('PROBEF', function (a) { var f = m.findFile(a[0]); return f ? m.list(m.list(m.S.DSK, m.sym('SHRDLU')), m.intern(f.name), m.sym('>')) : NIL; });
    // library files the system loads are supplied here; SHRDLU's own files are read as source
    var LIBRARY = { SLAVE: 1, FORMAT: 1, UMLMAC: 1, TRACE: 1, GRINDE: 1, GRINDEF: 1, MLSUB: 1, LET: 1, SHARPM: 1, BACKQ: 1 };
    function loadSpec(spec) {
      var name = m.fileName(spec);
      if (name && LIBRARY[name.split(' ')[0].toUpperCase()]) { m.ret(T); return; }
      var f = m.findFile(spec);
      if (!f && name && m.skip.indexOf(name.split(' ')[0].toUpperCase()) >= 0) { m.print('\n[bench: ' + name.split(' ')[0] + ' is not in this copy; skipped, see its repairs]\n'); m.ret(NIL); return; }
      if (!f) m.err('FILE NOT FOUND', spec);
      m.loadText(f.text, f.name);
    }
    lsubr('LOAD', function (a) { loadSpec(a[0]); return NOVALUE; });
    fsubr('FASLOAD', function (args) { loadSpec(args.car instanceof Cons ? args.car : args); });

    // STATUS and SSTATUS: what SHRDLU asks of them
    fsubr('STATUS', function (args) {
      var what = args.car.name;
      switch (what) {
        case 'UREAD': { var f = m.inStack[m.inStack.length - 1]; m.ret(f ? m.list(m.intern(f.name), m.sym('>'), m.S.DSK, m.sym('SHRDLU')) : (m.loading ? m.list(m.intern(m.loading), m.sym('>'), m.S.DSK, m.sym('SHRDLU')) : NIL)); return; }
        case 'GCTIME': m.ret(0); return;
        case 'LISPVERSION': m.ret(m.intern(m.dialect === 'old' ? '1.6' : '2156')); return;   // 1.6: the CMU manual (June 1972); 2156: the MacLisp on ITS today, as Swenson's banner prints it
        case 'TTY': m.ret(m.list(0, 0)); return;
        case 'CRUNIT': m.ret(m.list(m.S.DSK, m.sym('SHRDLU'))); return;
        case 'DATE': m.ret(m.list(72, 6, 1)); return;
        case 'DAYTIME': m.ret(m.list(12, 0, 0)); return;
        case 'UNAME': case 'USERID': m.ret(m.sym('BENCH')); return;
        case 'FEATURE': m.ret(NIL); return;
        case 'MACRO': { var c = args.cdr.car; m.ret(m.readtable[pname(c)] || NIL); return; }
        case 'TOPLEVEL': m.ret(m.toplevel || NIL); return;
        default: m.ret(NIL);
      }
    });
    fsubr('SSTATUS', function (args) {
      var what = args.car.name;
      if (what === 'MACRO') { m.stack.push({ k: kSstatusMacro, ch: pname(args.cdr.car) }); m.ev(args.cdr.cdr.car); return; }
      if (what === 'TOPLEVEL') { m.stack.push({ k: kSstatusTop }); m.ev(args.cdr.car); return; }
      m.ret(T);
    });
    function kSstatusMacro(f, fn) { m.readtable[f.ch] = fn; m.ret(T); }
    function kSstatusTop(f, v) { m.toplevel = v; m.ret(v); }
    // IOC: teletype control letters (the restoration redefines it itself)
    fsubr('IOC', function (args) {
      var letters = args === NIL ? '' : pname(args.car);
      letters.split('').forEach(function (c) {
        var S = m.S;
        switch (c) { case 'Q': S['^Q'].value = T; break; case 'S': S['^Q'].value = NIL; break; case 'W': S['^W'].value = T; break; case 'V': S['^W'].value = NIL; break;
          case 'R': S['^R'].value = T; break; case 'T': S['^R'].value = NIL; break; case 'D': S['^D'].value = T; break; case 'C': S['^D'].value = NIL; break; }
      });
      m.ret(NIL);
    });
    // time: a clock that counts the interpreter's steps, so runs repeat exactly
    subr('RUNTIME', function () { return m.steps * 10; });
    lsubr('TIME', function () { return new Flo(m.steps / 1e5); });
    lsubr('SLEEP', function () { return NIL; });
    // accepted and ignored: memory, purity, the debugger
    fsubr('ALLOC GCTWA NOUUO PURIFY LAPPURIFY', function () { m.ret(T); });
    lsubr('GC PAGEBPORG SUSPEND VALRET QUIT NORET *RSET GCTWA', function () { return NIL; });
    fsubr('BREAK', function (args) {
      m.stack.push({ k: kBreak, tag: args.car });
      m.ev(args.cdr instanceof Cons ? args.cdr.car : T);
    });
    function kBreak(f, v) { if (v !== NIL) { m.terpriIfNeeded(); out(';BKPT ' + m.princString(f.tag) + '\n'); } m.ret(NIL); }
    fsubr('TRACE', function (args) { m.toArray(args).forEach(function (s) { if (s instanceof Sym) m.traced[s.name] = true; }); m.ret(args); });
    fsubr('UNTRACE', function (args) { if (args === NIL) m.traced = {}; else m.toArray(args).forEach(function (s) { delete m.traced[s.name]; }); m.ret(args); });
    // arrays, for MAKOBLIST's use of the obarray
    lsubr('ARRAYDIMS', function () { return m.list(m.S.ARRAY, m.obarray.size + 129); });
    lsubr('LISTARRAY', function () { return m.fromArray(Array.from(m.obarray.values())); });
    lsubr('*ARRAY ARRAY STORE', function () { return NIL; });
    subr('MAKOBLIST', function () { return m.fromArray(Array.from(m.obarray.values())); });

    // the DEC 340 display (the SLAVE library): passed to the page's display object
    'DISINI DISCREATE DISALINE DISLOCATE DISFLUSH DISET DISGORGE DISLINK DISLIST DISAD DISPLAY DISBLINK DISCOPY DISMARK DISCHANGE DISMOTION DISCRIBE DISPOINT DISAPOINT DISCUSS'.split(' ').forEach(function (n) {
      lsubr(n, function (a) { return m.display && m.display[n] ? m.display[n](a, m) : NIL; });
    });
  }

  var api = { Machine: Machine, Sym: Sym, Cons: Cons, Flo: Flo, Str: Str, Subr: Subr, LispError: LispError, UNBOUND: UNBOUND };
  root.MacLisp = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(this);
