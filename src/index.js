/**
 * inert-css — declarations that are present, valid, and can never take effect.
 *
 * The whole tool is one idea: a declaration is inert when, for every element that could wear it,
 * some other rule sets the same longhand property later in the cascade. Deciding that needs three
 * things the stylesheet alone does not contain — which classes co-occur on a real element, which
 * state the element is in, and what a shorthand quietly resets.
 */

import postcss from "postcss";
import {
  specificity, cmpSpecificity, parseCompound, applies, longhands,
} from "./cascade.js";

/**
 * @param {object} opts
 * @param {string} opts.css        stylesheet source
 * @param {Array<string[]>} opts.combos  observed class combinations, e.g. [["btn","btn--danger"]]
 * @param {string} [opts.from]     filename for reporting
 * @param {object} [opts.corpus]   {dynamic, scanned} from collectCombos, so the analyser knows
 *                                 how much of the markup it could NOT read
 * @param {number} [opts.minConfidence=0.6]  below this, severity is withheld rather than guessed
 * @returns {{findings, skipped, refused, confidence}}
 */
export function analyze({ css, combos, from = "<css>", corpus = null, minConfidence = 0.6 }) {
  const root = postcss.parse(css, { from });

  // @layer changes the ordering rules this tool models. Refusing by name beats analysing wrongly
  // and reporting confident nonsense: a checker that is wrong once gets switched off forever.
  if (/@layer\b/.test(css)) {
    return { findings: [], skipped: {}, refused: "@layer present: cascade layers reorder the cascade in a way this version does not model. Refusing rather than reporting a wrong winner." };
  }

  const decls = [];
  const skipped = { selectors: 0, atRules: 0, examples: [] };
  let order = 0;

  root.walkRules((rule) => {
    // Context: declarations only compete inside the same at-rule context.
    const context = contextOf(rule);
    if (context === null) { skipped.atRules += 1; return; }

    for (const raw of rule.selectors) {
      const compound = parseCompound(raw);
      if (!compound) {
        skipped.selectors += 1;
        if (skipped.examples.length < 8) skipped.examples.push(raw);
        continue;
      }
      const spec = specificity(raw);
      rule.walkDecls((decl) => {
        order += 1;
        for (const key of longhands(decl.prop)) {
          decls.push({
            key,
            prop: decl.prop,
            value: decl.value,
            important: decl.important === true,
            selector: raw,
            compound,
            spec,
            context,
            order,
            line: decl.source?.start?.line ?? null,
            file: from,
            // A shorthand that does not mention this longhand still RESETS it. Worth flagging in
            // output, because "your border-color was erased by a `border` shorthand" is a
            // different sentence to "your colour was overridden by another colour".
            implicit: key !== decl.prop.toLowerCase(),
          });
        }
      });
    }
  });

  // WHERE each class appears, not just how often. The set of element shapes a class occurs on is
  // what tells a MODIFIER from a PEER without trusting a naming convention: `.btn--danger` never
  // appears without `.btn`, so it is dependent on it and beating it is the whole point;
  // `.muted` and `.micro` each appear on their own elsewhere, so when they collide neither author
  // intended to lose. This replaced a frequency count, which could not tell the two apart and
  // produced 163 "high" findings on a real 305-combo corpus, nearly all of them working modifiers.
  const where = new Map();
  combos.forEach((combo, i) => {
    for (const cls of new Set(combo)) {
      if (!where.has(cls)) where.set(cls, new Set());
      where.get(cls).add(i);
    }
  });

  /**
   * CORPUS CONFIDENCE, AND WHY IT GATES SEVERITY RATHER THAN DECORATING THE REPORT.
   *
   * Severity here is a claim about INTENT: that a modifier beating its base is meant, and two
   * peers colliding is not. That claim is read off the corpus -- which classes appear together,
   * and which never appear apart. It is only as good as the corpus is complete.
   *
   * On the stylesheet that produced this package, 173 of 215 markup files carried class names
   * that cannot be read statically (`clsx()`, conditionals, interpolation). With that much
   * missing, a base class looks like it only ever appears beside one modifier, so peers read as
   * modifiers and modifiers read as peers. The tool then reported 173 "high" findings of which
   * most were correct code -- and a checker that is confidently wrong gets switched off in a
   * week, which is worth less than one that says plainly what it cannot see.
   *
   * So below the threshold the analyser still REPORTS every override it found (detection does
   * not depend on the corpus being complete; it depends only on the combinations it was given
   * being real). It withholds the intent verdict, names the number, and names the ONE thing that
   * would restore it. That is the same rule this project applies to its other gates: a check
   * earns the right to assert by being about its subject.
   */
  const confidence = corpusConfidence(corpus);
  const trustIntent = confidence.value === null || confidence.value >= minConfidence;

  const findings = [];
  const seen = new Set();

  for (const combo of combos) {
    const set = new Set(combo);
    // Each state the corpus implies gets its own competition, plus the base (no state).
    const states = statesFor(decls, set);

    for (const state of states) {
      const applicable = decls.filter((d) => applies(d.compound, set, state));

      // group by (context, longhand key)
      const groups = new Map();
      for (const d of applicable) {
        const k = JSON.stringify([d.context, d.key]);
        (groups.get(k) ?? groups.set(k, []).get(k)).push(d);
      }

      for (const [, group] of groups) {
        if (group.length < 2) continue;
        const sorted = [...group].sort(
          (x, y) =>
            Number(x.important) - Number(y.important) ||
            cmpSpecificity(x.spec, y.spec) ||
            x.order - y.order,
        );
        const winner = sorted[sorted.length - 1];

        for (const loser of sorted.slice(0, -1)) {
          if (loser.selector === winner.selector) continue;      // same rule: stylelint's job
          if (loser.value.trim() === winner.value.trim()) continue; // duplication, not a defect

          // A rule for a STATE is not competing with the rule for rest. `.btn:hover{background}`
          // beating `.btn{background}` is the entire purpose of a hover rule, and reporting it
          // would bury every real finding under one per state per property. Only declarations
          // written for the SAME state compete.
          if (loser.compound.states.join("+") !== winner.compound.states.join("+")) continue;

          const equalWeight =
            loser.important === winner.important &&
            cmpSpecificity(loser.spec, winner.spec) === 0;

          // THE HEURISTIC THAT DECIDES WHETHER ANYONE KEEPS THIS TOOL ON. At equal specificity
          // `.btn` then `.btn--danger` is a working modifier and `.btn--danger` then `.btn` is the
          // bug that produced this package; the two are IDENTICAL in the stylesheet. What
          // separates them is DEPENDENCE, read off the corpus rather than off a naming
          // convention: if every element wearing the winner also wears the loser, the winner is a
          // modifier OF the loser and beating it is its purpose. If each appears without the
          // other somewhere, they are peers who collided, and somebody's intent was silently lost.
          const narrowerWins = dependsOn(winner, loser, where);

          const id = `${loser.file}:${loser.line}:${loser.key}:${winner.selector}`;
          if (seen.has(id)) continue;
          seen.add(id);

          findings.push({
            property: loser.key,
            combo: [...set].sort(),
            state: [...state].sort(),
            loser: view(loser),
            winner: view(winner),
            // The distinction that makes the output readable. Losing to HIGHER specificity is
            // ordinary cascade behaviour and usually what the author meant. Losing to EQUAL
            // specificity purely on source order is the case nobody expects, and it is where
            // every real bug that produced this tool actually sat.
            reason: !equalWeight
              ? "lower-specificity"
              : narrowerWins
                ? "narrower-rule-wins"
                : "equal-specificity-source-order",
            severity: !trustIntent
              ? "unranked"
              : equalWeight && !narrowerWins
                ? "high"
                : "low",
            shorthandReset: winner.implicit,
          });
        }
      }
    }
  }

  findings.sort(
    (a, b) => (a.severity === b.severity ? 0 : a.severity === "high" ? -1 : 1) ||
      (a.loser.line ?? 0) - (b.loser.line ?? 0),
  );
  return { findings, skipped, refused: null, confidence };
}

