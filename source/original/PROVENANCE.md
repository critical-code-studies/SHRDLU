# SHRDLU original source (preserved copy)

`code/` is **Terry Winograd's complete source distribution for SHRDLU**, the
natural-language-understanding program he wrote at the MIT Artificial
Intelligence Laboratory, 1968 to 1970. `code.tar` is the same set as a single
archive, exactly as supplied.

It is the full 33-file `code` directory (not the partial set), with the files
dated **16 September 1997**. The program is written in MacLisp under the ITS
operating system, with its reasoning expressed in Micro-Planner. Winograd's own
`README`, `file-note` and `files` in this directory describe the contents;
the main modules include:

- `progmr` / `gramar` / `cgram`: PROGRAMMAR and the systemic grammar
- `parser`, `morpho`, `dictio`: parsing, morphology, the dictionary
- `smspec` / `smass` / `smutil`: the semantic specialists
- `plnr`: Micro-Planner
- `blockl` / `blockp`: the blocks world
- `newans`, `show`, `ginter`: answering, display, interaction
- `lisp`, `macros`, `syscom`, `setup`, `loader`, `init`, `fasl`: support and build

## Why this is kept here

Winograd's homepage moved from `hci.stanford.edu/winograd/...` to a Google Sites
page (`sites.google.com/view/terrywinogradhomepage`), and the SHRDLU subpages
were **not** carried over: the old URLs now 301-redirect to a homepage on which
`/shrdlu/` and `/shrdlu/code` return 404. His curated listing is therefore no
longer reachable on the live web. This copy is preserved here, unmodified, for
safekeeping and for the project's Critical Code Studies reading.

## Related copies

- The full source in its original **ITS** form (original ITS filenames),
  assemblable under emulated ITS:
  <https://github.com/PDP-10/its/tree/master/src/shrdlu>
- A **minimally modified** copy that loads in modern Common Lisp (`clisp`;
  expect errors, it is 1972 code): <https://github.com/penlu/shrdlu>
- A mirror of the Stanford listing: <https://github.com/policecar/shrdlu>
- The Stanford listing itself survives only on the Internet Archive Wayback
  Machine (e.g. capture `web/20150417125243` of
  `hci.stanford.edu/winograd/shrdlu/code/`).

SHRDLU is Terry Winograd's work; these files are reproduced here for scholarly
and archival purposes.
