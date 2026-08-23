/**
 * cascade.js — the parts of the CSS cascade this tool has to model, and nothing else.
 *
 * Three jobs: work out a selector's specificity, work out whether a selector applies to a given
 * set of classes in a given state, and expand shorthands so that `border` can be seen to clobber
 * `border-color`. That third one is not incidental — it is the mechanism behind the defect that
 * started this package, where a modifier's `border-color` was reset by a base rule's `border`.
 */

/** Selectors we can reason about without a DOM: compounds of classes, optionally with state. */
const COMPOUND = /^(?:\.[A-Za-z_-][\w-]*|:[A-Za-z-]+(?:\([^)]*\))?)+$/;

/** Pseudo-classes that describe a STATE the element is sometimes in, rather than a filter on
 *  which elements match. A declaration under one of these is not competing with the base rule —
 *  it describes a different moment, so comparing them would manufacture findings. */
const STATE_PSEUDOS = new Set([
  "hover", "focus", "focus-visible", "focus-within", "active", "visited", "target",
  "disabled", "enabled", "checked", "indeterminate", "placeholder-shown", "autofill",
  "read-only", "read-write", "required", "optional", "valid", "invalid", "in-range",
  "out-of-range", "default", "open", "popover-open", "user-invalid", "user-valid",
]);

/** Pseudo-classes that select by POSITION. They need sibling context we do not have. */
const STRUCTURAL_PSEUDOS = /^(?:nth-|first-|last-|only-|empty$|root$)/;

/**
 * Specificity as [ids, classes, types]. `:not()`/`:is()`/`:has()` take the specificity of their
 * most specific argument; `:where()` always contributes zero. We only need enough of this to
 * compare class compounds, and anything we cannot count honestly is refused upstream.
 */
export function specificity(selector) {
  let a = 0, b = 0, c = 0;
  const s = selector.trim();

  for (const m of s.matchAll(/#[\w-]+/g)) { void m; a += 1; }
  for (const m of s.matchAll(/\.[\w-]+/g)) { void m; b += 1; }
  for (const m of s.matchAll(/\[[^\]]+\]/g)) { void m; b += 1; }

  for (const m of s.matchAll(/:{1,2}([\w-]+)(\(([^)]*)\))?/g)) {
    const [, name, , arg] = m;
    if (name === "where") continue;                       // always zero, by spec
    if (name === "is" || name === "not" || name === "has") {
      if (!arg) continue;
      const inner = arg.split(",").map((x) => specificity(x));
      const worst = inner.sort(cmpSpecificity).pop() ?? [0, 0, 0];
      a += worst[0]; b += worst[1]; c += worst[2];
      continue;
    }
    if (m[0].startsWith("::")) c += 1;                     // pseudo-element
    else b += 1;                                           // pseudo-class
  }

  for (const m of s.matchAll(/(^|[\s>+~(])([a-zA-Z][\w-]*)/g)) { void m; c += 1; }
  return [a, b, c];
}

export function cmpSpecificity(x, y) {
  return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
}

/** Split a selector into its classes and its state pseudo-classes, or null if we cannot model it. */
export function parseCompound(selector) {
  const s = selector.trim();
  if (!COMPOUND.test(s)) return null;                      // combinators, elements, ids, attrs

  const classes = [...s.matchAll(/\.([\w-]+)/g)].map((m) => m[1]);
  if (classes.length === 0) return null;

  const states = [];
  for (const m of s.matchAll(/:([\w-]+)(\([^)]*\))?/g)) {
    const name = m[1];
    if (STRUCTURAL_PSEUDOS.test(name)) return null;        // needs sibling context
    if (name === "not" || name === "where" || name === "is") return null; // v1: refuse rather than guess
    if (STATE_PSEUDOS.has(name)) states.push(name);
    else return null;                                      // unknown pseudo: refuse, do not assume
  }
  return { classes, states: states.sort() };
}

/**
 * Does this compound apply to an element wearing `combo` in `state`?
 * Every class in the selector must be present, and the selector's state must be the one being
 * considered — a `:hover` rule is compared only against other `:hover` rules and the base.
 */
export function applies(compound, combo, state) {
  for (const cls of compound.classes) if (!combo.has(cls)) return false;
  for (const st of compound.states) if (!state.has(st)) return false;
  return true;
}

/**
 * Shorthand expansion. A shorthand sets every longhand it covers, including the ones it does not
 * mention — which is exactly how `border: 2px solid var(--line)` erases an earlier
 * `border-color: red`. We expand to canonical longhand KEYS (not values); the tool compares
 * whether two declarations touch the same key, and reports the authored text either way.
 */
const SIDES = ["top", "right", "bottom", "left"];
const EXPANSIONS = {
  border: ["border-width", "border-style", "border-color"],
  "border-top": ["border-top-width", "border-top-style", "border-top-color"],
  "border-right": ["border-right-width", "border-right-style", "border-right-color"],
  "border-bottom": ["border-bottom-width", "border-bottom-style", "border-bottom-color"],
  "border-left": ["border-left-width", "border-left-style", "border-left-color"],
  "border-width": SIDES.map((s) => `border-${s}-width`),
  "border-style": SIDES.map((s) => `border-${s}-style`),
  "border-color": SIDES.map((s) => `border-${s}-color`),
  margin: SIDES.map((s) => `margin-${s}`),
  padding: SIDES.map((s) => `padding-${s}`),
  inset: SIDES.slice(),
  flex: ["flex-grow", "flex-shrink", "flex-basis"],
  "flex-flow": ["flex-direction", "flex-wrap"],
  gap: ["row-gap", "column-gap"],
  font: ["font-style", "font-variant", "font-weight", "font-stretch", "font-size",
         "line-height", "font-family"],
  background: ["background-color", "background-image", "background-position",
               "background-size", "background-repeat", "background-origin",
               "background-clip", "background-attachment"],
  transition: ["transition-property", "transition-duration", "transition-timing-function",
               "transition-delay"],
  animation: ["animation-name", "animation-duration", "animation-timing-function",
              "animation-delay", "animation-iteration-count", "animation-direction",
              "animation-fill-mode", "animation-play-state"],
  overflow: ["overflow-x", "overflow-y"],
  "border-radius": ["border-top-left-radius", "border-top-right-radius",
                    "border-bottom-right-radius", "border-bottom-left-radius"],
  "place-items": ["align-items", "justify-items"],
  "place-content": ["align-content", "justify-content"],
};

/** Every longhand key a declaration writes. Unknown properties map to themselves. */
export function longhands(prop) {
  const p = prop.toLowerCase();
  const direct = EXPANSIONS[p];
  if (!direct) return [p];
  // one more level, so `border` reaches `border-top-color` and can clobber it
  const out = new Set();
  for (const k of direct) for (const deep of EXPANSIONS[k] ?? [k]) out.add(deep);
  return [...out];
}

export { STATE_PSEUDOS };