/**
 * What fraction of the markup the corpus actually saw. `null` when no corpus stats were supplied
 * -- an explicitly-passed combos list (a test, a hand-written set) is complete by definition, and
 * inventing a confidence for it would be the same overreach this function exists to prevent.
 */
function corpusConfidence(corpus) {
  if (!corpus || typeof corpus.dynamic !== "number") {
    return { value: null, trusted: true, reason: "combos supplied directly; completeness is the caller's claim, not this tool's" };
  }
  const readable = Math.max(0, (corpus.scanned ?? 0) - corpus.dynamic);
  const total = readable + corpus.dynamic;
  const value = total === 0 ? 0 : readable / total;
  return {
    value,
    trusted: value >= 0.6,
    dynamic: corpus.dynamic,
    scanned: corpus.scanned ?? 0,
    reason:
      value >= 0.6
        ? null
        : `${corpus.dynamic} of ${corpus.scanned ?? 0} markup files carry class names this tool cannot read statically, so it does not know which classes genuinely appear apart. Severity is a claim about INTENT and rests on that. Findings are still real; their RANKING is withheld. To restore it: resolve dynamic class expressions (clsx and friends) into the corpus, or supply combos from a rendered DOM.`,
  };
}

/**
 * Is `a` a modifier OF `b`? True when every element shape carrying a's classes also carries b's —
 * i.e. a never appears without b. Convention-free: it reads the corpus, not the class names, so
 * it works for BEM, for utility classes, and for whatever a codebase invented instead.
 */
