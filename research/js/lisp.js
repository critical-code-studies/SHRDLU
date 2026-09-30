/*
 * lisp.js - reads SHRDLU's MacLisp source files into top-level forms and
 * indexes what they define and use. It is the bench's counterpart to an
 * assembler: it does not run anything, it finds the definitions (functions,
 * Micro-Planner theorems, dictionary words, grammar programs, globals), the
 * places each name is used, the comments, and any unbalanced parentheses.
 *
 * The reader follows MacLisp 1.6 as SHRDLU was written for it: ";" begins a
 * comment, "/" makes the next character an ordinary letter, "'" quotes, a
 * lone "." is a dotted pair, and lower case is read as upper case. "$" is
 * left as a letter here (Micro-Planner reads "$?X" with a read macro), so
 * "$?X" indexes as one name. Nothing else is special: MacLisp 1.6 had no
 * strings, so '"' is a letter too.
 *
 * Output (the contract the views read, shared with the Spacewar! bench's
 * assembler): { files, forms, symbols, macros, errors, titles, calls, byLine }.
 */
(function (root) {
  'use strict';

  function splitLines(text) {
    var s = String(text || '').replace(/\r\n?/g, '\n');
    if (s.slice(-1) === '\n') s = s.slice(0, -1);
    return s === '' ? [] : s.split('\n');
  }

  // Definition forms: which argument names the thing, and what kind it is.
  var FN_KINDS = { EXPR: 'EXPR', FEXPR: 'FEXPR', MACRO: 'MACRO', LEXPR: 'LEXPR' };
  var KIND_LABEL = { EXPR: 'function', FEXPR: 'fexpr', MACRO: 'macro', LEXPR: 'lexpr', THEOREM: 'theorem',
    WORD: 'dictionary word', GRAMMAR: 'grammar program', VAR: 'global', PROP: 'property', READMACRO: 'read macro' };

  function isNumberToken(t) { return /^[+-]?(\d+\.?|\d*\.\d+(E[+-]?\d+)?)$/.test(t); }

  // Tokenise one file. Tokens: {t:'(' | ')' | "'" | '.' | 'sym' | 'num', v, line, col}.
  // Comments are collected per line.
  function tokenise(text) {
    var toks = [], comments = [], line = 1, col = 0, i = 0, n = text.length;
    while (i < n) {
      var c = text[i];
      if (c === '\n') { line++; col = 0; i++; continue; }
      if (c === '\r') { i++; continue; }
      if (c === ';') {
        var j = text.indexOf('\n', i); if (j < 0) j = n;
        comments.push({ line: line, text: text.slice(i, j).replace(/\r$/, '') });
        col += j - i; i = j; continue;
      }
      if (c === ' ' || c === '\t' || c === '\f' || c === '\v' || c === '\u0000') { i++; col++; continue; }
      if (c === '(' || c === ')' || c === "'") { toks.push({ t: c, line: line, col: col }); i++; col++; continue; }
      // an atom: read to a delimiter, "/" escaping the next character
      var start = i, name = '', slashed = false, sl = line;
      while (i < n) {
        c = text[i];
        if (c === '/') {
          if (i + 1 < n) { name += text[i + 1]; if (text[i + 1] === '\n') { line++; col = 0; } i += 2; slashed = true; continue; }
          i++; continue;
        }
        if (c === '(' || c === ')' || c === "'" || c === ';' || c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\f') break;
        name += c; i++;
      }
      col += i - start;
      if (!slashed && name === '.') { toks.push({ t: '.', line: sl, col: col }); continue; }
      if (!slashed && isNumberToken(name)) { toks.push({ t: 'num', v: name, line: sl, col: col }); continue; }
      // MacLisp reads letters in upper case unless slashified; a slashed
      // character keeps its case, which we cannot tell apart here once joined,
      // so a name with a slash in it is kept as written.
      toks.push({ t: 'sym', v: slashed ? name : name.toUpperCase(), line: sl, col: col, raw: text.slice(start, i) });
    }
    return { toks: toks, comments: comments, lines: line };
  }

  // Parse tokens into nested arrays. A form node: {list:[...], line, end} ;
  // an atom node: {atom:'NAME', num:bool, line}.
  function parse(toks, file, errors) {
    var pos = 0, forms = [];
    function node() {
      var t = toks[pos++];
      if (t.t === "'") {
        if (pos >= toks.length) { errors.push({ file: file, line: t.line, message: 'A quote with nothing after it at the end of the file' }); return { atom: 'QUOTE', line: t.line }; }
        var q = node();
        return { list: [{ atom: 'QUOTE', line: t.line, quoteMark: true }, q], line: t.line, end: q.end || q.line, quoted: true };
      }
      if (t.t === '(') {
        var items = [], dotted = false;
        while (pos < toks.length && toks[pos].t !== ')') {
          if (toks[pos].t === '.') { pos++; dotted = true; continue; }
          items.push(node());
        }
        if (pos >= toks.length) {
          errors.push({ file: file, line: t.line, message: 'This parenthesis is never closed' });
          return { list: items, line: t.line, end: items.length ? (items[items.length - 1].end || items[items.length - 1].line) : t.line, dotted: dotted, open: true };
        }
        var close = toks[pos++];
        return { list: items, line: t.line, end: close.line, dotted: dotted };
      }
      if (t.t === ')') {
        errors.push({ file: file, line: t.line, message: 'A closing parenthesis with nothing open' });
        return null;
      }
      if (t.t === '.') return { atom: '.', line: t.line };
      return { atom: t.v, num: t.t === 'num', line: t.line };
    }
    while (pos < toks.length) {
      var f = node();
      if (f) forms.push(f);
    }
    return forms;
  }

  function head(f) { return f && f.list && f.list[0] && f.list[0].atom; }
  function atomAt(f, i) { return f && f.list && f.list[i] && f.list[i].atom; }

  // What a top-level form defines: [{name, kind}] (usually one).
  function definitions(f) {
    var h = head(f), out = [];
    if (!h) return out;
    if (h === 'DEFUN') {
      var name = atomAt(f, 1), third = atomAt(f, 2);
      if (name) out.push({ name: name, kind: FN_KINDS[third] || 'EXPR' });
    } else if (h === 'DEFPROP') {
      var nm = atomAt(f, 1), ind = atomAt(f, 3);
      if (nm && ind) out.push({ name: nm, kind: FN_KINDS[ind] || (ind === 'THEOREM' ? 'THEOREM' : 'PROP'), prop: ind });
    } else if (h === 'DEFS') {
      if (atomAt(f, 1)) out.push({ name: atomAt(f, 1), kind: 'WORD' });
    } else if (h === 'PDEFINE') {
      if (atomAt(f, 1)) out.push({ name: atomAt(f, 1), kind: 'GRAMMAR' });
    } else if (h === 'SETQ') {
      for (var i = 1; i < f.list.length; i += 2) if (atomAt(f, i)) out.push({ name: atomAt(f, i), kind: 'VAR' });
    } else if (h === 'SSTATUS' && atomAt(f, 1) === 'MACRO' && atomAt(f, 2)) {
      out.push({ name: atomAt(f, 2), kind: 'READMACRO' });
    }
    return out;
  }

  // Walk a form: every atom used (with line), and calls (atoms in function position).
  function walk(f, visit, isCallPos) {
    if (!f) return;
    if (f.atom != null) { if (!f.num) visit(f.atom, f.line, isCallPos); return; }
    var quoted = head(f) === 'QUOTE';
    f.list.forEach(function (x, i) {
      if (quoted && i === 1) {
        // quoted data still names things ('FOO passed to APPLY or MAPCAR); count as a use, not a call
        walk(x, function (a, l) { visit(a, l, false); }, false);
        return;
      }
      walk(x, visit, i === 0 && x.atom != null);
    });
  }

  // Index a set of files: [{name, text}] -> the build contract.
  function index(files) {
    var errors = [], forms = [], titles = [], symbols = {}, uses = {}, calls = {}, commentsByFile = [];
    files.forEach(function (file, fi) {
      var tk = tokenise(file.text || '');
      commentsByFile[fi] = tk.comments;
      var fs = parse(tk.toks, fi, errors);
      // a file's title: its first comment line with words in it, else its name
      var first = tk.comments.filter(function (c) { return /[A-Za-z]{3}/.test(c.text) && !/kset|fonts;|-\*-/i.test(c.text); })[0];
      titles.push({ file: fi, line: first ? first.line : 1, text: first ? first.text.replace(/^;+\s*/, '').trim() : file.name });
      fs.forEach(function (f) {
        var defs = definitions(f);
        var rec = { file: fi, line: f.line, end: f.end || f.line, head: head(f) || (f.atom != null ? f.atom : ''), defs: defs };
        forms.push(rec);
        defs.forEach(function (d) {
          var s = symbols[d.name] || (symbols[d.name] = { name: d.name, kinds: [], defs: [], refs: [], defined: true, label: true });
          if (s.kinds.indexOf(d.kind) < 0) s.kinds.push(d.kind);
          s.kind = s.kind || d.kind;
          s.defs.push({ file: fi, line: f.line, end: rec.end, kind: d.kind, prop: d.prop });
        });
        var owner = defs.length && defs[0].kind !== 'VAR' ? defs[0].name : null;
        walk(f, function (a, line, isCall) {
          (uses[a] = uses[a] || []).push({ file: fi, line: line, call: !!isCall, owner: owner });
          if (isCall && owner && a !== owner) {
            var m = calls[owner] || (calls[owner] = {});
            m[a] = (m[a] || 0) + 1;
          }
        }, false);
      });
    });
    // attach uses to defined names (a definition's own name line is not a use)
    Object.keys(symbols).forEach(function (k) {
      var s = symbols[k], defLines = {};
      s.defs.forEach(function (d) { defLines[d.file + ':' + d.line] = 1; });
      s.refs = (uses[k] || []).filter(function (u) { return !defLines[u.file + ':' + u.line]; });
      s.calledFrom = {};
      s.refs.forEach(function (u) { if (u.call && u.owner) s.calledFrom[u.owner] = (s.calledFrom[u.owner] || 0) + 1; });
    });
    // byLine: what each line holds, for the Read view's marks
    var byLine = files.map(function () { return {}; });
    forms.forEach(function (f) {
      if (f.defs.length) byLine[f.file][f.line] = { def: f.defs.map(function (d) { return d.name; }), kind: f.defs[0].kind };
    });
    var macros = Object.keys(symbols).filter(function (k) { return symbols[k].kinds.indexOf('MACRO') >= 0 || symbols[k].kinds.indexOf('READMACRO') >= 0; })
      .map(function (k) { var s = symbols[k], d = s.defs[0]; return { name: k, file: d.file, line: d.line, endLine: d.end, kind: s.kind, uses: s.refs.length }; });
    return {
      files: files.map(function (f) { return f.name; }),
      forms: forms, symbols: Object.keys(symbols).map(function (k) { return symbols[k]; }),
      uses: uses, calls: calls, macros: macros, errors: errors, titles: titles,
      comments: commentsByFile, defsByLine: byLine, byLine: files.map(function () { return {}; }),
      // the Spacewar! views ask for these; a Lisp source has no memory image
      words: [], memory: [], variables: null, start: null
    };
  }

  var LispIndex = { splitLines: splitLines, tokenise: tokenise, index: index, KIND_LABEL: KIND_LABEL, isNumberToken: isNumberToken };
  root.LispIndex = LispIndex;
  if (typeof module !== 'undefined' && module.exports) module.exports = LispIndex;
})(this);
