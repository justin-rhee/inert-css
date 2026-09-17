# inert-css rebuild — build report

Built in a fresh worktree, read-only against the existing `inert-css` working copy in the packages
folder. No git repo initialized here; that is the human's step. This file covers two rounds: round 1
(the initial rebuild) and round 2 (fixes for 11 FAIL rows from an independent review of round 1).
Not shipped: this file and `scan.out` are internal and are now in `.gitignore` (round 2, rows 5b/7b).

## Round 1 summary

**Library code (`src/index.js`, `src/cascade.js`) — copied byte-for-byte in round 1**;
`src/corpus.js` was also copied byte-for-byte in round 1 and then fixed in round 2 (see below).
`tests/real-defects.test.mjs` — copied byte-for-byte, unchanged in both rounds.

**`tests/run-on-real-stylesheet.mjs` — rewritten in round 1.** The old copy defaulted its
project-root argument to a private machine path outside this package and shelled out with that path
interpolated directly into a shell command string. Fixed by defaulting to a bundled fixture
(`tests/fixtures/`) and using `execFileSync` with an argument array instead of a shell string, so a
caller-supplied path is passed as data rather than concatenated into a command.

**`tests/fixtures/` — new in round 1.** `globals.css` plus four `.tsx` files under `markup/`,
reproducing the *shape* of the three defects in `tests/real-defects.test.mjs` with generic,
already-cleared BEM/utility class names (`.btn`, `.btn--danger`, `.micro`, `.muted`, the two
`__text` names), not a copy of anything real.

**`.receipts` — not carried over, on purpose.** It keyed numbers to a commit in a private
repository and named that repository in its own derivation command. Excluded entirely rather than
scrubbed in place.

**`README.md`, `LICENSE`, `SECURITY.md`, `package.json`, `.github/workflows/test.yml`,
`.gitignore`, `.publish-gate` — written/adapted in round 1** from hook-canary's shape and the real
identity (MIT, Justin Rhee, 2026). Round 1's assumption stands and is unresolved: `package.json`'s
repository URL (`github.com/justin-rhee/inert-css`) and version (`0.1.0`) follow hook-canary's
naming convention because the actual repo does not exist yet; the review marked this
**UNVERIFIABLE**, not FAIL, for the same reason. If the repo is named differently, `package.json`,
`README.md`'s badge and footer link, and `SECURITY.md`'s advisory instructions all need the same
correction together.

## Round 2: every FAIL row from the independent review, addressed

**Row 3b — the acid test asserted nothing, and its exit code was constant.** Added
`tests/fixture.test.mjs`: imports `analyze`/`collectCombos` directly, runs them against the bundled
fixture the same way `tests/run-on-real-stylesheet.mjs` does, and asserts the headline numbers (4
combos from 4 files, 1 unreadable, 0 skipped selectors, 0 skipped at-rules, 9 high findings, 1 low
finding, and the exact line of the `.btn--danger` vs `.btn` color finding). Left
`tests/run-on-real-stylesheet.mjs` as a human-readable demonstration rather than adding assertions
to it directly, per the review's own "or" option, so its documented identity ("manual acid test, not
part of the automated suite") stays true.

**Row 3c — `src/corpus.js` was not covered by the asserting suite at all.** Added
`tests/corpus.test.mjs`, 8 tests against `collectCombos` directly: a double-quoted static combo, a
single-quoted static combo, a literal `className={"a b"}` counted as static rather than dynamic, a
single class excluded (cannot conflict with itself), a `clsx()` site excluded from combos and counted
as one dynamic file, the row-4e regression pinned directly, combined accumulation across a mixed file
set, and an unreadable path skipped without crashing. New fixtures live under
`tests/fixtures/corpus/`, separate from the acid-test fixture, since they isolate single behaviors
rather than demonstrate the whole tool.

