# inert-css

[![tests](https://github.com/justin-rhee/inert-css/actions/workflows/test.yml/badge.svg)](https://github.com/justin-rhee/inert-css/actions/workflows/test.yml) [![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) ![node >= 22](https://img.shields.io/badge/node-%3E%3D22-brightgreen.svg) ![one dependency: postcss](https://img.shields.io/badge/dependencies-postcss-blue.svg)

Finds CSS that looks right in your stylesheet but never shows up on the page, because another rule quietly wins.

```
$ node demo/run-on-real-stylesheet.mjs
corpus: 4 class combinations from 4 files (1 of them unreadable: class names this tool cannot read statically)
skipped 0 selectors needing DOM structure, 0 at-rule blocks
findings: 9 high, 1 low
```

A base rule's `border` shorthand erased a modifier's `border-color`, and a button meant to read as a warning rendered plain grey. Every value was correct, reviewed and shipped; it lost to a rule further down the file at the same specificity. A linter, a type checker and a passing test suite had nothing to say, because none of them ask which rule wins.

## Use it if

- you maintain a stylesheet nobody has fully re-read in a while
- a component looks right alone and wrong once two classes land on the same element
- you write BEM-style modifiers or utility classes and want to know when one silently loses

## Install

It isn't on npm yet. Copy `src/index.js`, `src/cascade.js` and `src/corpus.js` into one folder, since they import each other, then:

```bash
npm install postcss
```

```js
import { analyze, collectCombos } from "./index.js";

const findings = analyze({
  css: readFileSync("app/globals.css", "utf8"),
  combos: [["btn", "btn--danger"], ["muted", "micro"]],   // or use collectCombos()
});
```

Check it with the demo above: the bundled fixture must come back 9 high, 1 low. Node 22 or newer.

## How it works

1. you give it a stylesheet and the class combinations that occur together on real elements, or `collectCombos` reads them from your markup
2. it expands shorthands (`border` reaching `border-color`), works out specificity, and groups declarations that could hit the same element in the same state
3. when two disagree, it reports the winner and the loser with selectors, lines, values and a reason
4. losing on source order alone at equal specificity is `high`, the case authors don't expect; everything else is `low`

Equal specificity is the hard case. A modifier after its base is normal, while a base after its modifier is the bug above, and telling them apart takes knowing whether the two classes ever appear apart. That's what the markup is for.

## Why not stylelint or PurgeCSS?

PurgeCSS, UnCSS and Chrome Coverage find selectors that match nothing; these match and lose. DevTools shows overridden rules at runtime, one element at a time. stylelint's `no-descending-specificity` can't see the markup and doesn't compare single properties, so the equal-specificity case emits nothing there. Earlier research either needed a running app (CILLA, ICSE 2012) or counted unmatched selectors (Hague et al., OOPSLA 2015, of which I've read 10 of 50 pages, so the claim is only as strong as that reading).

## What it won't do

- look past class selectors for now; `.a .b` and `.a > .b` need the DOM, so they're skipped and counted
- compare across pseudo-states, so `.btn:hover` never competes with `.btn`
- compare across `@media` and `@container`, which are separate contexts
- analyze a stylesheet using `@layer`, which flips the ordering rules it assumes, so it refuses by name
- read dynamic class names like `clsx(...)` or template strings; it counts what it couldn't read, and below 60% confidence it still reports every override but stops ranking them
- resolve `var()`, so two custom properties with the same final color are reported as different
- report identical values, which are harmless duplication

## How I tested it

- 25 tests on Node's built-in runner: `npm install`, then `node --test tests/`
- gutting the markup reader turns 10 red, and removing the `border` shorthand's expansion turns 2 red
- an early draft had only the demo, which still printed a plausible "0 high, 0 low" with the reader gutted, so `tests/fixture.test.mjs` now asserts the headline numbers

<details>
<summary>More on testing</summary>

The tests cover the three shapes that produced this tool (a shorthand erasing a longhand, a duplicated class re-imposing a layout value, two utility classes colliding), the cases it must not flag (a working modifier, `:hover`, identical values, separate media contexts, `!important`), the refusals, and the confidence gate. Counting how often classes appear together was tried first for ranking intent and flagged most working modifiers as bugs. CI runs the suite on Node 22.

</details>

## License

MIT. See [LICENSE](LICENSE). No warranty. Security notes and how to report a problem: [SECURITY.md](SECURITY.md).

<!-- related:start -->
## Related

- [linter-selftest](https://github.com/justin-rhee/linter-selftest): proves each lint rule can still fire
- [scar-audit](https://github.com/justin-rhee/scar-audit): shows which written rules your agent quietly skips

Part of a small set of tools I pulled out of my own agent harness. I use them myself and read every issue. More on my [GitHub profile](https://github.com/justin-rhee).
<!-- related:end -->
