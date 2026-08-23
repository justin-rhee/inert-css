/**
 * Not a unit test: the acid test. Points the analyser at a real stylesheet, with a corpus
 * collected from that project's own markup, and prints what it finds.
 *
 *   node tests/run-on-real-stylesheet.mjs <projectRoot>
 *
 * Expects <projectRoot>/app/globals.css and component sources under <projectRoot>/components
 * and <projectRoot>/app. Adjust the two paths below for a different layout.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { analyze, collectCombos } from "../src/index.js";

const ROOT = process.argv[2];
if (!ROOT) {
  console.error("usage: node tests/run-on-real-stylesheet.mjs <projectRoot>");
  process.exit(2);
}

const files = execSync(
  `find ${ROOT}/components ${ROOT}/app -name '*.tsx' -not -path '*/node_modules/*'`,
  { encoding: "utf8" },
).trim().split("\n").filter(Boolean);

const { combos, scanned, dynamic } = collectCombos(files);
console.log(`corpus: ${combos.length} class combinations from ${scanned} files (${dynamic} dynamic sites unreadable)`);

const out = analyze({
  css: readFileSync(`${ROOT}/app/globals.css`, "utf8"),
  combos,
  from: "app/globals.css",
  corpus: { scanned, dynamic },   // so the analyser knows what it could not see
});

if (out.refused) {
  console.log("REFUSED:", out.refused);
  process.exit(0);
}

console.log(
  `skipped ${out.skipped.selectors} selectors needing DOM structure, ${out.skipped.atRules} at-rule blocks`,
);

if (!out.confidence.trusted) {
  console.log(`\ncorpus confidence ${(out.confidence.value * 100).toFixed(0)}% — RANKING WITHHELD`);
  console.log(`  ${out.confidence.reason}\n`);
}

const ranked = out.confidence.trusted
  ? out.findings.filter((f) => f.severity === "high")
  : out.findings;
console.log(
  out.confidence.trusted
    ? `findings: ${ranked.length} high, ${out.findings.length - ranked.length} low\n`
    : `findings: ${out.findings.length} overrides, unranked\n`,
);

for (const f of ranked.slice(0, 15)) {
  const state = f.state.length ? ":" + f.state.join(":") : "";
  console.log(`${f.property}  on .${f.combo.join(".")}${state}`);
  console.log(`   loses  ${f.loser.selector}:${f.loser.line}  ${f.loser.property}: ${f.loser.value}`);
  console.log(
    `   to     ${f.winner.selector}:${f.winner.line}  ${f.winner.property}: ${f.winner.value}` +
      (f.shorthandReset ? "   [shorthand reset]" : ""),
  );
}