**Row 3d — scope note on remaining gaps.** The review's own fix column says "treat 3b/3c as the fix;
the rest is a known-gaps note for the release, not a blocker," so `specificity()`'s
`:is()`/`:not()`/`:has()`/`:where()` weighting, the `@container`/`@supports` branches of
`contextOf()`, and most `EXPANSIONS` entries beyond `border` and `flex` remain untested. Recorded
here rather than silently dropped or quietly padded with low-value tests to look complete.

**Row 4c — README's example finding cited the wrong line.** Settled by running the tool before
touching either file, per the coordinator's instruction: `node tests/run-on-real-stylesheet.mjs`
prints `color … loses .btn--danger:12 color: var(--bad)`. `tests/fixtures/globals.css` line 11 is the
`border-color` declaration; line 12 is `color`. The tool was right; the README's hand-typed example
was wrong (round 1's claims-table proof, `sed -n '11p;28p'`, was checking the wrong line and so
looked like it proved a false claim). Fixed `README.md`'s `loser.line` from `11` to `12`. This is now
a test, not just a corrected number: `tests/fixture.test.mjs`'s last case asserts `loser.line === 12`
and `winner.line === 28` against a live run, so a future edit that reintroduces a mismatch fails
`node --test tests/` instead of waiting for the next review.

**Row 4e — the confidence formula mixed dynamic *sites* with a count of *files*.** `src/corpus.js`
was accumulating `Math.max(0, braced - bracedStatic)` — a per-occurrence count — into `dynamic`, and
`src/index.js`'s `corpusConfidence()` divides using `scanned` (`files.length`, a file count) as the
denominator. Fixed by making `dynamic` count FILES that contain at least one unreadable class
expression, not the number of such expressions, so the "N of M markup files" wording already used
throughout `src/index.js` and the README is literally true rather than coincidentally readable.
`tests/corpus.test.mjs`'s regression test constructs one file with three `clsx()` sites and asserts
`dynamic === 1`; it fails under the old arithmetic (which returns `3`) and passes under the fix. Also
fixed the resulting wording in `tests/run-on-real-stylesheet.mjs`'s print line ("dynamic sites" → "of
them unreadable"). The bundled fixture's own numbers are unchanged by this fix — it has exactly one
dynamic site in one file, so sites-vs-files was never visible there, which is exactly why the review
had to construct a separate probe to find the bug in the first place.

**Row 4f — the `reason` enum comment omitted `narrower-rule-wins`.** `README.md`'s "Each finding"
example now lists all three reasons and says which severity the third maps to (`low`), pointing at
the fixture's own `.btn--accent` finding as a real example.

**Row 5b / 7b — `BUILD-REPORT.md` and `scan.out` were shippable.** Added both to `.gitignore`, along
with `*.tgz` (from `npm pack`) and `.npmcache`, matching the review's list. Both were already excluded
from the npm tarball by `files` (row 6b), but `.gitignore` is what stops a `git add -A` from putting
them in the public repo, which is the actual risk named.

**Row 6b — `files: ["src"]` shipped 6 files while the README and SECURITY.md told a reader to run
tests they would not have.** Changed `package.json`'s `files` to `["src", "tests", "SECURITY.md"]`.
Verified with `npm pack --dry-run`: 22 files, 21.2 kB, including `tests/`, both fixture trees under
`tests/fixtures/`, `tests/corpus.test.mjs`, `tests/fixture.test.mjs`, and `SECURITY.md`. `LICENSE`,
`README.md` and `package.json` ship regardless, as npm always includes them.

**Row 6c — `engines: ">=18"` was asserted but never exercised.** `.github/workflows/test.yml` (copied
from the house standard, unchanged) tests only Node 22. Rather than deviate from the house-standard
CI file to add a version-matrix axis, lowered the claim to match what is actually tested:
`engines.node` is now `">=22"`.

**Row 8c — `SECURITY.md`'s Validation status omitted a positive control.** With 3b/3c/4e fixed, added
a sentence naming both mutations used below and their real red counts on the current 25-test suite:
gutting `collectCombos` turns 10 red, removing the `border` shorthand expansion turns 2 red.

