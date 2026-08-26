import clsx from "clsx";

/**
 * One discovery block: eyebrow, optional live dot, optional trailing link.
 * Every section on Explore uses this so the eight blocks read as one page
 * instead of eight transplants.
 */
export function ExploreSection({
  label,
  live = false,
  trailing,
  delay,
  bleed = false,
  children,
}: {
  label: string;
  live?: boolean;
  trailing?: React.ReactNode;
  delay: number;
  /** Full-bleed children (PostCard owns its own padding). */
  bleed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={clsx("animate-rise pt-6", !bleed && "px-4")}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={clsx("mb-3 flex items-center gap-2", bleed && "px-4")}>
        {live && (
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-pill bg-danger opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-pill bg-danger" />
          </span>
        )}
        <h2 className="min-w-0 flex-1 font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-subtle">
          {label}
        </h2>
        {trailing}
      </div>
      {children}
    </section>
  );
}

/** The trailing "see all" link, identical across sections. */
export function SectionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      className="shrink-0 font-sans text-[11px] font-semibold text-gold hover:underline"
    >
      {children}
    </a>
  );
}

/** Horizontal rail that bleeds to the column edges. */
export function Rail({ children }: { children: React.ReactNode }) {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {children}
    </div>
  );
}
