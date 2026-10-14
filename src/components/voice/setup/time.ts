/**
 * Scheduling arithmetic for room setup, all in the host's local time.
 *
 * The picker speaks local "YYYY-MM-DDTHH:mm" (the CalendarField format the
 * sheet already used); the sheet turns it into an ISO instant only when it
 * sends, so the gateway never parses a naive string in its own timezone.
 */

/** The gateway refuses anything further out than this. */
export const HORIZON_MS = 30 * 86_400_000;
/** A slot this close to now is already gone by the time anyone reads the card. */
export const LEAD_MS = 5 * 60_000;
/** Day chips before "Pick a date". */
export const DAY_CHIPS = 7;
/** Where a new booking lands: the evening, when rooms fill. */
const DEFAULT_SLOT = "20:00";

const pad = (n: number) => String(n).padStart(2, "0");

/** Local "YYYY-MM-DD". */
export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Local midnight of a "YYYY-MM-DD". */
export const dayDate = (key: string) => new Date(`${key}T00:00:00`);

/** "YYYY-MM-DDTHH:mm" → Date (local). Invalid input gives an invalid Date. */
export const localDate = (value: string) => new Date(value);

export const splitWhen = (value: string): [string, string] => {
  const [day = "", time = ""] = value.split("T");
  return [day, time.slice(0, 5)];
};

export const addDays = (key: string, n: number) => {
  const d = dayDate(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

/** Every half hour of a day, "00:00" to "23:30". */
const ALL_SLOTS = Array.from(
  { length: 48 },
  (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? "30" : "00"}`,
);

/** The half hours on `day` a room can still be booked for. */
export function slotsFor(day: string, now = new Date()): string[] {
  const from = now.getTime() + LEAD_MS;
  const to = now.getTime() + HORIZON_MS;
  return ALL_SLOTS.filter((s) => {
    const t = localDate(`${day}T${s}`).getTime();
    return t >= from && t <= to;
  });
}

/** The first `count` days that still have a slot, starting today. */
export function upcomingDays(count = DAY_CHIPS, now = new Date()): string[] {
  const out: string[] = [];
  let key = dayKey(now);
  for (let i = 0; i < count + 2 && out.length < count; i++) {
    if (slotsFor(key, now).length > 0) out.push(key);
    key = addDays(key, 1);
  }
  return out;
}

/** Every day inside the 30-day horizon, today first. */
export function horizonDays(now = new Date()): string[] {
  const out: string[] = [];
  const last = dayKey(new Date(now.getTime() + HORIZON_MS));
  for (let key = dayKey(now); key <= last; key = addDays(key, 1)) out.push(key);
  return out;
}

/** The slot nearest `want` on `day`: the same time if it is free, else the next one, else the last. */
export function nearestSlot(day: string, want: string, now = new Date()) {
  const slots = slotsFor(day, now);
  if (slots.length === 0) return "";
  if (slots.includes(want)) return want;
  return slots.find((s) => s > want) ?? slots[slots.length - 1];
}

/**
 * A new booking's starting point: 8pm today if that is at least an hour
 * off, else 8pm tomorrow.
 */
export function defaultWhen(now = new Date()) {
  const today = dayKey(now);
  const tonight = localDate(`${today}T${DEFAULT_SLOT}`).getTime();
  const day = tonight - now.getTime() >= 60 * 60_000 ? today : addDays(today, 1);
  return `${day}T${nearestSlot(day, DEFAULT_SLOT, now)}`;
}

/** "Today", "Tomorrow", or "Fri 17". */
export function dayLabel(key: string, now = new Date(), long = false) {
  const today = dayKey(now);
  if (key === today) return "Today";
  if (key === addDays(today, 1)) return "Tomorrow";
  return dayDate(key).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    ...(long ? { month: "short" } : {}),
  });
}

/** "8:00 PM" or "20:00", as the host's locale writes a time. */
export function timeLabel(slot: string) {
  const [h, m] = slot.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

/** "Fri 17 Oct at 8:00 PM", or "Today at 8:00 PM". */
export function whenSentence(value: string, now = new Date()) {
  const [day, slot] = splitWhen(value);
  if (!day || !slot) return "";
  return `${dayLabel(day, now, true)} at ${timeLabel(slot)}`;
}

/**
 * The host's zone in words, for the line under the time chips:
 * "West Africa Standard Time (GMT+1)". Read at the picked date, so a
 * booking across a clock change names the right offset.
 */
export function zoneLabel(at: Date = new Date()) {
  const valid = Number.isNaN(at.getTime()) ? new Date() : at;
  const part = (style: "long" | "shortOffset") => {
    try {
      return (
        new Intl.DateTimeFormat(undefined, { timeZoneName: style })
          .formatToParts(valid)
          .find((p) => p.type === "timeZoneName")?.value ?? ""
      );
    } catch {
      return "";
    }
  };
  const long = part("long");
  const offset = part("shortOffset");
  if (!long) return offset;
  if (!offset || long === offset) return long;
  return `${long} (${offset})`;
}