**Row 9 — `install-smoke.sh` reported the package BROKEN, which blocks `hooks/pre-push`.** The README
had no `## Install` section. Added one, positioned between "How it works" and "What it won't do"
(hook-canary's position), documenting the real install path for an npm library —
`npm install inert-css` — rather than "copy `src/index.js`", which would itself have been a broken
instruction: `src/index.js` imports `./cascade.js` and `./corpus.js` by relative path, so copying it
alone would not load. `install-smoke.sh` now reports
`ok    Install is a package-manager step, nothing to copy`, exit 0. This check was never run in
round 1, which is how the blocker got through; it is now part of the verification run below.

## The one the coordinator called out: proof by mutation

The review gutted `src/corpus.js` down to `return { combos: [], scanned: files.length, dynamic: 0 }`
and round 1's suite still passed 13/13, because nothing imported `collectCombos` directly. Re-proven
directly in this round, not just asserted fixed:

```
$ cp src/corpus.js <backup>/corpus.js.good

# mutate: src/corpus.js's final return statement replaced with
#   return { combos: [], scanned: files.length, dynamic: 0 };
# (diff against the backup confirms the mutation applied)

$ node --test tests/
✖ a double-quoted static className is read as a combo
✖ a single-quoted static className is read as a combo
✖ a braced but literal className, e.g. className={"a b"}, counts as static, not dynamic
✖ a clsx() site is excluded from combos and counts as one dynamic (unreadable) file
✖ THE REGRESSION: dynamic counts FILES, not call sites …
✖ combos and dynamic files both accumulate correctly across a mixed set of files
✖ an unreadable path is skipped from combos without crashing, and still counts toward scanned
✖ the fixture's corpus matches what the README quotes: 4 combos from 4 files, 1 unreadable
✖ the fixture's findings match what the README quotes: 9 high, 1 low, 0 skipped
✖ the README's example finding is real: .btn--danger loses color at its actual fixture line
ℹ tests 25
ℹ pass 15
ℹ fail 10

$ node tests/run-on-real-stylesheet.mjs
corpus: 0 class combinations from 4 files (0 of them unreadable: class names this tool cannot read statically)
skipped 0 selectors needing DOM structure, 0 at-rule blocks
findings: 0 high, 0 low

# restore: cp <backup>/corpus.js.good src/corpus.js
# diff against the backup: no output — byte-identical, mutation fully reverted

$ node --test tests/
ℹ tests 25
ℹ pass 25
ℹ fail 0

$ node tests/run-on-real-stylesheet.mjs
corpus: 4 class combinations from 4 files (1 of them unreadable: class names this tool cannot read statically)
skipped 0 selectors needing DOM structure, 0 at-rule blocks
findings: 9 high, 1 low
```

Ten tests now catch the exact mutation that used to slip through all thirteen. Restoring the file
returns the suite to 25/25 and the acid test to its documented output, with no residual diff.

Second mutation, reproduced independently to get a real number for `SECURITY.md`'s positive control
on the current, larger suite: removed the `border` row from `EXPANSIONS` in `src/cascade.js`.

```
$ node --test tests/
ℹ tests 25
ℹ pass 23
ℹ fail 2

$ node tests/run-on-real-stylesheet.mjs   # headline only
findings: 5 high, 1 low        # was 9 high, 1 low

# restore: diff against backup — no output, byte-identical

$ node --test tests/
ℹ tests 25
ℹ pass 25
ℹ fail 0
```

Both mutations were applied and reverted only in this worktree, via backup copies kept outside the
package directory for the duration of the test, never committed, never left in place.

## Where I agree with the review vs. where I'd push back

I did not find a row to push back on. Row 3d is explicitly scoped by the review itself as a
known-gaps note rather than something to fix, and it is left that way rather than silently skipped or
padded with low-value tests to look complete. Every other FAIL row pointed at a real, reproducible
defect (the line-number transcription in 4c, the unit mismatch in 4e, the missing Install section in
9, the untested corpus reader in 3c) or a real process gap (5b/6b/6c/7b/8c), and each fix above is
verified against a live command in this session, not carried over from the review's own numbers
unchecked. Where the review's numbers depend on the now-larger test suite (the mutation red counts,
row 8c), I re-ran both mutations myself rather than reuse the review's round-1 figures, since 13 vs.
25 total tests makes "1 test goes red" and "2 tests go red" different claims.

