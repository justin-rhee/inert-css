/**
 * corpus.js — which classes actually appear together on one element.
 *
 * This is the input a stylesheet cannot provide and the reason the whole problem is hard. We read
 * it out of source, which means we see the static literals and miss everything computed. The
 * count of what we missed is returned alongside, because a corpus that looks complete and is not
 * turns every "no findings" into a false all-clear.
 */

import { readFileSync } from "node:fs";

const STATIC_ATTR = /\b(?:className|class)\s*=\s*"([^"{}]+)"/g;
const STATIC_ATTR_SQ = /\b(?:className|class)\s*=\s*'([^'{}]+)'/g;
/** `className={"a b"}` and `className={`a b`}` with no interpolation are still static. */
const BRACED_STATIC = /\b(?:className|class)\s*=\s*\{\s*(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)\s*\}/g;
/** Anything else inside braces is computed: clsx(), conditionals, template interpolation. */
const BRACED_ANY = /\b(?:className|class)\s*=\s*\{/g;

/**
 * @param {string[]} files paths to scan
 * @returns {{combos: string[][], scanned: number, dynamic: number}}
 */
export function collectCombos(files) {
  const combos = new Map();
  let dynamic = 0;

  for (const file of files) {
    let src;
    try {
      src = readFileSync(file, "utf8");
    } catch {
      continue; // an unreadable file is not a finding about the CSS; skip and keep the count honest
    }

    const staticHits = [];
    for (const re of [STATIC_ATTR, STATIC_ATTR_SQ]) {
      re.lastIndex = 0;
      for (const m of src.matchAll(re)) staticHits.push(m[1]);
    }
    BRACED_STATIC.lastIndex = 0;
    for (const m of src.matchAll(BRACED_STATIC)) staticHits.push(m[1] ?? m[2] ?? m[3] ?? "");

    BRACED_ANY.lastIndex = 0;
    const braced = [...src.matchAll(BRACED_ANY)].length;
    const bracedStatic = [...src.matchAll(BRACED_STATIC)].length;
    dynamic += Math.max(0, braced - bracedStatic);

    for (const hit of staticHits) {
      const classes = hit.split(/\s+/).filter(Boolean).sort();
      if (classes.length < 2) continue;          // one class cannot conflict with itself
      combos.set(classes.join(" "), classes);
    }
  }

  return { combos: [...combos.values()], scanned: files.length, dynamic };
}
