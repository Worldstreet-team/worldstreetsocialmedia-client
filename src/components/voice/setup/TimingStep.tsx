"use client";

import { CalendarBlank, CaretLeft, CaretRight } from "@phosphor-icons/react";
import clsx from "clsx";
import { type KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMotionReduced } from "@/lib/motion";
import { FloatingPanel } from "./FloatingPanel";
import s from "./setup.module.css";
import { chip, note } from "./styles";
import {
  dayDate,
  dayKey,
  dayLabel,
  horizonDays,
  localDate,
  nearestSlot,
  slotsFor,
  splitWhen,
  timeLabel,
  upcomingDays,
  zoneLabel,
} from "./time";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

/**
 * When the room opens. Now or Later; Later is a day (the next seven as
 * chips, up to 30 days out through "Pick a date") and a half hour (a rail
 * of chips that scrolls sideways), in the host's own time zone, named
 * under the rail.
 *
 * `value` is local "YYYY-MM-DDTHH:mm". In edit mode the room's current
 * time may be one the picker would no longer offer (a slot that has just
 * passed); it is still shown as chosen, and the sheet leaves it out of the
 * save unless it is changed.
 */
export function TimingStep({
  host,
  mode,
  onMode,
  value,
  onChange,
  canGoNow,
}: {
  host: HTMLElement | null;
  mode: "now" | "later";
  onMode: (m: "now" | "later") => void;
  value: string;
  onChange: (v: string) => void;
  /** False in edit mode: editing never turns a booked room into a live one. */
  canGoNow: boolean;
}) {
  const [day, slot] = splitWhen(value);
  // Re-read "now" each render: a sheet left open past a half hour must not
  // keep offering the slot that just went.
  const now = new Date();
  const days = upcomingDays(7, now);
  const valid = slotsFor(day, now);
  const slots = slot && !valid.includes(slot) ? [...valid, slot].sort() : valid;
  const pickRef = useRef<HTMLButtonElement>(null);
  const [pickOpen, setPickOpen] = useState(false);
  const outside = Boolean(day) && !days.includes(day);

  const setDay = (d: string) => onChange(`${d}T${nearestSlot(d, slot || "20:00", now)}`);

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {canGoNow && (
        // biome-ignore lint/a11y/useSemanticElements: two toggle buttons, not a form fieldset.
        <div role="group" aria-label="When" className="flex items-center gap-3 sm:gap-5">
          {(["now", "later"] as const).map((m, i) => (
            <span key={m} className="flex items-center gap-3 sm:gap-5">
              {i === 1 && <span className={note}>or</span>}
              <button
                type="button"
                aria-pressed={mode === m}
                onClick={() => onMode(m)}
                className={clsx(
                  "h-11 cursor-pointer rounded-pill px-3 font-display text-[calc(20px*var(--ws-fs))] font-semibold transition-colors sm:text-[calc(22px*var(--ws-fs))]",
                  mode === m ? "text-primary" : "text-subtle hover:text-muted",
                )}
              >
                {m === "now" ? "Now" : "Later"}
              </button>
            </span>
          ))}
        </div>
      )}

      {mode === "later" && (
        <>
          <Rail label="Day">
            {days.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={d === day}
                onClick={() => setDay(d)}
                className={chip(d === day)}
              >
                {dayLabel(d, now)}
              </button>
            ))}
            <button
              ref={pickRef}
              type="button"
              aria-haspopup="dialog"
              aria-expanded={pickOpen}
              aria-pressed={outside}
              onClick={() => setPickOpen((o) => !o)}
              className={chip(outside)}
            >
              <CalendarBlank size={14} weight={outside ? "fill" : "regular"} />
              {outside ? dayLabel(day, now, true) : "Pick a date"}
            </button>
          </Rail>

          <TimeRail
            // A new day is a new rail: it opens on the chosen time.
            key={day}
            slots={slots}
            value={slot}
            disabled={(t) => !valid.includes(t)}
            onChange={(t) => onChange(`${day}T${t}`)}
          />

          <p className={clsx(note, "text-center")}>
            Times are in {zoneLabel(localDate(value))}
          </p>

          <DatePanel
            open={pickOpen}
            host={host}
            anchor={pickRef}
            value={day}
            onPick={(d) => {
              setDay(d);
              setPickOpen(false);
              pickRef.current?.focus();
            }}
            onClose={(refocus) => {
              setPickOpen(false);
              if (refocus) pickRef.current?.focus();
            }}
          />
        </>
      )}
    </div>
  );
}

