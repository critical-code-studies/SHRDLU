# Winograd's SHRDLU source (preserved copy)

These six files are **Terry Winograd's own source distribution for SHRDLU**, the
natural-language-understanding program he wrote at the MIT Artificial
Intelligence Laboratory, 1968 to 1970:

| File | Size | What it is |
|------|------|------------|
| `README` | 4.6K | Winograd's own description of the distribution |
| `gramar` | 69K | PROGRAMMAR, the procedural systemic grammar (`PDEFINE` rules) |
| `lisp` | 48K | the MacLisp support code |
| `morpho` | 10K | morphological analysis |
| `parser` | 11K | the parser |
| `smspec` | 33K | the semantic specialists |

The reasoning is expressed in Micro-Planner; the program was written in MacLisp
under the ITS operating system.

## Where this came from

Winograd's homepage moved from `hci.stanford.edu/winograd/...` to a Google Sites
page (`sites.google.com/view/terrywinogradhomepage`), and the SHRDLU subpages
were **not** carried over: the old URLs now 301-redirect to a homepage on which
`/shrdlu/` and `/shrdlu/code` return 404. His curated listing is therefore no
longer reachable on the live web.

This copy was retrieved from the **Internet Archive Wayback Machine**, capture
**2015-04-17** (`web/20150417125243`) of
`http://hci.stanford.edu/winograd/shrdlu/code/`. The files are originally dated
**16 September 1997**. They are preserved here, unmodified, for safekeeping and
for the project's Critical Code Studies reading.

## Authority and related copies

- This is the **author's own** distribution, the highest-provenance copy.
- The full source in its original **ITS** form (more files, original ITS
  filenames) is preserved in the ITS reconstruction project:
  <https://github.com/PDP-10/its/tree/master/src/shrdlu> (assemblable under
  emulated ITS).
- A **minimally modified** copy that loads in modern Common Lisp (`clisp`) is at
  <https://github.com/penlu/shrdlu> (expect errors; it is 1972 code).
- A mirror of the Stanford listing is at <https://github.com/policecar/shrdlu>.

SHRDLU is Terry Winograd's work; these files are reproduced here for scholarly
and archival purposes.