## Round 3: text fixes from a second independent review, plus one recorded gap

A second review (round 2 of the review process; this is round 3 of the build) found 20 PASS and
re-closed 11 of round 2's 12 FAIL rows, all exact. Four rows remained: the carried-forward scope
note (3d, narrowed further, still not a blocker) and three new findings, all prose, no code:

- **README's Install section asserted `npm install inert-css`, a package name never checked on
  npm.** The reviewer's point about round 2's install-smoke fix was correct: it passed because the
  local sandbox has no network egress to prove or disprove the claim, so a green `install-smoke.sh`
  validated the sentence's *shape* (it looks like a package-manager step), not its *truth* (that a
  package by that name, published by this author, exists to install). Fixed: the Install section now
  says the package "isn't on npm yet" and gives the copy-the-files form instead, naming
  `src/index.js`, `src/cascade.js` and `src/corpus.js` explicitly, plus `npm install postcss` for the
  one runtime dependency. This is not a weaker instruction than round 2's; it is the one that is
  actually true today, following hook-canary's own precedent for an unpublished tool. Re-verified
  with `npm install` run first (so the package's own `node_modules` exists for `install-smoke.sh` to
  make `postcss` resolvable, exactly modeling a reader who ran the documented `npm install postcss`
  step) — `install-smoke.sh` now passes by genuinely copying and loading all three named files, not
  by matching the package-manager-step fallback. `npm install inert-css` will be the right instruction
  again once the name is checked on npm and the package is actually published there; until then it
  stays as copy-the-files.
- **A fresh clone gives 8 pass / 2 fail, not 25/25, because the two "run the tests" instructions
  (`README.md`, `SECURITY.md`) never said to install first.** `tests/corpus.test.mjs` passes bare
  (it only imports `src/corpus.js`, which needs nothing but `node:fs`); `tests/real-defects.test.mjs`
  and `tests/fixture.test.mjs` both import `src/index.js`, which needs `postcss`, and fail at import
  with `ERR_MODULE_NOT_FOUND` otherwise. CI was never wrong (`npm ci` runs in the workflow), only the
  README/SECURITY.md prose was silent about the precondition a reader (as opposed to CI) actually
  needs. Fixed in three places: `README.md`'s "How it works" section (the line pointing at
  `node --test tests/` to reproduce the cited finding), `README.md`'s "How I tested it" section (the
  main "Run it:" instruction), and `SECURITY.md`'s "Validation status" section — all three now say
  `npm install` before `node --test tests/`.
- **`SECURITY.md` cited `BUILD-REPORT.md` by name as where a reader could find the mutation
  transcript, but `BUILD-REPORT.md` is gitignored and ships in neither the git repo nor the npm
  tarball.** A stranger reading the shipped security policy was pointed at an internal file they have
  no way to obtain. Fixed by deleting the second half of that sentence; the two mutation counts in the
  same sentence are the claim that matters to a reader, and the transcript's location is process, not
  product. Checked the rest of `README.md` and `SECURITY.md` for the same pattern (a citation of an
  internal, non-shipped artifact): no other instance found. `SECURITY.md`'s "an independent review
  made exactly this change" sentence was left as-is; it narrates how a defect was found, the same way
  the README's opening narrates the original incident, and does not point a reader at anything they
  would need to fetch.
