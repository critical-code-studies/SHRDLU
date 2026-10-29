# SHRDLU: A Critical Code Studies Reading

A static website reading **SHRDLU**, Terry Winograd's natural-language-understanding
program (MIT Artificial Intelligence Laboratory, 1968–70), as a cultural text.
A companion to the Critical Code Studies group's readings of *ELIZA* (1966) and
*Spacewar!* (1962).

**Status:** v0.3, live at <https://critical-code-studies.github.io/SHRDLU/>.

SHRDLU let a person type ordinary English and watch a simulated arm rearrange
coloured blocks and pyramids in a tabletop "blocks world". Written in MacLisp under
the ITS operating system, with its reasoning expressed in Micro-Planner, and parsed
by Winograd's procedural grammar PROGRAMMAR (after Halliday's systemic grammar), it
was the showpiece of symbolic AI. This site reads its code, its famous demonstration
dialogue, its microworld, and its critique.

## The site

Static HTML/CSS/JS, no framework, no build step. Served by GitHub Pages.

| Page | What it is |
|------|------------|
| `index.html` | Home: the argument, CCS framing, the machine and its world |
| `overview.html` | What SHRDLU was: the four components and what it could do |
| `dialogue.html` | The full 1970 demonstration dialogue, verbatim, with commentary |
| `blocks-world.html` | The microworld: objects, relations, what it leaves out |
| `the-name.html` | ETAOIN SHRDLU: the Linotype, *Mad*, Fredric Brown |
| `code.html` | The program: procedural semantics, PROGRAMMAR, Micro-Planner, reconstructions |
| `critique.html` | Demo or die, the scaling problem, Dreyfus, Winograd & Flores, the LLMs |
| `people.html` | Winograd and the MIT milieu |
| `timeline.html` | Chronology, 1942 to the present |
| `bibliography.html` | Sources (Harvard) |

`docs/` holds the canonical dialogue transcript and the shared page template.

## The research bench

`research/` is a bench for reading the SHRDLU source together, live at
<https://critical-code-studies.github.io/SHRDLU/research/> (not indexed). It runs
in the browser from static files, with no installation and no account needed to read.

**Using it.** Open the bench and choose a version in the picker at the top: the MIT
files as found on ITS, Winograd's Stanford distribution, or Eric Swenson's 2024
restoration (the January 1971 files and the CMU version of 1972 are known from the
record and not held). Then:

| Tab or menu | What it does |
|------|------------|
| Read | The version's MacLisp files, every defined name cross-referenced |
| Run | SHRDLU run in the browser from the version's own source: type to it, or play the 1970 dialogue as a test |
| Text, Program | The source as text (comments, hands and dates, names) and as a program (its parts, calls, Micro-Planner theorems, the dictionary) |
| Versions | The version's record, Collate (two versions side by side, as text or by definition), Genealogy, and the gaps in the record |
| Graphics | The blocks world and the machinery that draws and moves it |
| Findings, My notes | What the group has established, with evidence; and your own notes for writing, kept in your browser |
| Paratexts | The scans, documents, recordings and links around the program, for the crew |
| Implementations | Every known implementation of SHRDLU and of programs made after it: list, read, tree, matrix and compare |

Help ▾ in the bench has the guides: referencing and versions, the marks used for
repairs, annotating, codes and links, and the archives.

**Annotating** goes through the project's Hypothesis group. You need a Hypothesis
account, membership of the group, and your API token pasted into ⚙ Settings; Help ▸
Joining the annotation group sets out the steps. Without them, annotations are kept
as drafts in your browser.

**The archives.** *Implementations* is public: its catalogue and cleared files are in
`research/implementations/`. *Paratexts* is a private repository
(`critical-code-studies/shrdlu_paratexts`) for the crew, members of the GitHub team
TEAM SHRDLU. Each member pastes a fine-grained GitHub token of their own, limited to
that repository, into ⚙ Settings; the Paratexts tab gives the form and the steps, and bench-kit's [tokens and keys](https://critical-code-studies.github.io/bench-kit/#config) explains what each message means. A
token is kept in one browser only, and Safari clears what a site has stored after
seven days without a visit; a lost or expired token is replaced by making a new one
from the same form.

**Sources.** `source/original/` (Winograd's distribution) and `source/its/` (the MIT
files as found on ITS, and Swenson's restoration; see `source/its/PROVENANCE.md`).

**Built on bench-kit.** The bench's shared code is
[bench-kit](https://github.com/critical-code-studies/bench-kit), a submodule at
`research/kit`, which also runs the ELIZA and *Spacewar!* benches. Its site,
<https://critical-code-studies.github.io/bench-kit/>, is the general how-to: a
[quick start](https://critical-code-studies.github.io/bench-kit/#start) with its
prerequisites, [serving and testing a bench](https://critical-code-studies.github.io/bench-kit/#usage),
the [Hypothesis and GitHub tokens](https://critical-code-studies.github.io/bench-kit/#config),
and [troubleshooting](https://critical-code-studies.github.io/bench-kit/#trouble). The kit's
README documents each module and setting. Regenerate the
bench's site map with `node research/kit/tools/sitemap.js` (needs Chrome).

## House rules

- **Aesthetic:** the blocks world. A dark lab workbench seen on the DEC-340 display;
  primary-coloured cubes and pyramids in axonometric line-drawing; a teletype dialogue
  in which the person types lower case and SHRDLU answers in capitals. The stylesheet
  is linked with a cache-buster (`assets/css/site.css?v=N`); bump `N` when the CSS changes.

## Credits

Dialogue, source code, and the story of the name preserved by Terry Winograd.
The SHRDLU wordmark is set in the **Knight TV font**, the character generator of
the MIT AI Lab's Knight TV terminals that fronted the ITS operating system (MIT,
released under the GPL in 1999; via [larsbrinkhoff/Knight-TV-font](https://github.com/larsbrinkhoff/Knight-TV-font),
see `assets/fonts/NOTICE.md`).
A Critical Code Studies project co-led by David M. Berry (University of Sussex) and
Mark C. Marino (University of Southern California).
Part of [Critical Code Studies](https://critical-code-studies.github.io/).

## Licence

The code of the site and of the research bench (`research/`, with bench-kit in `research/kit`) is distributed under the GNU General Public License v3.0: see [`LICENSE`](LICENSE). The licence does not cover what the repository keeps from others: the SHRDLU sources in `source/` (Winograd's distribution, the ITS copies and the Java port in `javashrdlu.zip`), which stay under whatever terms their holders set, and the Knight TV font (GPL; see `assets/fonts/NOTICE.md`).

[![DOI](https://zenodo.org/badge/1275433763.svg)](https://doi.org/10.5281/zenodo.23763212)
