# Architecture Decision Records (ADRs)

Why this reads your markup as well as your stylesheet, what the closest prior art turned out to be,
and which of the four problems are actually closed.

## The hard part is not the cascade, it is knowing which rules can meet

Resolving a cascade is well-understood. What is missing from a stylesheet is the fact that
`.btn` and `.btn--danger` ever appear on the same element. Nothing in CSS records that, so a
purely stylesheet-level tool can only guess, and guessing here produces exactly the wrong answer:
every rule looks like it might lose to every other rule that sets the same property.

That requirement is what separates this from everything adjacent. PurgeCSS, UnCSS and Chrome
Coverage find selectors that match nothing; these selectors match, and their declarations merely
lose. DevTools shows overridden declarations one element at a time, at runtime, driven by a human.
stylelint's `no-descending-specificity` says in its own docs that it "does not have access to the
HTML or DOM" and "doesn't consider individual properties", and the case here is equal specificity,
which is not descending, so it emits nothing. Its
`declaration-block-no-shorthand-property-overrides` catches a shorthand clobbering a longhand
inside one declaration block, and its own documentation shows two separate rules with the same
selector as a non-problem, which is structurally the first bug this package exists for.

## The prior art is real, and one paper hands the project its next step

**CILLA** (Mesbah and Mirshokraie, *Automated Analysis of CSS Rules to Support Style Maintenance*,
ICSE 2012) solved co-application and explicitly detected overridden declaration properties. It did
it dynamically, by crawling a running application and observing real DOM states. The
implementation has 8 commits, was last touched in February 2014, and is a Java prototype
installable by nothing.

**Hague et al.**, *Detecting Redundant CSS Rules in HTML5 Applications: A Tree-Rewriting Approach*
(OOPSLA 2015) is the closer one, and it is static. It positions itself against CILLA directly:
dynamic analysis "cannot soundly prove redundancy of CSS rules". Its formal definition of
redundancy is the set of guards "that are not matched in postR(T₀)", which is selectors that never
match any reachable document. That is the PurgeCSS category. The analysis runs at selector
reachability and never at property cascade resolution, so specificity, source order and shorthand
expansion do not appear in it.

**What I actually read, because the claim depends on it: 10 of 50 pages.** The introduction and
the complete formal model. Sections 4 through 7 are unread. If they contain property-level cascade
reasoning the gap narrows and this section is wrong, and I would rather record the bound than let
a novelty claim rest on pages I skipped.

Within that bound the claim is narrow and holds: dynamic whole-application co-application analysis
existed in research and died, and the static build-time version aimed at cascade resolution is
what remains unbuilt. A blanket "nobody has done this" would be false and would collapse on first
contact.

The useful part is that their §3.1 models documents as unordered trees whose node labels are sets
of classes, with reachability computed symbolically. That is co-application solved without running
anything, aimed at a different defect. It is the route out of this project's one open problem.

## Ranking was refused rather than solved, and the refusal is enforced in code

Two heuristics were tried for deciding which findings matter. Frequency, where a base class
appears on more element shapes than a modifier, failed outright and produced 163 high findings
that were nearly all working modifiers. Dependence, where every element wearing the winner also
wears the loser, is better in kind because it is convention-free, and it lifted a real bug to the
top of a real report. It did not reduce the count.

The reason is not the heuristic. Severity is a claim about intent, intent is read off the observed
class combinations, and on the reference project only 20 percent of markup files could be read
statically. An incomplete picture makes a base class look like it only ever appears beside one
modifier, which makes peers look like modifiers and modifiers look like peers.

So the tool withholds the ranking instead of guessing. Findings still come out in full, severity
reads `unranked`, and the report prints the coverage figure and what would raise it. Detection
never depended on coverage; ranking always did, and now says so. The threshold that brings ranking
back, 60 percent, lives in `src/index.js` rather than in anyone's memory, so it reopens on its own.

## The open problem, and the way I do not want to close it

Coverage is the one item still open. It closes when `collectCombos` can resolve dynamic class
expressions, or when the class combinations come from a rendered DOM instead, measured by
`analyze().confidence.value` reaching 0.6 on the reference project.

The rendered-DOM route is most of the way back to what CILLA did in 2012, and taking it would turn
this into a worse version of a dead research tool rather than a different one. The static path is
what justifies the package existing. So the next attempt is symbolic reachability over possible
documents, following Hague et al., and the cheap attempt before that is resolving `clsx()`-style
expressions, which buys coverage with no theory at all.

## Two changes made during extraction that were not redactions

The real-stylesheet runner used to default to one hardcoded checkout. It now takes a required
argument and errors without one. A tool that defaults to one person's machine is not a tool, so
the scrub and the better design were the same edit.

The composite key used to group declarations was built by joining two strings with a NUL byte. It
worked, and it made the file read as binary to `file` and to any grep skipping binary input, which
meant the publish gate's leak scanner could not see inside the largest source file in the package.
A planted term appearing twice in it was reported from a different file entirely. The key is now
`JSON.stringify([context, key])`: no delimiter to collide with, no control character, and the file
is text again.
