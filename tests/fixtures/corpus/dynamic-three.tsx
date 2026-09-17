import clsx from "clsx";

// One FILE, three dynamic call sites. Pins the regression an independent review found: the old
// implementation summed site counts into `dynamic`, so this file alone used to read as three
// unreadable files instead of one.
export function Multi({ a, b, c }: { a: boolean; b: boolean; c: boolean }) {
  return (
    <div>
      <span className={clsx("one", a && "one--a")}>A</span>
      <span className={clsx("two", b && "two--b")}>B</span>
      <span className={clsx("three", c && "three--c")}>C</span>
    </div>
  );
}