- **Recording the round-2 review's uncovered case (3d), precisely, not just in general terms.** Its
  own combined probe: deleting the `gap` and `overflow` rows from `EXPANSIONS` in `src/cascade.js`
  *and*, at the same time, changing `:where()` to contribute specificity instead of the zero the CSS
  spec gives it (`src/cascade.js`'s `specificity()`, the `:where()` branch) — both mutations applied
  together — leaves the suite at 25 pass, 0 fail. Two real defects, compounded, are currently
  invisible to every test in this package. Separately: neutering the `@layer` refusal is caught (1
  red), so that path is not part of this gap. Per the coordinator's explicit instruction this round,
  **this is not being fixed now** — no code, test or fixture changed in round 3 — but it is written
  down here as the known gap for whoever next touches `src/cascade.js`'s `EXPANSIONS` table or its
  `:where()` handling: a table-driven test over every `EXPANSIONS` entry, and a direct test of the
  `:is()`/`:not()`/`:has()`/`:where()` specificity branches, would close it.

## README claims and their proof (current)

| Claim in README.md | Proof |
|---|---|
| "25 tests" | `node --test tests/` → `tests 25`, `pass 25`, `fail 0`. Run 2026-09-17. |
| Example finding's `line: 12` for `.btn--danger`'s `color`, `line: 28` for `.btn` | `tests/fixtures/globals.css` lines 12 and 28; reproduced live by `node tests/run-on-real-stylesheet.mjs` and asserted by `tests/fixture.test.mjs`'s last test. |
| `reason` can be `"narrower-rule-wins"`, mapped to `low` | `src/index.js`'s `analyze()`, the ternary building `reason` (~line 181); asserted at `tests/real-defects.test.mjs`'s "a modifier BEATING its base…" test; present in the live fixture run as the `.btn--accent` finding. |
| `corpus: 4 class combinations from 4 files (1 of them unreadable…)` | `node tests/run-on-real-stylesheet.mjs`, first line; asserted by `tests/fixture.test.mjs`. |
| `skipped 0 selectors…, 0 at-rule blocks` / `findings: 9 high, 1 low` | same command and same test file. |
| "corpus confidence at 75%" / "60% cutoff" | arithmetic on the printed corpus line (3 static of 4 files ÷ 4); `src/index.js` line 25 (`minConfidence = 0.6`) and `corpusConfidence()`'s `trusted: value >= 0.6`. |
| "`dynamic` counts files … not the number of such expressions" | `src/corpus.js`'s `collectCombos`, the `if (braced - bracedStatic > 0) dynamicFiles += 1` line; `tests/corpus.test.mjs`'s regression test constructs the exact counter-example (one file, three sites) and asserts `dynamic === 1`. |
| "gutting the markup reader turns 10 of the 25 tests red; removing the `border` expansion turns 2 red" | mutation transcript above, reproduced in this session. |
| `npm install inert-css` / Install section | `install-smoke.sh` against this directory → `ok Install is a package-manager step, nothing to copy`, exit 0. |
| "a frequency count... failed outright... flagged the large majority of working modifiers" | qualitative, carried from the staged review notes' account of the design history; the specific old count was measured against the private reference project and is not re-derivable here, so no number is claimed. |

Prior-art citations (ICSE 2012, OOPSLA 2015, the CILLA repository's commit count and last-touched
date, the "10 of 50 pages" reading bound) are unchanged from round 1 and were not re-verified: they
are citations to independently published external work, not measurements this package makes about
itself, and this sandbox has no general web access.

## Verification run 2026-09-17 (round 2, all re-run after the fixes above)

- `node --test tests/` → exit 0, `tests 25`, `pass 25`, `fail 0`, against a fresh `npm install`
  (real registry; the default local npm cache again needed a temporary `--cache` dir, same
  pre-existing, unrelated permission issue as round 1).
- Mutation proof above: gutting `collectCombos` → 15/25 pass, 10 fail; restored → 25/25. Removing the
  `border` expansion → 23/25 pass, 2 fail; restored → 25/25. Diffs against pre-mutation backups
  confirm byte-identical restoration both times.
- The workspace's pre-publish-scan script, run against `.` from inside this package directory (with
  `node_modules/` removed first, since the scan has no git history to exclude it and a fresh
  `npm install` would otherwise sweep a transitive dependency's own README/package.json into the
  identity scan) → exit 3, **no FINDING line of any kind**. Only the expected "not a git repo yet"
  and "CONTENT-ONLY… commit then re-run" notices. Saved at `scan.out`.
