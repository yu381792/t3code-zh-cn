import { useTranslate as useUiTranslate } from "~/i18n/translate";
import { useEffect, useRef } from "react";
import { DiffFileHeaderSkeleton } from "../DiffPanelShell";

/** Load the next batch before the reader reaches the end of the current files. */
export function DiffFileLoadingBoundary({ load, count }: { load: () => void; count: number }) {
  const t3T = useUiTranslate();

  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) load();
      },
      { rootMargin: "600px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [load]);
  return (
    <div ref={ref} role="status" aria-label={t3T("Loading diff…")}>
      {Array.from({ length: Math.min(count, 4) }, (_, index) => (
        <div key={index} aria-hidden className="border-b border-border/40">
          <DiffFileHeaderSkeleton titleWidth="medium" />
        </div>
      ))}
    </div>
  );
}
