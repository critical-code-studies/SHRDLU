# SHRDLU resurrection (semaphorecorp.com, preserved)

> **Provenance.** "SHRDLU resurrection", formerly at
> `http://www.semaphorecorp.com/misc/shrdlu.html` (the "discussion of various
> efforts" Winograd's own page linked to). Created 2002, last updated 22 August
> 2013; reachable now only via the Internet Archive (Wayback capture
> `web/20150512235117`, one of 167 captures 1997-2026). Reproduced verbatim for
> archival purposes. Broken links were marked with [brackets] in the original.

---

SHRDLU was a 1970 artificial intelligence (AI) tour de force, written in MACLISP
for the Incompatible Time Sharing System (ITS). To quote SHRDLU's creator: The
system answers questions, executes commands, and accepts information in an
interactive English dialog... The system contains a parser, a recognition
grammar of English, programs for semantic analysis, and a general problem
solving system... It can remember and discuss its plans and actions as well as
carrying them out... Knowledge in the system is represented in the form of
procedures, rather than tables of rules or lists of patterns.

You can download a Windows text-only console version of SHRDLU implemented in
Common Lisp, or a graphical 3-D version implemented with an extra Java layer.
Source code is included. These files were supplied by Greg Sharp, and were
produced by the [university student project] to resurrect SHRDLU. Double-click
the SHRDLU.BAT file in either version to start running.

The Windows version isn't capable of completely reproducing the classic demo
dialog and is fairly brittle and easily crashable, but it does correctly handle
a large portion of the classic input sentences and many reasonable variations.
Note that different versions of the demo dialog exist. For example, the demo in
Winograd's book includes some "owning" tests not included in his web site demo,
and his web site demo includes a "support supports support" test not in the
book's demo. Rephrasing your input can often help get past current bugs. For
example, leaving out "will you please" lets the multi-block stack request be
accepted (although the Java display reveals only two blocks actually end up
stacked). This film shows what a correct SHRDLU demo should display.

SHRDLU is often described as an initially impressive program that only appears
to succeed because of the limited blocks world domain it understands. On the
other hand, it's hard to find many subsequently implemented projects that were
as ambitious or as general as SHRDLU. Considering how many applications could
benefit from even limited intelligence, why is SHRDLU-style technology still so
difficult to find or exploit? One popular excuse is that subsequent efforts to
generalize SHRDLU techniques were supposedly not fruitful, with the result that
SHRDLU-style projects fell out of favor. Or perhaps the complexity required in
SHRDLU just to attain rudimentary intelligence scared off anyone who might
attempt a more sophisticated system, because SHRDLU code already exceeded the
design and engineering capabilities of most programmers. Creating a program that
understands "pick up anything green, at least three of the blocks, and either a
box or a sphere which is bigger than any brick on the table" is not an easy
task.

The required scale of intelligent software can be easy to underestimate. It took
many years for the AI community to realize that the exclusive-or limitation of
the 2-layer perceptron identified by Marvin Minsky and Seymour Papert could be
overcome by going to 3 layers (contrary to their conjecture). SHRDLU is on the
order of only 500 kilobytes of sequentially executing source code, while the
human brain contains around 100 billion neurons with about 100 trillion parallel
interconnections. SHRDLU-like software, or even simplistic brute-force style
systems, wired at the scale of the brain might turn out to be quite capable. If
you make any improvements to SHRDLU, or manage to get the original SHRDLU code
running on an ITS emulator like those listed below, or know of open software you
feel approaches or exceeds SHRDLU's capabilities, contact us.

Online MIT documents useful for understanding SHRDLU's internals include
Winograd's thesis (subsequently published in book form, with some changes), the
Micro-Planner manual and update, the PROGRAMMER manual, and Andee Rubin's
flowcharts showing SHRDLU's structure.

## People (exchanges with SHRDLU-related people, in last-name order)

- **Henry Baker** posted comments about parsing and Terry Winograd's
  disenchantment after creating SHRDLU. Henry wrote a version of LINGOL (see
  Vaughn Pratt below). Henry told us that when he saw SHRDLU running at MIT, it
  crashed "a lot". (In comparison, a document claims, with misspellings: "On the
  A.I. machine, a reasonably fluent and debuged version of SHRDLU is alway
  availlable..." for SHRDLU version 101 of 4/27/73).
- **[S. Simon Ben-Avi]** wrote a [critique] of SHRDLU as part of some [course notes].
- **[Keldon Jones]** worked on the [student project] to port SHRDLU; posted an
  early Common Lisp version of SHRDLU and a MACLISP interpreter written in C for
  running original SHRDLU source.
- **[Dan Knapp]** posted [code] from the [student project] (a newer version than
  Keldon Jones's, possibly equivalent to Greg Sharp's submittal).
- **Andrey Lebedev** sent links to demos of a SHRDLU-like system implemented by
  Moscow State Institute of Electronics and Mathematics students in 2009.
- **[Dave McDonald]** was Terry Winograd's first research student at MIT. Dave
  reports rewriting "a lot" of SHRDLU (with Andee Rubin, Stu Card, Jeff Hill).
  Recollections: "In the rush to get [SHRDLU] ready for his thesis defense
  [Terry] made some direct patches to the Lisp assembly code and never back
  propagated them to his Lisp source... We kept around the very program image
  that Terry constructed... As an image, [SHRDLU] couldn't keep up with the
  periodic changes to the ITS, and gradually more and more bit rot set in...
  Certainly a couple of dozen [copies of SHRDLU were distributed]... SHRDLU was a
  special program. Even today its parser would be competitive as an
  architecture. For a recursive descent algorithm it had some clever means of
  jumping to anticipated alternative analyses rather than doing a standard
  backup. **It defined the whole notion of procedural semantics (though Bill
  Woods tends to get the credit)**, and its grammar was the first instance of
  Systemic Functional Linguistics applied to language understanding and quite
  well done." Dave believes the hardest part of getting a complete SHRDLU to run
  again is fixing MicroPlanner, since "the original MicroPlanner could not be
  maintained because it had hardwired some direct pointers into the state of ITS
  (as actual numbers!)".
- **Tom Moran** wrote the SHRDLU-like Mini-Linguistic System (MILISY) at
  Carnegie-Mellon in 1972.
- **Vaughan Pratt** wrote [SHRDLV] (not SHRDLU) in LINGOL. Recollects that "by
  1974 SHRDLU appeared to be a victim of serious software rot". Gerry Sussman's
  comment to him: "That's a pity, the program worked when Terry [Winograd]
  demonstrated it to us."
- **[Henrik Prebensen]** wrote [Blockhead], a SHRDLU-like program in Turbo Prolog.
- **[Yury Semenov]** modified [a version of MicroPlanner] for Franz LISP.
- **Greg Sharp** acquired the [student project] source (a newer version created
  after Keldon Jones left) before the university's links broke; those files
  became the console and graphic versions linked at the top. Greg also saved the
  later school mailing-list postings recording the MACLISP-conversion
  discoveries. Greg has ITS running under KLH with MACLISP working, and was
  debugging his distribution of SHRDLU (grateful for "massive" help from Kent
  Pitman and the Lisp community).
- **[Chris Stacy]** was running MACLISP on a Unix emulation of ITS.
- **Josh Sutterfield** worked on the [student project]; sent the project page's
  new URL after the University of Missouri Rolla became Missouri University of
  Science and Technology.
- **Paul Svensson** has a public ITS under KLH; its SHRDLU files were modified by
  Keldon Jones.
- **Björn Victor** has a public ITS running; SHRDLU capabilities undetermined.
- **Yorick Wilks** wrote a 1974 survey of natural language understanding
  systems, including a critique of SHRDLU.

## Terry Winograd's answers (emailed 2004)

**How would you say SHRDLU influenced your subsequent work and/or philosophy in
AI?** "Having insight into the limitations I encountered in trying to extend
SHRDLU beyond micro-worlds was the key opening to the philosophical views that I
developed in the work with Flores. The closest thing I have online is the paper
*Thinking machines: Can there be? Are we?*"

**How would you characterize AI since SHRDLU? Why do you think no one took
SHRDLU or SHRDLU-like applications to the next level?** "There are fundamental
gulfs between the way that SHRDLU and its kin operate, and whatever it is that
goes on in our brains. I don't think that current research has made much
progress in crossing that gulf, and the relevant science may take decades or
more to get to the point where the initial ambitions become realistic. In the
meantime AI took on much more doable goals of working in less ambitious niches,
or accepting less-than-human results (as in translation)."

**What future do you see for natural language computing and/or general AI?**
"Continued progress in limited domain and approximate approaches (including with
speech). Very long term research is needed to get a handle on human-level
natural language."
