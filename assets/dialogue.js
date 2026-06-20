/* Ambient teletype: streams the full SHRDLU demonstration dialogue above the
   wordmark, typed at a relaxed pace, looping. Person input is the dimmer green,
   SHRDLU answers the brighter green; the whole thing is upper case, after the
   original all-caps VDU. Decorative (aria-hidden); the full transcript also
   lives on dialogue.html. Honours prefers-reduced-motion (static tail, no loop). */
(function () {
  var feed = document.getElementById('tt-feed');
  if (!feed) return;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // s: 0 = person (input), 1 = SHRDLU (response)
  var D = [
    {s:0,t:"pick up a big red block."},
    {s:1,t:"OK. (does it)"},
    {s:0,t:"grasp the pyramid."},
    {s:1,t:"I don't understand which pyramid you mean."},
    {s:0,t:"find a block which is taller than the one you are holding and put it into the box."},
    {s:1,t:"by \"it\", I assume you mean the block which is taller than the one I am holding."},
    {s:1,t:"OK. (does it)"},
    {s:0,t:"what does the box contain?"},
    {s:1,t:"the blue pyramid and the blue block."},
    {s:0,t:"what is the pyramid supported by?"},
    {s:1,t:"the box."},
    {s:0,t:"how many blocks are not in the box?"},
    {s:1,t:"four of them."},
    {s:0,t:"is at least one of them narrower than the one which I told you to pick up?"},
    {s:1,t:"yes, the red cube."},
    {s:0,t:"is it supported?"},
    {s:1,t:"yes, by the table."},
    {s:0,t:"can the table pick up blocks?"},
    {s:1,t:"no."},
    {s:0,t:"can a pyramid be supported by a block?"},
    {s:1,t:"yes."},
    {s:0,t:"can a pyramid support a pyramid?"},
    {s:1,t:"I don't know."},
    {s:0,t:"stack up two pyramids."},
    {s:1,t:"I can't."},
    {s:0,t:"will you please stack up both of the red blocks and either a green cube or a pyramid?"},
    {s:1,t:"OK. (does it)"},
    {s:0,t:"which cube is sitting on the table?"},
    {s:1,t:"the large green one which supports the red pyramid."},
    {s:0,t:"is there a large block behind a pyramid?"},
    {s:1,t:"yes, three of them: a large red one, a large green cube, and the blue one."},
    {s:0,t:"put a small one onto the green cube which supports a pyramid."},
    {s:1,t:"OK. (does it)"},
    {s:0,t:"put the littlest pyramid on top of it."},
    {s:1,t:"OK. (does it)"},
    {s:0,t:"does the shortest thing the tallest pyramid's support supports support anything green?"},
    {s:1,t:"yes, the green pyramid."},
    {s:0,t:"what color is it?"},
    {s:1,t:"by \"it\", I assume you mean the shortest thing the tallest pyramid's support supports."},
    {s:1,t:"red"},
    {s:0,t:"how many things are on top of green cubes?"},
    {s:1,t:"I'm not sure what you mean by \"on top of\" in the phrase \"on top of green cubes\".\ndo you mean:\n1 - directly on the surface\n2 - anwhere on top of ?"},
    {s:0,t:"2"},
    {s:1,t:"three of them."},
    {s:0,t:"had you touched any pyramid before you put the green one on the little cube?"},
    {s:1,t:"yes, the green one."},
    {s:0,t:"when did you pick it up?"},
    {s:1,t:"while I was stacking up the red cube, a large red block and a large green cube."},
    {s:0,t:"why?"},
    {s:1,t:"to get rid of it."},
    {s:0,t:"why did you do that?"},
    {s:1,t:"to clean off the red cube."},
    {s:0,t:"why did you clear off that cube?"},
    {s:1,t:"to put it on a large green cube."},
    {s:0,t:"why did you do that?"},
    {s:1,t:"to stack up the red cube, a large red block and a large green cube."},
    {s:0,t:"why did you do that?"},
    {s:1,t:"because you asked me to."},
    {s:0,t:"how did you do it?"},
    {s:1,t:"by putting a large red block on the table; then letting go of it; then putting a large green cube on it; then letting go of that cube; then putting the red cube on that cube; then letting go of that cube."},
    {s:0,t:"how many objects did you touch while you were doing it?"},
    {s:1,t:"four of them."},
    {s:0,t:"what did the red cube support before you started to clean it off?"},
    {s:1,t:"the green pyramid."},
    {s:0,t:"there were five blocks to the left of the box then."},
    {s:1,t:"no, only four of them: the red cube, two large green cubes and a large red block."},
    {s:0,t:"put the blue pyramid on the block in the box."},
    {s:1,t:"OK. (does it)"},
    {s:0,t:"is there anything which is bigger than every pyramid but is not as wide as the thing that supports it?"},
    {s:1,t:"yes, the blue block."},
    {s:0,t:"does a steeple"},
    {s:1,t:"(interrupting) sorry, I don't know the word \"steeple\"."},
    {s:0,t:"a \"steeple\" is a stack which contains two green cubes and a pyramid."},
    {s:1,t:"I understand."},
    {s:0,t:"are there any steeples now?"},
    {s:1,t:"no."},
    {s:0,t:"build one."},
    {s:1,t:"OK. (does it)"},
    {s:0,t:"call the biggest block \"superblock\"."},
    {s:1,t:"OK."},
    {s:0,t:"have you picked superblock up since we began?"},
    {s:1,t:"yes."},
    {s:0,t:"why did you drop it?"},
    {s:1,t:"by \"it\", I assume you mean the superblock.\nI can't explain a non-existent event."},
    {s:0,t:"is there anything to the right of the red pyramid?"},
    {s:1,t:"yes, four things: the box, the red cube, the blue pyramid and the block named superblock."},
    {s:0,t:"thank you."},
    {s:1,t:"you're welcome!"}
  ];

  // pacing (ms), slow and relaxed
  var CHAR_YOU = 78, CHAR_SH = 54, GAP_TO_SH = 700, GAP_TO_YOU = 1250, LOOP_PAUSE = 7000;

  var cursor = document.createElement('span');
  cursor.className = 'tt-cursor';

  function newLine(s) {
    var p = document.createElement('p');
    p.className = 'tt-line ' + (s ? 'sh' : 'you');
    feed.appendChild(p);
    return p;
  }

  if (reduce) {
    // static tail: the closing exchanges, no animation, no loop
    D.slice(-6).forEach(function (turn) { newLine(turn.s).textContent = turn.t; });
    return;
  }

  var timer = null;
  function typeLine(turn, done) {
    var el = newLine(turn.s);
    el.appendChild(cursor);
    var txt = turn.t, i = 0, speed = turn.s ? CHAR_SH : CHAR_YOU;
    (function step() {
      if (i < txt.length) {
        el.insertBefore(document.createTextNode(txt.charAt(i)), cursor);
        i++;
        // ease over spaces and line breaks a touch
        var c = txt.charAt(i - 1);
        var d = (c === ' ') ? speed * 0.6 : (c === '\n' ? speed * 3 : speed);
        timer = setTimeout(step, d);
      } else {
        done();
      }
    })();
  }

  function run(i) {
    if (i >= D.length) {
      timer = setTimeout(function () {
        feed.classList.add('clearing');
        timer = setTimeout(function () {
          feed.innerHTML = '';
          feed.classList.remove('clearing');
          run(0);
        }, 1000);
      }, LOOP_PAUSE);
      return;
    }
    var gap = D[i].s ? GAP_TO_YOU : GAP_TO_SH; // pause AFTER this line before the next
    typeLine(D[i], function () { timer = setTimeout(function () { run(i + 1); }, gap); });
  }

  run(0);
})();
