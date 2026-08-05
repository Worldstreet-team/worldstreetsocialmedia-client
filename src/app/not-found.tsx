import Link from "next/link";
import Image from "next/image";

/* Branded 404 — the app-router default is unstyled. Same visual language as
   EmptyState (raised icon circle, title/caption, one primary action). */
export default function NotFound() {
  return (
    <div className="min-h-dvh bg-page flex flex-col items-center justify-center p-6 text-center animate-rise">
      <div className="flex items-center gap-2 mb-8">
        <Image
          src="/images/logo.png"
          alt="WorldStreet"
          width={28}
          height={28}
        />
        <span className="font-display font-bold text-[17px] text-primary">
          WorldStreet
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[2px] text-gold">
          Socials
        </span>
      </div>

      <p className="font-display text-[64px] font-semibold leading-none text-raised select-none tabular-nums">
        404
      </p>

      <h1 className="mt-4 font-display text-lg font-semibold text-primary">
        This page doesn&apos;t exist
      </h1>
      <p className="mt-2 max-w-[38ch] font-sans text-[13px] leading-relaxed text-muted">
        The link may be broken, or the page may have been removed. Check the
        address, or head back to your feed.
      </p>

      <Link
        href="/"
        className="mt-6 h-10 inline-flex items-center rounded-pill bg-brand px-5 font-sans text-[13px] font-semibold text-brand-on transition-colors hover:bg-brand-active"
      >
        Back to your feed
      </Link>
    </div>
  );
}
