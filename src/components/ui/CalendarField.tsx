"use client";

import { CaretLeft, CaretRight, Clock } from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import GlassSelect from "@/components/ui/GlassSelect";
import { pop, press, swap } from "@/lib/motion-presets";

interface CalendarFieldProps {
  /** Local value, "YYYY-MM-DDTHH:mm", or "" when unset. */
  value: string;
  onChange: (value: string) => void;
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const startOfDay = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * A real month calendar plus a time menu — the scheduling control a person
 * expects, instead of a list of day names or the OS datetime widget. Past
 * days are disabled; today is ringed; the selection is a filled disc.
 */
export default function CalendarField({ value, onChange }: CalendarFieldProps) {
  const [datePart, timePart] = value ? value.split("T") : ["", ""];
  const today = startOfDay(new Date());
  const selected = datePart ? new Date(`${datePart}T00:00:00`) : null;
  const [cursor, setCursor] = useState(
    () =>
      new Date(
        (selected ?? today).getFullYear(),
        (selected ?? today).getMonth(),
        1,
      ),
  );

  const grid = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const days: (Date | null)[] = Array.from(
      { length: first.getDay() },
      () => null,
    );
    const total = new Date(
      cursor.getFullYear(),
      cursor.getMonth() + 1,
      0,
    ).getDate();
    for (let i = 1; i <= total; i++) {
      days.push(new Date(cursor.getFullYear(), cursor.getMonth(), i));
    }
    return days;
  }, [cursor]);

  const timeOptions = useMemo(() => {
    const out: { id: string; label: string }[] = [];
    for (let h = 0; h < 24; h++) {
      for (const m of [0, 30]) {
        const id = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        out.push({
          id,
          label: new Date(2000, 0, 1, h, m).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          }),
        });
      }
    }
    return out;
  }, []);

  // The day the person just tapped, so ONLY that disc pops. A selection that
  // was already there on open, or one the grid re-mounts when paging months,
  // is not an event and must not replay the landing.
  const [picked, setPicked] = useState<string | null>(null);

  const pickDay = (d: Date) => {
    setPicked(iso(d));
    onChange(`${iso(d)}T${timePart || "19:00"}`);
  };
  const goMonth = (step: number) => {
    setPicked(null);
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + step, 1));
  };

  const monthLabel = cursor.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
  const canGoBack =
    cursor.getFullYear() > today.getFullYear() ||
    (cursor.getFullYear() === today.getFullYear() &&
      cursor.getMonth() > today.getMonth());

  return (
    <div className="space-y-2">
      {/* Theme ink and fills: this sits inside sheets that turn white in
          light mode, where the fixed-white creator glass it used to wear
          made every numeral vanish. Same well as the GlassSelect below. */}
      <div className="rounded-xl bg-sunken p-3 text-primary">
        <div className="flex items-center justify-between">
          {/* The glyph target is 28px; the ::before carries the press area
              out to 40 without moving the header. */}
          <motion.button
            type="button"
            disabled={!canGoBack}
            onClick={() => goMonth(-1)}
            aria-label="Previous month"
            {...press}
            className="relative flex h-7 w-7 items-center justify-center rounded-pill transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-primary/10 disabled:opacity-25 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"
          >
            <CaretLeft size={12} weight="bold" />
          </motion.button>
          <span className="relative inline-flex font-sans text-[calc(12.5px*var(--ws-fs))] font-semibold text-primary">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={monthLabel}
                {...swap}
                className="inline-block whitespace-nowrap"
              >
                {monthLabel}
              </motion.span>
            </AnimatePresence>
          </span>
          <motion.button
            type="button"
            onClick={() => goMonth(1)}
            aria-label="Next month"
            {...press}
            className="relative flex h-7 w-7 items-center justify-center rounded-pill transition-colors before:absolute before:-inset-1.5 before:content-[''] hover:bg-primary/10 cursor-pointer"
          >
            <CaretRight size={12} weight="bold" />
          </motion.button>
        </div>

        {/* 9.5px is under the floor for text-subtle, so the initials take
            muted. */}
        <div className="mt-2 grid grid-cols-7">
          {WEEKDAYS.map((d, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: weekday initials repeat by design.
              key={`${d}-${i}`}
              className="text-center font-sans text-[calc(9.5px*var(--ws-fs))] font-bold uppercase tracking-[0.08em] text-muted"
            >
              {d}
            </span>
          ))}
        </div>

        {/* The days are their own grid so a month change swaps them and
            leaves the weekday row standing. */}
        <div className="relative mt-1">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={`${cursor.getFullYear()}-${cursor.getMonth()}`}
              {...swap}
              className="grid grid-cols-7 gap-y-1"
            >
              {grid.map((d, i) => {
                if (!d) {
                  return (
                    <span
                      // biome-ignore lint/suspicious/noArrayIndexKey: leading blanks are positional.
                      key={`pad-${i}`}
                    />
                  );
                }
                const past = d < today;
                const isToday = d.getTime() === today.getTime();
                const isSelected = !!selected && d.getTime() === selected.getTime();
                return (
                  <button
                    key={iso(d)}
                    type="button"
                    disabled={past}
                    onClick={() => pickDay(d)}
                    aria-label={d.toDateString()}
                    aria-pressed={isSelected}
                    className={clsx(
                      "relative mx-auto flex h-8 w-8 items-center justify-center rounded-pill font-sans text-[calc(12.5px*var(--ws-fs))] tabular-nums transition-colors",
                      past && "opacity-25 cursor-default",
                      !past &&
                        !isSelected &&
                        "hover:bg-primary/10 cursor-pointer",
                      isSelected ? "font-bold text-page" : "text-primary",
                      isToday && !isSelected && "ring-1 ring-gold/60",
                    )}
                  >
                    {isSelected && (
                      <motion.span
                        aria-hidden
                        // No exit: the disc is not in a presence of its own.
                        initial={picked === iso(d) ? pop.initial : false}
                        animate={pop.animate}
                        className="absolute inset-0 rounded-pill bg-primary"
                      />
                    )}
                    <span className="relative">{d.getDate()}</span>
                  </button>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <GlassSelect
        label="Time"
        placeholder="Pick a time"
        icon={<Clock size={14} />}
        value={timePart}
        options={timeOptions}
        onChange={(time) => onChange(`${datePart || iso(today)}T${time}`)}
      />
    </div>
  );
}
