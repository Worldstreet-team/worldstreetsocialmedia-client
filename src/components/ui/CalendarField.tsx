"use client";

import { CaretLeft, CaretRight, Clock } from "@phosphor-icons/react";
import clsx from "clsx";
import { useMemo, useState } from "react";
import GlassSelect from "@/components/ui/GlassSelect";

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

  const pickDay = (d: Date) => onChange(`${iso(d)}T${timePart || "19:00"}`);

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
      <div className="rounded-xl glass-input p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1),
              )
            }
            aria-label="Previous month"
            className="flex h-7 w-7 items-center justify-center rounded-pill transition-colors hover:bg-[#fafaf9]/10 disabled:opacity-25 disabled:hover:bg-transparent cursor-pointer disabled:cursor-default"
          >
            <CaretLeft size={12} weight="bold" />
          </button>
          <span className="font-sans text-[12.5px] font-semibold glass-ink">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() =>
              setCursor(
                new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1),
              )
            }
            aria-label="Next month"
            className="flex h-7 w-7 items-center justify-center rounded-pill transition-colors hover:bg-[#fafaf9]/10 cursor-pointer"
          >
            <CaretRight size={12} weight="bold" />
          </button>
        </div>

        <div className="mt-2 grid grid-cols-7 gap-y-1">
          {WEEKDAYS.map((d, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: weekday initials repeat by design.
              key={`${d}-${i}`}
              className="text-center font-sans text-[9.5px] font-bold uppercase tracking-[0.08em] text-[#fafaf9]/35"
            >
              {d}
            </span>
          ))}
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
                  "mx-auto flex h-8 w-8 items-center justify-center rounded-pill font-sans text-[12.5px] tabular-nums transition-colors",
                  past && "opacity-25 cursor-default",
                  !past &&
                    !isSelected &&
                    "hover:bg-[#fafaf9]/10 cursor-pointer",
                  isSelected
                    ? "bg-[#fafaf9] font-bold text-[#0c0a09]"
                    : "glass-ink",
                  isToday && !isSelected && "ring-1 ring-gold/60",
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
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
