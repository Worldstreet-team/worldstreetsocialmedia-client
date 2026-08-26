"use client";

import { useEffect, useState } from "react";

function parts(target: string) {
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  const total = Math.floor(diff / 1000);
  return {
    days: Math.floor(total / 86_400),
    hours: Math.floor((total % 86_400) / 3600),
    mins: Math.floor((total % 3600) / 60),
    secs: total % 60,
    live: diff === 0,
  };
}

/**
 * The dramatic clock on a scheduled room: mono digits ticking every second.
 * Under a day it counts H : M : S; beyond that the days lead. When it hits
 * zero it says so instead of sitting at a dead 00:00:00.
 */
export default function Countdown({
  target,
  className,
}: {
  target: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => parts(target));

  useEffect(() => {
    setNow(parts(target));
    const tick = setInterval(() => setNow(parts(target)), 1000);
    return () => clearInterval(tick);
  }, [target]);

  if (now.live) {
    return (
      <span className={className}>
        <span className="font-mono text-[15px] font-bold tracking-[0.08em] text-gold">
          STARTING…
        </span>
      </span>
    );
  }

  const cells =
    now.days > 0
      ? [
          { v: now.days, label: "DAYS" },
          { v: now.hours, label: "HRS" },
          { v: now.mins, label: "MIN" },
        ]
      : [
          { v: now.hours, label: "HRS" },
          { v: now.mins, label: "MIN" },
          { v: now.secs, label: "SEC" },
        ];

  return (
    <span className={className}>
      <span className="flex items-start gap-1.5">
        {cells.map((cell, i) => (
          <span key={cell.label} className="flex items-start gap-1.5">
            {i > 0 && (
              <span className="pt-0.5 font-mono text-[22px] font-bold leading-none text-[#fafaf9]/35">
                :
              </span>
            )}
            <span className="flex flex-col items-center">
              <span className="rounded-lg bg-[#0c0a09]/55 px-2 py-1 font-mono text-[24px] font-bold leading-none tracking-tight text-[#fafaf9] tabular-nums">
                {String(cell.v).padStart(2, "0")}
              </span>
              <span className="mt-1 font-sans text-[8.5px] font-bold uppercase tracking-[0.14em] text-[#fafaf9]/55">
                {cell.label}
              </span>
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

/** Compact inline form for list rows: "2h 14m" / "3d 4h", ticking. */
export function CountdownInline({ target }: { target: string }) {
  const [now, setNow] = useState(() => parts(target));
  useEffect(() => {
    setNow(parts(target));
    const tick = setInterval(() => setNow(parts(target)), 30_000);
    return () => clearInterval(tick);
  }, [target]);
  if (now.live) return <span className="text-gold">now</span>;
  if (now.days > 0)
    return (
      <span className="tabular-nums">
        {now.days}d {now.hours}h
      </span>
    );
  if (now.hours > 0)
    return (
      <span className="tabular-nums">
        {now.hours}h {now.mins}m
      </span>
    );
  return <span className="tabular-nums">{now.mins}m</span>;
}
