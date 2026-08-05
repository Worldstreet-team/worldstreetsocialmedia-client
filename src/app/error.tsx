"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

/* Route error boundary — catches render/data errors below the root layout and
   offers recovery instead of a white screen. Styled like EmptyState. */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="min-h-dvh bg-page flex flex-col items-center justify-center p-6 text-center animate-rise">
      <div className="flex h-16 w-16 items-center justify-center rounded-pill bg-raised">
        <RefreshCw className="h-[26px] w-[26px] text-muted" strokeWidth={2} />
      </div>

      <h1 className="mt-4 font-display text-lg font-semibold text-primary">
        Something went wrong
      </h1>
      <p className="mt-2 max-w-[38ch] font-sans text-[13px] leading-relaxed text-muted">
        The page hit an unexpected error. Your data is fine — try loading it
        again.
      </p>
      {error.digest && (
        <p className="mt-2 font-sans text-[11px] uppercase tracking-[1px] text-subtle tabular-nums">
          Error {error.digest}
        </p>
      )}

      <button
        type="button"
        onClick={reset}
        className="mt-6 h-10 inline-flex items-center gap-2 rounded-pill bg-brand px-5 font-sans text-[13px] font-semibold text-brand-on transition-colors hover:bg-brand-active cursor-pointer"
      >
        <RefreshCw className="h-4 w-4" strokeWidth={2.5} />
        Try again
      </button>
    </div>
  );
}
