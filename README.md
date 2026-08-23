# inert-css

Finds CSS declarations that are present, valid, and can never take effect.

A delete button on my own project looked exactly like every other button. The colour meant to mark
it as the destructive one was right there in the stylesheet, ported from the design at exactly the
right value, and two people reviewed it. It never reached the screen:

```
app/globals.css:3714  .btn--danger { color: var(--bad) }
  never applies to  <button class="btn btn--danger">
  loses to          app/globals.css:4099  .btn { color: var(--ink) }
  why               EQUAL specificity (0,1,0), and .btn is 385 lines later
```

The same evening, the same defect produced two more bugs in the same stylesheet, in a codebase with
4,500 passing tests, a linter, a type checker and a custom-property parity gate. A `border`
shorthand erased a modifier's `border-color` from 385 lines away. A duplicated class re-imposed a
`flex-basis` from 450 lines later and broke a whole settings tab, and the fix next door had passed
every gate. Two utility classes collided on one element, so a single line came out the wrong size
and the wrong shade at once.

None of it shows in a diff. Every value was correct. What went wrong is which rule wins, and that
turns on source order, specificity, and which classes land together on a real element.

If your stylesheet is long enough that two rules can set the same property without anyone noticing,
you have this too, and it will not show up as a failing test because nothing is failing. inert-css
is about 400 lines of JavaScript that reads the stylesheet, reads your markup, and reports the
declarations that lose.

## Use it if

- your stylesheet is long enough that two rules can set one property without anyone noticing
- you have shipped a colour or a size that was right in the source and wrong on the screen
- your linter reports clean and you still do not trust the cascade
- you would rather find this at build time than in a screenshot

## How it works

Deciding whether a declaration can ever take effect needs one thing a stylesheet does not contain:
which selectors land on the same element. Nothing in the CSS says `btn` and `btn--danger` ever
appear together. So the tool reads your markup and collects the class combinations it can see, then
compares only the rules that can actually meet.

Within a combination it resolves the cascade the way a browser does. Shorthands expand to their
longhands, so `border` is understood to set `border-color`. Pseudo-states are part of an element's
identity, so `.btn:hover` never loses to `.btn`. `@media` and `@container` are separate contexts and
are compared only against themselves. `@layer` inverts the ordering rules, so a file using cascade
layers is refused by name rather than analysed wrongly.

Losing to higher specificity is ordinary cascade behaviour and usually intended, so it reports low.
Losing to equal specificity on source order alone is the case nobody expects, and it is where all
three of my bugs sat.

## Why your linter says nothing

The reflex answer is that stylelint or PurgeCSS already covers this, and I assumed the same until
I read what they actually claim. PurgeCSS and friends find selectors that match no element; these
selectors match fine, and only their declarations lose. stylelint's
`declaration-block-no-shorthand-property-overrides` catches a shorthand clobbering a longhand
inside one block, and its own documentation shows two separate rules with the same selector as a
non-problem, which is the exact shape of the first bug above. Its `no-descending-specificity` says
plainly that it "does not have access to the HTML or DOM" and "doesn't consider individual
properties", and the case here is equal specificity, which is not descending, so it stays quiet.
DevTools does show the struck-through loser, at runtime, one element at a time, if you already
suspected that element.

The difference is not cleverness, it is inputs. Every one of those tools looks only at the
stylesheet, and the stylesheet does not record that `btn` and `btn--danger` ever appear on the
same element. Without that fact you cannot tell a real collision from two rules that never meet.
So this reads your markup first, learns which classes actually travel together, and only then
resolves the cascade between rules that can reach the same element.

There is real research behind this problem and one paper solved half of it. That is in
[docs/ADR.md](docs/ADR.md), along with what I read and what I did not.

## Install

```bash
npx inert-css --css app/globals.css --src 'app/**/*.tsx' 'components/**/*.tsx'
```

Or install it and use the library:

```bash
npm install inert-css
```


```js
import { analyze } from "inert-css";

const findings = analyze({
  css: readFileSync("app/globals.css", "utf8"),
  combos: [["btn", "btn--danger"], ["muted", "micro"]],   // or use collectCombos()
});
```

Each finding names the property, the losing and winning rules with their line numbers and
specificity, the class combination that puts them together, and why the loser lost.

## What it won't do

It reads class selectors only. Descendant and sibling combinators need to know the shape of the
DOM, not just which classes co-occur, so they are skipped and counted in the summary rather than
dropped in silence.

It cannot see class names your code builds at runtime. `clsx()`, template literals and computed
strings are invisible to a static read. This is the limitation that matters most, because the list
of observed combinations is what the whole analysis rests on, and on my own project 173 of 215
markup files carry names it cannot read. That works out to about 20 percent coverage.

That number changes what the tool will claim. Detection never depended on coverage, but ranking
findings by intent always did, so below 60 percent it withholds the ranking rather than guessing.
Findings still come out in full, severity reads `unranked`, and the report prints the coverage
figure and what would raise it. A checker that is confidently wrong gets switched off in a week,
which is worth less than one that says plainly what it cannot see.

It compares `var()` as written, so two custom properties resolving to the same colour are reported
as a difference. Resolving them needs a browser. It does not report a losing declaration whose
value matches the winner, because that is harmless duplication.

## How I tested it

13 offline tests, run them with `npm test`. The three bugs above are in there as regression
fixtures, in their real shapes rather than minimised, because the minimised version of the first
one looks obviously wrong and the real one did not. The rest cover the boundaries: shorthand
expansion, state separation, media contexts, `!important`, `@layer` refusal, and the two cases
where partial coverage has to withhold a verdict instead of inventing one.

I ran it against the stylesheet those three bugs came from. It found 173 high and 229 low across
305 class combinations collected from 215 files, and `.micro` losing to `.muted`, a real shipped
defect, sorted to the top unprompted. It also caught `font: inherit` quietly resetting a
`font-size` and a `line-height` set 3,000 lines earlier, which is the same mechanism as the first
bug.

Most of those 173 are modifiers correctly overriding their base, which is what a modifier is for.
That is the open problem, and the report says so on every run rather than in a footnote.

## License

MIT. See [LICENSE](LICENSE). No warranty. Security notes and how to report a problem: [SECURITY.md](SECURITY.md).

Design decisions and what changed while building it: [docs/ADR.md](docs/ADR.md).

---

This little tool is one of a handful I pulled out of my own day-to-day work. I use them all myself, so when something breaks I usually notice fast. But if you run into any issues, or anything that looks off, open an issue. I read every one. More tools on my [GitHub profile](https://github.com/justin-rhee).