/** A centred row of chips that scrolls sideways once it outgrows the screen. */
function Rail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a row of chips, not a form fieldset.
    <div role="group" aria-label={label} className={clsx(s.rail, "w-full max-w-full")}>
      <div className="mx-auto flex w-max gap-2 px-5 py-0.5">{children}</div>
    </div>
  );
}

/**
 * The half hours as one rail, the chosen one kept in view. A radio group:
 * one tab stop, the arrow keys move the time (a keyboard never waits on
 * the scroll), and on a desktop two buttons page the rail.
 */
function TimeRail({
  slots,
  value,
  disabled,
  onChange,
}: {
  slots: string[];
  value: string;
  disabled: (slot: string) => boolean;
  onChange: (slot: string) => void;
}) {
  const reduced = useMotionReduced();
  const rail = useRef<HTMLDivElement>(null);
  const first = useRef(true);

  // Bring the chosen time to the middle: instantly on first show, then
  // with a glide.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the value and the slot count are the triggers.
  useEffect(() => {
    const el = rail.current;
    const chipEl = el?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!el || !chipEl) return;
    // From rects, not offsetLeft: the chip's offsetParent is whatever
    // positioned box sits above the rail, not the rail itself.
    const at = chipEl.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const left = el.scrollLeft + at.left - box.left - el.clientWidth / 2 + at.width / 2;
    el.scrollTo({ left, behavior: first.current || reduced ? "auto" : "smooth" });
    first.current = false;
  }, [value, slots.length, reduced]);

  const enabled = slots.filter((t) => !disabled(t));
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = enabled.indexOf(value);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = Math.min(enabled.length - 1, i + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = Math.max(0, i - 1);
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = enabled.length - 1;
    else return;
    e.preventDefault();
    const t = enabled[next];
    if (!t) return;
    onChange(t);
    // The chip is already in the rail (only its state changes), so the
    // focus moves with the key, not a frame later.
    rail.current?.querySelector<HTMLElement>(`[data-slot="${t}"]`)?.focus({ preventScroll: true });
  };
  const page = (dir: 1 | -1) =>
    rail.current?.scrollBy({
      left: dir * rail.current.clientWidth * 0.6,
      behavior: reduced ? "auto" : "smooth",
    });

  if (slots.length === 0) {
    return <p className={note}>No times left on this day. Pick another.</p>;
  }
  return (
    <div className="flex w-full max-w-[44rem] items-center gap-1">
      <button
        type="button"
        aria-label="Earlier times"
        onClick={() => page(-1)}
        className="hidden h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:text-primary sm:flex"
      >
        <CaretLeft size={15} weight="bold" />
      </button>
      <div
        ref={rail}
        role="radiogroup"
        aria-label="Time"
        onKeyDown={onKey}
        className={clsx(s.rail, "min-w-0 flex-1")}
      >
        <div className="mx-auto flex w-max gap-2 px-5 py-0.5">
          {slots.map((t) => {
            const on = t === value;
            return (
              // biome-ignore lint/a11y/useSemanticElements: a chip that acts as a radio.
              <button
                key={t}
                type="button"
                role="radio"
                aria-checked={on}
                data-slot={t}
                tabIndex={on || (!value && t === enabled[0]) ? 0 : -1}
                disabled={!on && disabled(t)}
                onClick={() => onChange(t)}
                className={chip(on, "tabular-nums")}
              >
                {timeLabel(t)}
              </button>
            );
          })}
        </div>
      </div>
      <button
        type="button"
        aria-label="Later times"
        onClick={() => page(1)}
        className="hidden h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:text-primary sm:flex"
      >
        <CaretRight size={15} weight="bold" />
      </button>
    </div>
  );
}

/**
 * "Pick a date": every day inside the gateway's 30-day horizon on one
 * grid, weeks as rows. The first of a month carries the month's name, so
 * the grid never needs a second header.
 */
