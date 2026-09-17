# inert-css

[![tests](https://github.com/justin-rhee/inert-css/actions/workflows/test.yml/badge.svg)](https://github.com/justin-rhee/inert-css/actions/workflows/test.yml)

A base rule's `border` shorthand quietly erased a modifier's `border-color`, and a button meant to
read as a warning rendered plain grey instead. Every value in the modifier was correct: right
property, right color, reviewed and shipped. It lost anyway, to a rule further down the same file
that happened to touch the same element at the same specificity.

A linter, a type checker and a full passing test suite all had nothing to say about it, because
none of them ask which rule wins when two rules touch the same element. If you write CSS with
modifiers or utility classes, you have this risk whether or not it has bitten you yet.

So this is inert-css: a build-time check that pairs your stylesheet with the class combinations
that actually occur in your markup, and reports every declaration that is present, valid, and can
never take effect.

## Use it if

- you maintain a stylesheet nobody has fully re-read in a while
- a component looks right in isolation and wrong once two classes land on the same element
- your linter and your type checker have never once caught a cascade bug
- you write BEM-style modifiers or utility classes and want to know when one silently loses

## How it works

Give it a stylesheet and a list of class combinations that occur together on real elements, or let
it collect that list from your markup with `collectCombos`. It expands shorthands (`border` reaching
`border-color`, `flex` reaching `flex-basis`, and so on), works out specificity, and for every
property groups the declarations that could apply to the same element in the same state. When two
declarations in a group disagree, the one that wins by specificity or source order is reported as
the winner and the other as inert.

The interesting case is equal specificity: a modifier written after its base is the ordinary,
working case; a base rule that happens to sit after its modifier is the bug above. Telling them
apart needs to know whether the two classes ever occur apart, not just how they are named, which is
what the corpus is for: if every element wearing the narrower class also wears the wider one, the
narrower one is a modifier and beating its base is the point.

```js
import { analyze } from "inert-css";

const findings = analyze({
  css: readFileSync("app/globals.css", "utf8"),
  combos: [["btn", "btn--danger"], ["muted", "micro"]],   // or use collectCombos()
});
```

Each finding:

```js
{
  property: "color",
  loser:  { selector: ".btn--danger", line: 12, value: "var(--bad)", specificity: [0, 1, 0] },
  winner: { selector: ".btn",         line: 28, value: "var(--ink)", specificity: [0, 1, 0] },
  combo: ["btn", "btn--danger"],
  reason: "equal-specificity-source-order",   // or "lower-specificity", or "narrower-rule-wins"
  severity: "high",                            // "low" for the other two reasons
}
```

(the line numbers above are real: they come from the fixture this package ships at
`tests/fixtures/globals.css`. Run `node tests/run-on-real-stylesheet.mjs` to reproduce this exact
finding, or `npm install && node --test tests/`, which asserts it: `tests/fixture.test.mjs` fails if
this number ever drifts from what the fixture actually contains.)

Losing to *higher* specificity is ordinary cascade behavior and usually intended, so it reports as
`low`. So is losing at equal specificity to a *narrower* rule you depend on, such as a modifier
correctly beating its base (`reason: "narrower-rule-wins"`); the fixture's own `.btn--accent` finding
is this case. Losing to *equal* specificity purely on source order, with no such dependence, is the
case authors do not expect, and it is where the bug above sat. `severity` becomes `unranked` when
the corpus is too incomplete to trust an intent call; see "What it won't do".

### Where this sits next to what already exists

| Tool | What it finds | Why it isn't this |
|---|---|---|
| PurgeCSS, UnCSS, Chrome Coverage | selectors that match nothing | ours match; their declarations merely lose |
| DevTools struck-through rules | overridden declarations | runtime, one element at a time, human-driven |
| stylelint `no-descending-specificity` | a lower-specificity selector after a higher one | its own docs say it "does not have access to the HTML or DOM" and "doesn't consider individual properties." Equal specificity, the case this tool targets, is not descending, so it emits nothing there |
| stylelint `declaration-block-no-shorthand-property-overrides` | shorthand clobbering longhand | within one declaration block only; its own docs show two separate rules with the same selector as a non-problem, which is exactly the shape of the bug above |
| stylelint `declaration-block-no-redundant-longhand-properties` | longhands that could be a shorthand | single block, different defect |
| postcss-deadcss | selectors unused in production traffic | the PurgeCSS category |
| Project Wallace, Parker, CSS Stats | aggregate metrics, specificity graphs | reporting, not per-declaration effect |

### Prior art

**CILLA** (Mesbah & Mirshokraie, *Automated Analysis of CSS Rules to Support Style Maintenance*,
ICSE 2012) solved this dynamically, by crawling a running application and watching real DOM states;
it explicitly detects overridden declaration properties. Its implementation (`saltlab/cilla`) has 8
commits and was last touched in February 2014.

**Hague et al.**, *Detecting Redundant CSS Rules in HTML5 Applications: A Tree-Rewriting Approach*
(OOPSLA 2015), is static and aimed at a different defect: its formal definition of redundancy is
selectors "not matched in postR(T₀)", the unmatched-selector category, never property cascade.
Its documents are modeled as trees whose node labels are sets of classes, with reachability computed
symbolically, which is a static solution to knowing which classes co-occur, exactly what this
tool's corpus step needs, aimed at a different problem. Bound on this reading: 10 of the paper's 50
pages (the introduction and the complete formal model); sections 4 to 7 are unread, and a reading
that finds property-level cascade reasoning there would weaken the claim below.

So the honest claim is narrow: dynamic, whole-application co-application analysis existed and its
implementation is a decade stale. The static, corpus-paired, build-time version is what's missing,
and this prior art points at how to get there without a headless browser: model the markup
statically instead of resolving classes at runtime, which is exactly what `collectCombos` already
does for the classes it can read.

## Install

This isn't on npm yet. Copy `src/index.js`, `src/cascade.js` and `src/corpus.js` into your project,
keeping the three together in one folder: `index.js` imports the other two by relative path. Then
install the one runtime dependency:

```bash
npm install postcss
```

```js
import { analyze, collectCombos } from "./index.js";
```

Node 22 or newer; the test suite runs on Node 22 in CI.

## What it won't do

Class selectors only, for now. Descendant and sibling combinators (`.a .b`, `.a > .b`) need DOM
structure, not just co-occurring class sets, so they are skipped and counted in the output rather
than silently dropped.

Pseudo-state is part of an element's identity. `.btn:hover { background }` never competes with
`.btn { background }`; a state is only compared against itself and the base.

`@media` and `@container` are separate contexts. Declarations in different contexts never compete.

`@layer` inverts the ordering rules this tool assumes, so a stylesheet using it is refused by name,
with the reason stated, rather than analyzed wrongly.

Dynamic class names are invisible. `clsx(...)`, ternaries and template interpolation cannot be read
statically. `collectCombos` counts what it could not read so the corpus never looks more complete
than it is, and severity ranking withholds itself below 60% confidence (enforced in
`src/index.js`) instead of guessing at intent from an incomplete picture. Detection never depends on
this; ranking always does.

`var()` is compared as written. Two different custom properties that resolve to the same color are
reported as a difference; resolving that needs a browser.

Identical values are not reported. A losing declaration whose value matches the winner is harmless
duplication, not a defect.

## How I tested it

The suite is 25 tests on Node's built-in test runner. `tests/real-defects.test.mjs` covers the three
shapes that produced this tool (a shorthand erasing a longhand, a duplicated class re-imposing a
layout value, two utility classes colliding), the noise cases a checker must not flag (a working
modifier, a `:hover` rule, identical values, separate media contexts, `!important`), the refusals
(`@layer`, selectors needing DOM structure), and the corpus-confidence gate that withholds severity
when the markup cannot be trusted. `tests/corpus.test.mjs` covers the markup reader directly: static
`class`/`className` attributes double- and single-quoted, a literal `className={"a b"}` counted as
static, a `clsx()` call counted as dynamic, and an unreadable path skipped without crashing. Run it:
`npm install` (the one runtime dependency, `postcss`, is not vendored), then `node --test tests/`.

That corpus-reader file matters enough to call out. `tests/run-on-real-stylesheet.mjs` is a
human-readable demonstration, not a test: it points the analyzer at a real-shaped stylesheet and a
real-shaped markup tree instead of a hand-picked combos array, but it asserts nothing about its own
output. An early draft shipped it that way, and it is exactly the failure a tool about silent,
unenforced claims should not make: gutting the markup reader entirely still left it printing a
plausible "0 high, 0 low" at exit 0. `tests/fixture.test.mjs` closes that gap by asserting the
fixture's headline numbers, including the exact line the example above cites, so that regression is
now a red test rather than a quiet zero. Two mutations were used to check the suite can actually go
red: gutting the markup reader turns 10 of the 25 tests red; removing the `border` shorthand's
expansion turns 2 red. Both were reverted after the run.

With no argument, the acid test runs against the fixture bundled at `tests/fixtures/`:

```
$ node tests/run-on-real-stylesheet.mjs
corpus: 4 class combinations from 4 files (1 of them unreadable: class names this tool cannot read statically)
skipped 0 selectors needing DOM structure, 0 at-rule blocks
findings: 9 high, 1 low
```

Three of the four markup files it reads are static; one uses `clsx()` and is counted as unreadable
rather than silently skipped, which puts corpus confidence at 75%, above the 60% cutoff, so all nine
high findings keep their ranking. `dynamic` counts files with at least one unreadable class
expression, not the number of such expressions, so a component that calls `clsx()` five times still
counts as one unreadable file, not five; `tests/corpus.test.mjs` pins that directly. Point the script
at a project of your own (`node tests/run-on-real-stylesheet.mjs /path/to/project`, expecting
`<root>/globals.css` and a `<root>/markup` directory of `.tsx` files) to see where confidence lands
on a codebase that leans harder on computed class names. Below 60% it still reports every override it
finds and simply stops ranking them.

Two heuristics were tried for ranking intent before that confidence gate existed. A frequency count
(a base class appears on more element shapes than a modifier) failed outright on the codebase that
produced this tool: it flagged the large majority of working modifiers as bugs. A dependence check
(if every element wearing the narrower class also wears the wider one, the narrower one is a
modifier of it) is right in kind, convention-free, and is what `src/index.js` uses now, but on a
corpus that is mostly unreadable it cannot do better than the corpus lets it. That is not a case for
a third heuristic; it is the reason severity now withholds itself below 60% confidence instead of
guessing.

## License

MIT. See [LICENSE](LICENSE). No warranty. Security notes and how to report a problem:
[SECURITY.md](SECURITY.md).

---

This is one of a handful of small tools I have pulled out of my own work. I use it myself, so when
something breaks I usually notice fast. But if you run into an issue, or anything that looks off,
open one. I read every one. More on my [GitHub profile](https://github.com/justin-rhee).
