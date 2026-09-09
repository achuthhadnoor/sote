import { useEffect, useState } from "react";

/** Matches `App.css` `@media (max-width: 720px)` — compact chrome for min-width windows. */
export const NARROW_LAYOUT_MQ = "(max-width: 720px)";

export function useNarrowLayout(): boolean {
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && window.matchMedia(NARROW_LAYOUT_MQ).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(NARROW_LAYOUT_MQ);
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  return narrow;
}
