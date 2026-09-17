/**
 * corpus.js — which classes actually appear together on one element.
 *
 * This is the input a stylesheet cannot provide and the reason the whole problem is hard. We read
 * it out of source, which means we see the static literals and miss everything computed. The
 * count of what we missed is returned alongside, because a corpus that looks complete and is not
 * turns every "no findings" into a false all-clear.
 *
 * `dynamic` counts FILES that contain at least one unreadable class expression, not the number of
 * such expressions. It is compared against `scanned`, a count of files, in src/index.js's confidence
 * formula and printed as "N of M markup files" everywhere it is reported; mixing a site count into a
 * file-count ratio silently overstates how much markup is unreadable on any file that uses more than
 * one clsx()-style call, which is the common case, not the rare one. An independent review caught
 * this by pointing the tool at one file with three dynamic sites: the old arithmetic reported 3 of 4
 * files unreadable (25% confidence, ranking withheld) when the true figure is 1 of 4 (75%, ranking
 * kept). tests/corpus.test.mjs pins the fixed behavior.
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
  let dynamicFiles = 0;

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
    // A FILE is unreadable, not each computed call site inside it. Whether a file has one dynamic
    // className or five, it is the same one file this tool cannot fully see; counting sites here
    // would make `dynamic` a different unit than `scanned` (a file count), which is exactly the bug
    // described in the header comment above.
    if (braced - bracedStatic > 0) dynamicFiles += 1;

    for (const hit of staticHits) {
      const classes = hit.split(/\s+/).filter(Boolean).sort();
      if (classes.length < 2) continue;          // one class cannot conflict with itself
      combos.set(classes.join(" "), classes);
    }
  }

  return { combos: [...combos.values()], scanned: files.length, dynamic: dynamicFiles };
}
