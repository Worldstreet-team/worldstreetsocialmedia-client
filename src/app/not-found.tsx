import Link from "next/link";
import { BrandRitual } from "@/components/layout/BrandRitual";

/* Branded 404 — the app-router default is unstyled. Same visual language as
   EmptyState (raised icon circle, title/caption, one primary action). */
export default function NotFound() {
  return (
    <div className="min-h-dvh bg-page flex flex-col items-center justify-center p-6 text-center animate-rise">
      {/* The product lockup, not the retired gold W under a "Socials"
          eyebrow: a lost visitor should still see which app they are in. */}
      <BrandRitual size={28} wordSize={17} className="mb-8" />

      <p className="font-display text-[calc(64px*var(--ws-fs))] font-semibold leading-none text-raised select-none tabular-nums">
        404
      </p>

      <h1 className="mt-4 font-display text-lg font-semibold text-primary">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-2 max-w-[38ch] font-sans text-[calc(13px*var(--ws-fs))] leading-relaxed text-muted">
        The link may be broken, or the page may have been removed. Check the
        address, or head back to your feed.
      </p>

      <Link
        href="/"
        className="mt-6 h-10 inline-flex items-center rounded-pill bg-brand px-5 font-sans text-[calc(13px*var(--ws-fs))] font-semibold text-brand-on transition-colors hover:bg-brand-active"
      >
        Back to your feed
      </Link>
    </div>
  );
}
