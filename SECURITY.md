# Security policy. inert-css

## Posture

inert-css is provided as-is, with NO WARRANTY (see LICENSE). Use it as one control among several,
never as a sole guarantee.

It is not a security tool and does not claim to be. It is a build-time reader: it parses a
stylesheet with postcss, reads the markup files you point it at, and prints findings. It executes
nothing from either, writes nothing outside stdout, opens no network connection, and holds no
credentials.

The structural limit worth stating: it runs with your permissions and reads whatever paths your
glob matches, exactly as any build tool does. Point it at a directory and it reads that directory.
A malformed or hostile stylesheet is handled by postcss rather than by anything here, so its
parser is the surface that matters, and it is a dependency I do not control.

## Validation status

13 offline tests, run with `npm test` and green at the time of release. Three of them are
regression fixtures built from real shipped defects rather than minimised examples. The tests cover
shorthand expansion, pseudo-state separation, media contexts, `!important`, `@layer` refusal, and
the cases where incomplete coverage has to withhold a verdict.

There is no red-team corpus, because there is no attacker model here to build one against. Said
plainly rather than left as an implication.

The tool's own accuracy limit is documented in the README and enforced in code: below 60 percent
markup coverage it withholds its ranking instead of guessing, and on the reference project coverage
is about 20 percent.

## Reporting a vulnerability

Report privately via a GitHub security advisory on this repository (Security tab, "Report a
vulnerability"). Please do not open a public issue for a suspected vulnerability, and give a
reasonable window for a fix first.
