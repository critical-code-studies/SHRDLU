# Changelog: the research bench

Changes to the SHRDLU research bench (`research/`). The bench keeps its own version numbers, raised by 0.0.1 with each change; this file records the versions published, newest first. Changes to the website around it are in the repository's commit history.

## 0.1.63 (2026-10-06)

From the _Spacewar!_ bench (1.18.5 to 1.18.34).

### Paratexts

- **A Paratexts tab.** The scans, clippings, photographs and documents around the program, kept for the crew in a private GitHub repository (critical-code-studies/shrdlu_paratexts): a catalogue of records and the files, each named by its code (P-XXXXX). The bench reads and writes it through GitHub's API with each member's own token, limited to that repository (⚙ Settings, or step 5 of the joining guide). Every change is a commit signed with your initials.
- Collections, nested like folders; a grid of cards or a list with a column for each field; sorting, finding, selecting several; withdrawing with a reason, and bringing back.
- Each record: title, date made, creator, source, the archive holding the original and its reference, rights, accession date, description, tags, versions and references, with the rest of Dublin Core under More metadata. Records export as CSL-JSON or RIS for Zotero, or as Dublin Core (oai_dc XML).
- Ratings (one to three stars, gold up to the crew's average), reactions and comments; two paratexts side by side, zooming and panning together; **Cited in**, the annotations, findings and notes that write an item's code.
- The catalogue and files are kept in this browser's cache after the first time; taking the token out of Settings clears it.

### Codes and links

- Each annotation has a code that does not change (A- for an annotation, R- for a reply), shown on it; click to copy.
- **#** in the top bar, or `?code=` in a link, goes to what a code names: an annotation or reply, a finding of the crew's (C-) or the bench's (F2), a note in My notes (initials-N), or a paratext (P-).
- A code written in an annotation, note or finding becomes a link; a paratext's reads as **Paratext:** and its title, and opens read-only where you are.

### Annotations, findings and notes

- Unsaved annotations, replies and edits are not lost to Esc, Cancel or leaving the page: Cancel asks first, and the annotation box keeps what you were writing in this browser until it is saved or discarded.
- My notes: each note a card, coloured by kind; notes shared to Findings kept apart under **Shared**.
- Findings show their status from the group's reactions (🔓 open, 💡 help wanted, ✅ resolved) and filter by it. A finding taller than the window is shown from its start.
- ✉ What's new puts replies to your own annotations and findings first.

### Joining

- An invitation link (`join.html#ID`) sets the annotation group for whoever opens it, and opens the joining guide.
- The joining guide is a form: initials, name, group and token entered and tested in place, with a fifth step for the paratexts' GitHub token.
- Help ▸ Codes, links and sharing, and Help ▸ Paratexts.

## 0.1.61 (2026-09-30)

- **Program ▸ Functional overview**, as on the _Spacewar!_ bench: an exchange recorded. The program runs on its own copy, a sentence is typed (exchange 1 unless you type another), and every named Lisp function is recorded as it is entered and left. Shown: the parts of the program in time (the file of the innermost function, gathered as the loader gathers them), the steps each part takes, and the functions with their calls, steps with and without what they call, and callers, each linked to Read.

## 0.1.60 (2026-09-30)

The Graphics menu filled out:

- **What is on what**: the Planner asked for its SUPPORT and CONTAIN assertions, drawn as a side view.
- **Finding space**: FINDSPACE's own random tries, as GROW widens them; the surface from above, the place chosen.
- **The projection**: GP-PROJECT with a point to move and the sums shown.
- **Hidden lines**: graphf's own drawing beside the solid view of the same scene.
- **The display list**: the 340's items named from graphf's tables, lit on click, and the program's last calls to the display.
- **The event memory**: EVENTLIST in time, each event under the one it served.
- **The goal tree**: the same events as the tree SHRDLU climbs to answer why.
- **The parse**: the last sentence's parse drawn as a tree.

The views that need an exchange read the program in Run, or run exchange 1 themselves. The session evaluates Lisp in SHRDLU's break loop (^X, then GO).

## 0.1.56 (2026-09-30)

- The crane: one move leg by leg in three dimensions, the arms along a leg as GP-DISMOTION draws them, and a hand and block linked by DISLINK.
- The hand's path: with no exchange run in Run, the bench runs exchange 1 on its own copy and draws that.

## 0.1.53 (2026-09-30)

- **Graphics ▸ The microworld.** Click an object, then where it is to go: the bench gives SHRDLU the goal as it gives itself a command, `(THVAL2 NIL '(THGOAL (!PUTON A B) (THUSE TC-PUTON)))`, from its break loop. Pick up, clear its top and get rid of are there too. Each goal is logged with what came of it: done, refused, or stopped where one of the program's own checks broke into its break loop (TE-SUPP, for one).

## 0.1.52 (2026-09-30)

- **A Graphics menu**, laid out as on the _Spacewar!_ bench: the objects (from DISPLAY-AS and ATABLE, turned with the mouse or as GP-PROJECT puts them on the 340), the hand in 1970 and after, the crane (GP-MOVEHAND's four legs, GP-DISMOTION's steps, GRASP and UNGRASP), and the hand's path.
- Run: **1970 Hand** draws the film's gripper at the hand's place, in three dimensions. The teletype's suggestions show only as grey text after the cursor.
- The joining guide shows the invitation card.

## 0.1.43 (2026-09-30)

- `join.html`, the link the joining guide shares, carries its own card: AN INVITATION · THE RESEARCH BENCH, RSVP, over the TC-PUT theorem and the blocks world as the 340 draws it.
- ⧉ on the display copies a snapshot of the screen as an image.

## 0.1.42 (2026-09-30)

- **Solid** rebuilt from graphf's own tables (GP-SURFACE, DISPLAY-AS): faces turned to the viewer filled and outlined, objects ordered by the plane that separates them. The hand in motion is placed in three dimensions from GP-MOVEHAND's four legs, and a held object keeps its offset from its handle, so a block carried behind another stays behind it.
- **Faces**: the solid shapes shaded, lit from above and in front.

## 0.1.41 (2026-09-30)

- Winograd's Stanford copy on the 340. It holds no display code (on ITS that was GRAPHF FASL, not held), so with the 340 on, graphf is supplied from the MIT copy (repairs S-L3, S-T5, S-F2). With the 340 off the copy runs as before.
- The teletype offers whole sentences of the 1970 dialogue; Up goes back through the lines typed, Down comes back and on into the suggestions.

## 0.1.38 (2026-09-30)

- Run runs the version chosen in the top bar, and starts afresh when that changes.

## 0.1.37 (2026-09-30)

- **Dialogue**: the last two exchanges at the top of the 340 screen in capitals, as the 1970 film shows them (the surviving code writes only the objects' names there).
- The teletype keeps a selection when clicked; ⧉ copies the whole transcript.
- Tab completes a sentence of the dialogue or a word from SHRDLU's own dictionary.

## 0.1.32 (2026-09-30)

- The Deep dive in small type: one line a variable, its description in the hover, the groups in columns.

## 0.1.28 (2026-09-30)

- Run's About button reads About….

## 0.1.27 (2026-09-30)

- **Deep dive** under the teletype: the variables and structures SHRDLU keeps, read from the running interpreter each time it waits (the sentence and its parse, the meaning, the world, the event memory, time by stage, and variables you add), with what changed in the last exchange marked.
- The teletype takes typing at the cursor, as a terminal does.
- Stop lets a display operation under way finish before it quits; quitting mid-move had left two arms.
- **Labels** can be hidden; the 1970 film shows none.

## 0.1.23 (2026-09-30)

- **Stop** quits what SHRDLU is doing at once, as ^G did on ITS, and SHRDLU answers READY.
- **»** types the next exchange of the 1970 dialogue and waits; **«** goes back one, starting afresh and replaying the exchanges before (a run is repeatable: RANDOM seeded, RUNTIME counting steps).
- The Run toolbar's status keeps to one line, so the teletype and display no longer jump.

## 0.1.20 (2026-09-30)

- The dialogue test and About open as dialogs from Run's toolbar; the display takes the side column, and ⇄ puts it on either side.
- **Solid**: objects hide what stands behind them; what is in the box shows faintly through its walls.
- The arm's speed: Original (the SLEEPs MOVETO asks for), ×2, ×3 or Instant.

## 0.1.17 (2026-09-30)

- Return sends CR LF. The held files define CARRET as the line feed, so words typed on separate lines had run together (HELLOPICK).
- Run notes a line typed without a full stop, question mark or exclamation mark, and when SHRDLU asks for a line feed.

## 0.1.15 (2026-09-30)

- The gold squiggle runs under a repaired line's code and comment. A grey squiggle marks an uncertain reading left as found. ALTMODE (^[) is no longer counted as damage.
- Run: **Colour** draws each object in the colour its label names. The 340 drew in one colour; the switch is off by default.

## 0.1.13 (2026-09-30)

- The kintsugi squiggle as on the _Spacewar!_ bench, measured in em so that it follows the text size.

## 0.1.12 (2026-09-30)

- Each repaired line underlined in a wavy gold line; the characters read otherwise in a gold wash.

## 0.1.9 (2026-09-30)

- Gold for kintsugi alone: the bench's accent moves to orchid (plum on the light themes).

## 0.1.7 (2026-09-30)

- The repairs bar in one row of gold icons, labels in the hovers.

## 0.1.6 (2026-09-30)

- ◆ folds down a repairs bar under Read's toolbar: step through the repairs, show only repaired lines, the evidence, keep, the cards.

## 0.1.5 (2026-09-30)

- **The DEC 340 display** in Run: the DIS* calls of MacLisp's display slave, read from slave.11, graphf, graphf.init and the Logo TURTLE. The MIT copy draws its scene with GP-INITIAL (repair I-F2) after a damaged number in graphf.3 line 13 is read as the restoration has it (I-T2).
- Kintsugi in the code as on the _Spacewar!_ bench.
- Reconstruction cards to copy, export (Word, Markdown, PNG, SVG) and keep in My notes.

## 0.1.3 (2026-09-30)

- Read's repairs menu (‹ ◆ n ⌄ ›).
- Versions ▸ How the files were stored: the machines, the ITS file system, disks and backup tapes, and the path of each copy.

## 0.1.2 (2026-09-30)

- The repairs register as on the _Spacewar!_ bench: each repair with its mend, author and date.
- Help ▸ Reconstruction cards, and Help ▸ What you should read, led by Berry (2025).

## 0.1.1 (2026-09-30)

- **SHRDLU runs in the browser**, on a MacLisp interpreter written for the bench (`js/maclisp.js`), in two dialects: MacLisp 1.6 for the MIT and Stanford files, and the later MacLisp of Swenson's restoration.
- `js/repairs.js` records everything the bench does to make a version run, after "Digital Ruins and Critical Code Studies": minimum intervention, reversible, documented, the held files never altered.
- Run is a teletype: type to SHRDLU, or play the 1970 dialogue as a test.
- Findings F8 and F9; F2 corrected.

## 0.1 (2026-09-30)

- The bench, built on the _Spacewar!_ research bench, with a MacLisp 1.6 reader and indexer (`js/lisp.js`) in place of its PDP-1 layer.
- Versions: the MIT files as recovered on ITS, Winograd's Stanford distribution, and Eric Swenson's 2024 restoration, with the January 1971 files and the CMU C1 version recorded as lost.
- Read, the lenses, Compare, Genealogy, Findings, annotations through the project's Hypothesis group, My notes and exports.