function dependsOn(a, b, where) {
  const aSites = intersectAll(a.compound.classes.map((c) => where.get(c)));
  const bSites = intersectAll(b.compound.classes.map((c) => where.get(c)));
  if (!aSites || !bSites || aSites.size === 0) return false;
  if (aSites.size === bSites.size && bSites.size > 0) {
    // Mutually inseparable: they always co-occur, so neither is the modifier and source order is
    // the only thing deciding. That is exactly the case worth reporting, not excusing.
    for (const i of aSites) if (!bSites.has(i)) return false;
    return false;
  }
  for (const i of aSites) if (!bSites.has(i)) return false;
  return true;
}

function intersectAll(sets) {
  if (sets.length === 0 || sets.some((s) => !s)) return null;
  let out = null;
  for (const s of sets) {
    if (out === null) { out = new Set(s); continue; }
    for (const v of [...out]) if (!s.has(v)) out.delete(v);
  }
  return out;
}

function view(d) {
  return {
    selector: d.selector, line: d.line, file: d.file,
    property: d.prop, value: d.value, specificity: d.spec, important: d.important,
  };
}

/** Media/container/supports context key, or null for at-rules we refuse to reason about. */
function contextOf(rule) {
  const parts = [];
  for (let p = rule.parent; p && p.type === "atrule"; p = p.parent) {
    if (["media", "supports", "container"].includes(p.name)) parts.unshift(`@${p.name} ${p.params}`);
    else if (p.name === "keyframes") return null;
    else return null;
  }
  return parts.join(" ");
}

/** Every state combination the stylesheet actually authors for this class set, plus the base. */
function statesFor(decls, set) {
  const out = [new Set()];
  const seen = new Set([""]);
  for (const d of decls) {
    if (d.compound.states.length === 0) continue;
    if (!d.compound.classes.every((c) => set.has(c))) continue;
    const key = d.compound.states.join("+");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(new Set(d.compound.states));
  }
  return out;
}

export { collectCombos } from "./corpus.js";
