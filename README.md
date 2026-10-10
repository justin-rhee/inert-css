# inert-css

A build-time check for stylesheets with modifiers or utility classes: **pair your stylesheet with the class combinations that actually occur in your markup**, **resolve the cascade per property, including shorthand expansion and specificity**, and **report every declaration that is present, valid, and can never take effect**. Node 22 or newer, one runtime dependency (`postcss`).

It exists because a base rule's `border` shorthand quietly erased a modifier's `border-color`, and a button meant to read as a warning rendered plain grey. Every value in the modifier was correct, reviewed and shipped; it lost to a rule further down the same file that happened to touch the same element at the same specificity. A linter, a type checker and a full passing test suite all had nothing to say about it, because none of them ask which rule wins when two rules touch the same element.

## Use it if

- you maintain a stylesheet nobody has fully re-read in a while
- a component looks right in isolation and wrong once two classes land on the same element
- you write BEM-style modifiers or utility classes and want to know when one silently loses

## How it works

Give it a stylesheet and a list of class combinations that occur together on real elements, or let it collect that list from your markup with `collectCombos`:

```js
import { analyze } from "inert-css";

const findings = analyze({
  css: readFileSync("app/globals.css", "utf8"),
  combos: [["btn", "btn--danger"], ["muted", "micro"]],   // or use collectCombos()
});
```

It expands shorthands (`border` reaching `border-color`, `flex` reaching `flex-basis`, and so on), works out specificity, and for every property groups the declarations that could apply to the same element in the same state. When two declarations in a group disagree, the one that wins by specificity or source order is reported as the winner and the other as inert. Each finding carries the property, loser and winner (selector, line, value, specificity), the combo, a `reason` (`equal-specificity-source-order`, `lower-specificity`, or `narrower-rule-wins`), and a `severity`.

The interesting case is equal specificity: a modifier written after its base is the ordinary, working case; a base rule that happens to sit after its modifier is the bug above. Telling them apart needs to know whether the two classes ever occur apart, not just how they are named, which is what the corpus is for: if every element wearing the narrower class also wears the wider one, the narrower one is a modifier and beating its base is the point. Losing to higher specificity and to a narrower rule you depend on report as `low`; losing at equal specificity purely on source order is `high`, the case authors do not expect.

The line numbers in that example are real: they come from the fixture this package ships at `tests/fixtures/globals.css`. Run `node tests/run-on-real-stylesheet.mjs` to reproduce this exact finding, or `npm install && node --test tests/`, which asserts it; `tests/fixture.test.mjs` fails if this number ever drifts from what the fixture actually contains.

### Where this sits next to what already exists

PurgeCSS, UnCSS and Chrome Coverage find selectors that match nothing; ours match and their declarations merely lose. DevTools struck-through rules show overridden declarations, but runtime, one element at a time, human-driven. stylelint's `no-descending-specificity` does not consider individual properties and its own docs say it has no access to the HTML or DOM, so equal specificity, the case this tool targets, emits nothing there; its shorthand-overrides rule stays within one declaration block, which is exactly the shape of the bug above.

Prior art: CILLA (ICSE 2012) solved this dynamically by crawling a running application and watching real DOM states; its implementation is a decade stale. Hague et al. (OOPSLA 2015) is static but defines redundancy as unmatched selectors, never property cascade; bound on this reading: 10 of the paper's 50 pages, and a reading that finds property-level cascade reasoning in the rest would weaken the claim. The honest claim is narrow: the static, corpus-paired, build-time version is what's missing, and the prior art points at getting there without a headless browser.

## Install

This isn't on npm yet. Copy `src/index.js`, `src/cascade.js` and `src/corpus.js` into your project, keeping the three together in one folder: `index.js` imports the other two by relative path. Then install the one runtime dependency and import:

```bash
npm install postcss
```

```js
import { analyze, collectCombos } from "./index.js";
```

Verify it by running `node tests/run-on-real-stylesheet.mjs` with no argument; the bundled fixture must come back with 9 high, 1 low findings. Node 22 or newer; the test suite runs on Node 22 in CI.

