/*
 * findings-data.js - this bench's own findings and how bench-kit's Findings (kit/findings.js)
 * shows them: the list, its categories and its texts. Loaded before the kit.
 */
(function (root) {
  'use strict';
  var B = root.SW.BENCH;

  // Evidence is either a line, found by pattern in a version's assembled
  // source (so it survives renumbering), or a tape image in sources/.
  B.findings = [
    { no: 'F1', kind: 'Damage', cat: 'text', level: 'key', title: 'Winograd’s Stanford copy of smspec carries a block of corrupted characters, and a broken SMPOSS2',
      text: 'Between lines 712 and 771 of smspec in the Stanford distribution, characters are corrupted that the ITS copy (smspec.94) holds intact: “THEN” reads “P^HEN”, “NO NOUN HEAD” reads “NK NCUJ HE@^D”, “REVERSE” reads “REVE@SE”, and control characters (backspace, NUL) sit in the text. The definition of SMPOSS2, which the possessive specialist SMPOSS calls, is named SMPORS2, its variable list is garbled (“SL^COL^P” for SMCOMP) and a parenthesis is lost, so from there the file no longer reads as whole forms. A run of the Stanford copy would need this block taken from the ITS text. Exchange 18 of the dialogue, “the tallest pyramid’s support”, is a possessive.',
      ev: [{ v: 'stanford', re: /SMPORS2/, label: 'the damaged definition' }, { v: 'mit', re: /^\(DEFUN SMPOSS2/, label: 'the ITS text' }, { v: 'stanford', tab: 'analyse', lens: 8, label: 'Absence: the damage listed' }] },
    { no: 'F2', kind: 'Collation', cat: 'versions', level: 'key', title: 'The Stanford distribution and the MIT files on ITS carry the same text',
      text: 'Collated file by file, the program files the two share differ only in end-of-file page marks and blank lines, in three places where a bare carriage return of the ITS text became a line break (F8), in plnr laid out with other indentation (the same words, once spacing is set aside), and in the damaged block of smspec (F1). The ITS version numbers match the 1987 listing of MC:SHRDLU; in Winograd’s file-note (PLNR 182, GRAMAR 28, SYSCOM 180, BLOCKP 3 and the rest) except SMSPEC, listed as 96 but held on ITS as smspec.94, with the same text. The check below repeats the collation on every visit.',
      ev: [{ v: 'stanford', re: /^MC: SHRDLU; \* \*/, label: 'the 1987 listing in file-note' }, { v: 'mit', tab: 'compare', label: 'Compare' }] },
    { no: 'F3', kind: 'Anomaly', cat: 'text', level: 'minor', title: 'Two stray closing parentheses, in show and in the demonstration script',
      text: 'A closing parenthesis with nothing open ends a form near line 1026 of show, and line 31 of the demonstration script (DEMO FLICK), in both the ITS and the Stanford copies. The MacLisp reader would have read past it; it is in the text as held.',
      ev: [{ v: 'mit', re: /^\(DEFUN HELP NIL/, label: 'show, after the stray parenthesis' }, { v: 'mit', re: /\(DISME\)\(FRAME WAIT\)\(DTHRU\)\)/, label: 'demo.flick:31' }] },
    { no: 'F4', kind: 'Record', cat: 'versions', level: 'notable', title: 'The 1976 demonstration program replays a script; it does not run SHRDLU',
      text: 'TWDEMO, dated 6 May 1976 on MC, was added to the PDP-10/its repository in 2019 by Lars Brinkhoff as “a program that just replays the dialogue in SHRDLU; DEMO FLICK”. Its script sets the dialogue’s text between @ signs and interleaves display commands that move the arm to fixed coordinates: (MOVETO 100 340 500), (GRASP (QUOTE :B7)), (UNGRASP). What TWDEMO shows is the dialogue drawn on the 340 with none of the parser, the semantics or Micro-Planner running.',
      ev: [{ v: 'mit', re: /PICK UP A BIG RED BLOCK/, label: 'the first exchange in the script' }, { v: 'mit', re: /GRASP \(QUOTE :B7\)/, label: 'the arm told where to go' }] },
    { no: 'F5', kind: 'Restoration', cat: 'versions', level: 'notable', title: 'The 2024 restoration writes Micro-Planner’s # as !',
      text: 'In the MIT files as found, 1,403 names in code begin with #, Micro-Planner’s mark for the predicates of the blocks world (#SUPPORT, #PUT, #COLOR). In Eric Swenson’s restoration 1,136 begin with ! instead (three # remain): (DEFS !PART …) for (DEFS #PART …). His commit messages do not say why; later MacLisps read # as a macro character, which would account for it.',
      ev: [{ v: 'mit', re: /^\(DEFS #PART/, label: '#PART as found' }, { v: 'ejs', re: /^\(DEFS !PART/, label: '!PART restored' }] },
    { no: 'F6', kind: 'Record', cat: 'hands', level: 'minor', title: '“Performed on graduation day, June 2, 1972 by JMH”',
      text: 'A comment beside the dictionary entry for #PART in dictio records who made it and when: “PERFORMED ON GRADUATION DAY, JUNE 2, 1972 BY JMH”. JMH is not yet identified. Jeff Hill, one of the four the CMU manual names as revising the program, is named in gramar as the author of a check on quoted subjects “put in by Jeff Hill in the spring of 1972” and later deleted; whether he is JMH the record does not settle.',
      ev: [{ v: 'mit', re: /GRADUATION DAY/, label: 'the comment' }, { v: 'mit', re: /Jeff Hill/, label: 'Jeff Hill in gramar' }] },
    { no: 'F7', kind: 'Record', cat: 'run', level: 'key', title: 'The restored program “fails at some things that the DEMO apparently succeeded in doing”',
      text: 'Eric Swenson’s note on restoring SHRDLU to run on a later MacLisp (22 July 2024): “Without the Type 340 display, SHRDLU should work reasonably well. It fails at some things that the DEMO apparently succeeded in doing. It is not clear why, but likely the demo was created at one point, and the SHRDLU sources were updated after that point, breaking some things.” The Run view will test the 42 exchanges against each version held.',
      ev: [{ v: 'ejs', tab: 'about', label: 'the restoration’s record' }, { v: 'ejs', tab: 'run', label: 'the dialogue as the test' }] },
    { no: 'F8', kind: 'Damage', cat: 'text', level: 'key', title: 'Carriage returns became line breaks in the Stanford copy, turning two comments into code',
      text: 'The ITS files hold a few bare carriage returns (control-M without a line feed): at the head of gramar, before a line of the demonstration script, and inside two comments in smutil (“RETURNED JUST ^MTHE WAY IT WAS”, “RETRIEVES THE ^MAPPROPRIATE RECOMMENDATION”). MacLisp read such a character as part of the comment. In Winograd’s Stanford copy every one of them is a line break, so in smutil the rest of each comment stands on a line of its own without a semicolon and is read as code: THE, WAY, IT and WAS become variables the program tries to evaluate. On the bench’s interpreter the Stanford copy halts on “THE” in its first sentence unless the two lines are rejoined (repairs S-T2 and S-T3). The conversion from ITS to Unix text that produced the Stanford files evidently treated a lone carriage return as the end of a line.',
      ev: [{ v: 'stanford', re: /^THE WAY IT WAS\./, label: 'the comment broken into code' }, { v: 'mit', re: /RETURNED JUST \rTHE WAY IT WAS/, label: 'the ITS line, whole' }, { v: 'stanford', re: /^APPROPRIATE RECOMMENDATION USING/, label: 'the second break' }] },
    { no: 'F9', kind: 'Anomaly', cat: 'grammar', level: 'notable', title: 'The word BOTH calls a function that no surviving file defines',
      text: 'In the MIT and Stanford copies the dictionary entry for BOTH, a procedure as SHRDLU’s dictionary entries can be, calls (** N NW (EQ (WORD PTW) (CAR A)) NW). No file of either copy defines **, so on the bench a sentence with “both” halts: exchange 13 of the dialogue, “will you please stack up both of the red blocks and either a green cube or a pyramid?”. Swenson’s restoration calls move-ptw there, PROGRAMMAR’s function for moving the word pointer, which takes arguments of just this shape. Whether ** was defined in a file the record does not keep, or the entry was left broken, is not known. The bench runs the older copies with the restoration’s reading of this line (repairs I-T1 and S-T4).',
      ev: [{ v: 'mit', re: /\(\*\* N/, label: 'the call to **' }, { v: 'ejs', re: /\(move-ptw N/, label: 'the restoration’s reading' }] }

  ];
  // A category is found from the words of a finding (the one with most matches), unless a cat: tag sets it
  B.findingCats = [
    ['text', 'Text and damage', /\b(corrupt\w*|damage\w*|characters?|typos?|comments?|parenthes\w*|spellings?|transcri\w*)\b/gi],
    ['grammar', 'Grammar and parsing', /\b(grammar|programmar|pars\w*|syntax|clauses?|noun groups?|systemic|dictionary|words?)\b/gi],
    ['semantics', 'Semantics and answering', /\b(semantic\w*|specialists?|meanings?|answer\w*|possessives?|referents?|pronouns?)\b/gi],
    ['planner', 'Micro-Planner and the blocks world', /\b(planner|micro-planner|theorems?|thgoal|assert\w*|goals?|blocks?|pyramids?|arm|hand|grasp\w*)\b/gi],
    ['run', 'Running and the demonstration', /\b(runs?|running|demo\w*|dialogue|exchanges?|display|340|emulat\w*)\b/gi],
    ['hands', 'Hands and dates', /\b(initials|hands?|jmh|ddm|ejs|winograd|mcdonald|hill|card|rubin|dated?)\b/gi],
    ['versions', 'Versions and genealogy', /\b(versions?|witness\w*|copies|copy|collat\w*|restor\w*|its|stanford|mit|listing)\b/gi]
  ];
  B.findingsTitle = 'SHRDLU findings';
  B.findingsSubtitle = 'What the sources and their collation show';
  B.findingsIntro = 'What the group and the bench have established about the SHRDLU sources, each with its evidence one click away. Crew: the group’s findings, by member. Bench: the bench’s own, with the Stanford and ITS copies collated afresh.';
  B.findingsSide = 'bench';
  B.findingsRecheck = 'Collate the copies again, and fetch the group’s findings';
})(typeof window !== 'undefined' ? window : globalThis);
