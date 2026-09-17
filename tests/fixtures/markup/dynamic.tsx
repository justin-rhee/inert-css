import clsx from "clsx";

// A computed className the corpus reader cannot resolve statically. Kept in the fixture so the
// "dynamic sites unreadable" count this script prints is real rather than always zero.
export function ToggleRow({ active }: { active: boolean }) {
  return <div className={clsx("btn", active && "btn--accent")}>Row</div>;
}