## What it won't do

- class selectors only, for now; descendant and sibling combinators (`.a .b`, `.a > .b`) need DOM structure, so they are skipped and counted in the output rather than silently dropped
- compare across pseudo-state, which is part of an element's identity: `.btn:hover { background }` never competes with `.btn { background }`
- compare across `@media` and `@container`, which are separate contexts
- analyze a stylesheet using `@layer`, which inverts the ordering rules this tool assumes; it is refused by name, with the reason stated, rather than analyzed wrongly
- read dynamic class names statically: `clsx(...)`, ternaries and template interpolation are invisible. `collectCombos` counts what it could not read so the corpus never looks more complete than it is, and severity ranking withholds itself below 60% confidence instead of guessing at intent from an incomplete picture; detection never depends on this, ranking always does
- resolve `var()`, which is compared as written, so two different custom properties that resolve to the same color are reported as a difference
- report identical values, since a losing declaration whose value matches the winner is harmless duplication, not a defect

## How I tested it

The suite is 25 tests on Node's built-in test runner. `tests/real-defects.test.mjs` covers the three shapes that produced this tool (a shorthand erasing a longhand, a duplicated class re-imposing a layout value, two utility classes colliding), the noise cases a checker must not flag (a working modifier, a `:hover` rule, identical values, separate media contexts, `!important`), the refusals (`@layer`, selectors needing DOM structure), and the corpus-confidence gate that withholds severity when the markup cannot be trusted. `tests/corpus.test.mjs` covers the markup reader directly: static `class`/`className` attributes double- and single-quoted, a literal `className={"a b"}` counted as static, a `clsx()` call counted as dynamic, and an unreadable path skipped without crashing. Run it: `npm install`, then `node --test tests/`.

`tests/run-on-real-stylesheet.mjs` is a demonstration, not a test: it points the analyzer at a real-shaped stylesheet and markup tree but asserts nothing. An early draft shipped it that way, and gutting the markup reader entirely still left it printing a plausible "0 high, 0 low" at exit 0, exactly the failure a tool about silent, unenforced claims should not make. `tests/fixture.test.mjs` closes that gap by asserting the fixture's headline numbers, including the exact line the example cites, so that regression is now a red test rather than a quiet zero. Two mutations were used to check the suite can actually go red: gutting the markup reader turns 10 of the 25 tests red; removing the `border` shorthand's expansion turns 2 red. Both were reverted after the run.

With no argument, the acid test runs against the bundled fixture:

```
$ node tests/run-on-real-stylesheet.mjs
corpus: 4 class combinations from 4 files (1 of them unreadable: class names this tool cannot read statically)
skipped 0 selectors needing DOM structure, 0 at-rule blocks
findings: 9 high, 1 low
```

Three of the four markup files are static; one uses `clsx()` and is counted as unreadable rather than silently skipped, putting corpus confidence at 75%, above the 60% cutoff, so all nine high findings keep their ranking. `dynamic` counts files with at least one unreadable class expression, not the number of such expressions, and `tests/corpus.test.mjs` pins that directly. Point the script at a project of your own to see where confidence lands on a codebase that leans harder on computed class names; below 60% it still reports every override it finds and simply stops ranking them.

Two heuristics were tried for ranking intent before that confidence gate existed. A frequency count failed outright on the codebase that produced this tool: it flagged the large majority of working modifiers as bugs. A dependence check (if every element wearing the narrower class also wears the wider one, the narrower one is a modifier of it) is right in kind and is what `src/index.js` uses now, but on a mostly unreadable corpus it cannot do better than the corpus lets it. That is not a case for a third heuristic; it is the reason severity now withholds itself below 60% confidence instead of guessing.

## License

MIT. See [LICENSE](LICENSE). No warranty. Security notes and how to report a problem: [SECURITY.md](SECURITY.md).

This is one of a handful of small tools I have pulled out of my own work. I use it myself, so when something breaks I usually notice fast. If you run into an issue, or anything that looks off, open one. I read every one. More on my [GitHub profile](https://github.com/justin-rhee).