function DatePanel({
  open,
  host,
  anchor,
  value,
  onPick,
  onClose,
}: {
  open: boolean;
  host: HTMLElement | null;
  anchor: React.RefObject<HTMLButtonElement | null>;
  value: string;
  onPick: (day: string) => void;
  onClose: (refocus: boolean) => void;
}) {
  const grid = useRef<HTMLDivElement>(null);
  const cells = useMemo(() => {
    if (!open) return [];
    const now = new Date();
    const days = horizonDays(now);
    const ok = new Set(days.filter((d) => slotsFor(d, now).length > 0));
    // Pad to whole weeks, Sunday first.
    const start = dayDate(days[0]);
    start.setDate(start.getDate() - start.getDay());
    const end = dayDate(days[days.length - 1]);
    end.setDate(end.getDate() + (6 - end.getDay()));
    const out: { key: string; ok: boolean }[] = [];
    for (const d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = dayKey(d);
      out.push({ key, ok: ok.has(key) });
    }
    return out;
  }, [open]);

  // Land on the chosen day, or the first open one.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => {
      const el =
        grid.current?.querySelector<HTMLElement>('[aria-pressed="true"]:not(:disabled)') ??
        grid.current?.querySelector<HTMLElement>("button:not(:disabled)");
      el?.focus();
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  const range = cells.length
    ? `${dayDate(cells.find((c) => c.ok)?.key ?? cells[0].key).toLocaleDateString(undefined, { day: "numeric", month: "short" })} to ${dayDate(
        [...cells].reverse().find((c) => c.ok)?.key ?? cells[cells.length - 1].key,
      ).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
    : "";

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      onClose(true);
      return;
    }
    const delta =
      e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : e.key === "ArrowDown" ? 7 : e.key === "ArrowUp" ? -7 : 0;
    if (!delta) return;
    const at = cells.findIndex((c) => c.key === (document.activeElement as HTMLElement)?.dataset.day);
    if (at < 0) return;
    e.preventDefault();
    for (let i = at + delta; i >= 0 && i < cells.length; i += delta) {
      if (cells[i].ok) {
        grid.current?.querySelector<HTMLElement>(`[data-day="${cells[i].key}"]`)?.focus();
        return;
      }
    }
  };

  return (
    <FloatingPanel
      open={open}
      host={host}
      anchor={anchor}
      onDismiss={() => onClose(false)}
      width={344}
      maxHeight={420}
      label="Pick a date"
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: arrow keys move between the day buttons inside. */}
      <div onKeyDown={onKey} className="flex min-h-0 flex-col overflow-y-auto p-3">
        <div className="flex items-baseline justify-between gap-3 px-1 pb-2">
          <b className="font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
            Pick a date
          </b>
          <span className={note}>{range}</span>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map((d, i) => (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: weekday initials repeat by design.
              key={`${d}-${i}`}
              className="text-center font-sans text-[calc(11px*var(--ws-fs))] font-semibold text-muted"
            >
              {d}
            </span>
          ))}
        </div>
        <div ref={grid} className="mt-1 grid grid-cols-7 gap-1">
          {cells.map(({ key, ok }) => {
            const d = dayDate(key);
            const on = key === value;
            const first = d.getDate() === 1;
            return (
              <button
                key={key}
                type="button"
                data-day={key}
                disabled={!ok}
                aria-pressed={on}
                aria-label={d.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
                onClick={() => onPick(key)}
                className={clsx(
                  "relative mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-pill font-sans tabular-nums leading-none transition-colors",
                  on
                    ? "bg-primary font-semibold text-page"
                    : ok
                      ? "cursor-pointer text-primary hover:bg-primary/5"
                      : "cursor-default text-primary opacity-25",
                )}
              >
                {first && (
                  <span className={clsx("text-[calc(9.5px*var(--ws-fs))] font-semibold", on ? "text-page" : "text-gold")}>
                    {d.toLocaleDateString(undefined, { month: "short" })}
                  </span>
                )}
                <span className="text-[calc(13px*var(--ws-fs))]">{d.getDate()}</span>
              </button>
            );
          })}
        </div>
      </div>
    </FloatingPanel>
  );
}
