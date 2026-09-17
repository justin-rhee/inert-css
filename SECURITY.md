# Security policy. inert-css

## Posture

inert-css is provided as-is, with NO WARRANTY (see LICENSE). It reads a stylesheet and a corpus of
class combinations you point it at, and reports which declarations lose to another rule in the
cascade. The library (`src/index.js`, `src/cascade.js`, `src/corpus.js`) only ever reads the file
contents and paths it is given; it does not execute your CSS, your markup, or anything derived from
them.

The one script that shells out is `tests/run-on-real-stylesheet.mjs`, the manual acid-test runner
meant to be pointed at a project of your own. It runs `find` against the directory you name, with
the path passed as an argument rather than interpolated into a shell string, but a `find` over an
untrusted directory tree is still a filesystem walk you did not fully choose. Only point it at a
project root you trust.

## Validation status

The bundled suite (`tests/real-defects.test.mjs`, `tests/corpus.test.mjs`, `tests/fixture.test.mjs`)
has been run and passes: 25 tests covering the three real defects that produced this tool, the noise
cases a checker must not flag (a working modifier, a `:hover` rule, identical values, separate media
contexts, `!important`), the refusals (`@layer`, selectors needing DOM structure), the
corpus-confidence gate on severity ranking, the markup-reading logic in `src/corpus.js` directly
(static and dynamic `className` shapes, an unreadable path), and the bundled fixture's own headline
numbers, including the exact line the README cites as a real finding. Run it yourself: `npm install`
to bring in the one runtime dependency (`postcss`), then `node --test tests/`.

Two mutations were used to check the suite can actually go red, not only stay green. Gutting
`collectCombos` in `src/corpus.js` to return no combinations turns 10 of 25 tests red; before
`tests/corpus.test.mjs` and `tests/fixture.test.mjs` existed, an independent review made exactly
this change and the suite stayed 13/13 green, because nothing imported that file directly. Removing
the `border` shorthand's expansion in `src/cascade.js` turns 2 of 25 tests red. Both mutations were
reverted after the run.

`tests/run-on-real-stylesheet.mjs` is a manual, human-readable acid test; `tests/fixture.test.mjs`
asserts its headline output so the demonstration cannot drift from the README without a red test.
Run `node tests/run-on-real-stylesheet.mjs` to see it work against the bundled fixture, or point it
at your own project's stylesheet and markup.

## Reporting a vulnerability

Report privately via a GitHub security advisory on this repository (Security tab, "Report a
vulnerability"). Please do not open a public issue for a suspected vulnerability. Give a reasonable
window for a fix first.
