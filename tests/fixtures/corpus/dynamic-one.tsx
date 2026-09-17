import clsx from "clsx";

export function Toggle({ active }: { active: boolean }) {
  return <div className={clsx("eta", active && "theta")}>Toggle</div>;
}
