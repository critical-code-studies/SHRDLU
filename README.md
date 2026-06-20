# SHRDLU: A Critical Code Studies Reading

A static website reading **SHRDLU**, Terry Winograd's natural-language-understanding
program (MIT Artificial Intelligence Laboratory, 1968–70), as a cultural text.
A companion to the Critical Code Studies group's readings of *ELIZA* (1966) and
*Spacewar!* (1962).

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
A Critical Code Studies project led by David M. Berry (University of Sussex).
</content>