- `install-smoke.sh` against this directory → `ok Install is a package-manager step, nothing to
  copy`, exit 0.
- `npm pack --dry-run` → 22 files, 21.2 kB, including `tests/`, both fixture trees, and
  `SECURITY.md`.
- A recursive search of this directory for machine-specific home-directory paths or the private
  project's name → no matches, exit 1.
- A search for unfilled double-curly template fields (the pattern the scan's placeholder check
  looks for) → no matches, exit 1.

## Verification run 2026-09-17 (round 3, text-only fixes)

- `npm install` (real registry; temporary `--cache` dir, same pre-existing local-cache permission
  issue as prior rounds) then `node --test tests/` → exit 0, `tests 25`, `pass 25`, `fail 0`.
- `install-smoke.sh`, run immediately after that same `npm install` (so the package's own
  `node_modules` exists for the checker to make `postcss` resolvable) →
  `ok    3 file(s) copied and loaded`, exit 0. This is a genuine pass: `src/index.js` was actually
  copied into an empty directory and actually imported `postcss` successfully, not routed through
  the package-manager-step fallback the round-2 wording used. **Noted explicitly because it matters
  for reproducing this result:** run `install-smoke.sh` again on this directory with no prior
  `npm install` (i.e. no `node_modules/` present, which is this package's normal shipped state — see
  `.gitignore`) and it correctly reports `BROKEN`, `src/index.js does not load alone: ...
  ERR_MODULE_NOT_FOUND`. That is not a regression; it is the check honestly detecting the same
  precondition a real reader would hit if they copied the three files but skipped
  `npm install postcss`. `node_modules/` was removed again after this check, matching every prior
  round's shipped state.
- The pre-publish-scan script, run against `.` with `node_modules/` absent → exit 3, **no FINDING
  line of any kind**; only the expected "not a git repo yet" and "CONTENT-ONLY… commit then re-run"
  notices. Saved at `scan.out`.
- A recursive search of this directory for machine-specific home-directory paths or the private
  project's name → no matches, exit 1.
- A search for unfilled double-curly template fields → no matches, exit 1.
- No file under `src/`, `tests/`, or any fixture was touched this round, per the coordinator's
  instruction; only `README.md`, `SECURITY.md` and this file changed.

## What I still could not resolve

- **Repository URL and version number remain assumptions**: `package.json`'s
  `justin-rhee/inert-css` and `0.1.0`, and the same slug in `README.md`'s badge/footer and
  `SECURITY.md`'s advisory instructions. Marked UNVERIFIABLE by the review for the same reason this
  session has: the repo does not exist yet and there is no egress to confirm it.
- **The badge at the top of `README.md` will 404 until the repo exists and the workflow has run
  once.** The review accepted this as house convention (identical to hook-canary's own shipped
  README before its first run), so it is left as-is.
- **Row 3d's broader gaps** (specificity weighting for `:is()`/`:not()`/`:has()`/`:where()`, the
  `@container`/`@supports` branches, most `EXPANSIONS` entries) remain untested, per the review's own
  instruction that 3b/3c were the required fix and the rest is a release-note, not a blocker.
- **The two aggregate figures from the original incident** (the exact confidence percentage and
  false-positive count on the real reference project, from round 1's note) remain gone rather than
  relocated: they lived only in the private project and in `.receipts`, both out of bounds for this
  rebuild.
