"use client";

import {
  ArrowClockwise,
  Check,
  Plus,
  Spinner,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import clsx from "clsx";
import {
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { VERTICALS } from "@/data/categories";
import type { MyCommunity } from "@/lib/community.actions";
import { FloatingPanel } from "./FloatingPanel";
import { chip, fmt, note } from "./styles";
import { verticalLabel } from "./topics";
import type { useMyCommunities } from "./useMyCommunities";

/** The gateway's cap: a room goes to your followers and up to three communities. */
export const MAX_COMMUNITIES = 3;

type Search = ReturnType<typeof useMyCommunities>;

/** A community the room goes to, as far as the sheet needs to know it. */
export type ChosenCommunity = Pick<MyCommunity, "id" | "name"> &
  Partial<Pick<MyCommunity, "membersCount" | "avatar" | "slug">>;

/** What the gateway refused, pinned to the token it was about. */
export type AudienceProblem = { message: string; communityId?: string };

const keepFocus = (e: { preventDefault: () => void }) => e.preventDefault();

/** A word starts after anything that is not a letter or digit, in any script (the gateway's rule). */
// biome-ignore lint/complexity/useRegexLiterals: a /u literal with \p{} needs an ES2018 target; tsconfig is ES2017.
const WORD_CHAR = new RegExp("[\\p{L}\\p{N}]", "u");

/** Where the query matched, preferring the occurrence the gateway ranked on: the start, then a word start. */
function matchAt(name: string, q: string) {
  if (!q) return -1;
  const hay = name.toLowerCase();
  const needle = q.toLowerCase();
  let first = -1;
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    if (first < 0) first = i;
    if (i === 0 || !WORD_CHAR.test(name[i - 1] ?? "")) return i;
  }
  return first;
}

function Highlight({ text, q }: { text: string; q: string }) {
  const i = matchAt(text, q);
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-semibold text-gold">
        {text.slice(i, i + q.length)}
      </mark>
      {text.slice(i + q.length)}
    </>
  );
}

function CommunityAvatar({ c }: { c: ChosenCommunity }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-primary/10 font-display text-[calc(13px*var(--ws-fs))] font-semibold text-primary">
      {c.avatar && !broken ? (
        // biome-ignore lint/performance/noImgElement: a 32px avatar from the gateway, no layout to protect.
        <img
          src={c.avatar}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        (c.name.trim()[0] ?? "?").toUpperCase()
      )}
    </span>
  );
}

function RowSkeleton() {
  return (
    <div aria-hidden className="flex min-h-12 items-center gap-3 px-2.5 py-1.5">
      <span className="skeleton h-8 w-8 shrink-0 rounded-lg" />
      <span className="flex flex-1 flex-col gap-1.5">
        <span className="skeleton h-3 w-2/5 rounded-pill" />
        <span className="skeleton h-2.5 w-1/4 rounded-pill" />
      </span>
    </div>
  );
}

/**
 * Who the room is for: a topic (suggested from the title, one of the 14
 * verticals) and one "To" field holding your followers plus up to three
 * of your communities.
 *
 * The field searches ALL of the host's communities on the gateway, 40 a
 * page, the next page as the list nears its end; the panel opens above
 * the field so the field stays where the hand is. With nothing typed it
 * opens on the ones they were active in lately, then A to Z. Arrow keys
 * move, Enter adds, Backspace on an empty field takes the last token off,
 * Esc folds the panel. Rows keep the focus in the field (mousedown is
 * cancelled), so typing never stops.
 *
 * `readOnly` is edit mode: a room's audience is fixed once it exists (the
 * gateway has no way to change it), so it is shown, not offered.
 */
export function AudienceStep({
  host,
  topic,
  topics,
  onTopic,
  chosen,
  onChosen,
  search,
  readOnly = false,
  problem,
}: {
  host: HTMLElement | null;
  /** The topic in effect ("" for none). */
  topic: string;
  /** Three verticals to offer as chips. */
  topics: string[];
  onTopic: (id: string) => void;
  chosen: ChosenCommunity[];
  onChosen: (next: ChosenCommunity[]) => void;
  search: Search;
  readOnly?: boolean;
  problem?: AudienceProblem | null;
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const optId = (i: number) => `${uid}-opt-${i}`;
  const field = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const allTopics = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [topicOpen, setTopicOpen] = useState(false);

  const full = chosen.length >= MAX_COMMUNITIES;
  const chosenIds = useMemo(() => new Set(chosen.map((c) => c.id)), [chosen]);
  const { results, recent } = search;
  const q = results.query;

  // The rows in the panel, in keyboard order: the recent shelf above the
  // A to Z list when nothing is typed, the ranked matches otherwise.
  const rows: MyCommunity[] = useMemo(
    () => (q ? results.items : [...recent, ...results.items]),
    [q, results.items, recent],
  );
  const recentCount = q ? 0 : recent.length;

  // A new query starts the cursor at the top.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the query is the signal.
  useEffect(() => {
    setActive(0);
    list.current?.scrollTo({ top: 0 });
  }, [q]);

  // Keep the cursor's row in view, and fetch ahead as it nears the end.
  useEffect(() => {
    if (!open) return;
    document.getElementById(`${uid}-opt-${active}`)?.scrollIntoView({ block: "nearest" });
    if (active >= rows.length - 4) search.loadMore();
  }, [uid, active, open, rows.length, search.loadMore]);

  const add = (c: ChosenCommunity) => {
    if (chosenIds.has(c.id) || full) return;
    onChosen([...chosen, c]);
    // Like a mail "To" field: the next name starts fresh.
    search.setInput("");
  };
  const remove = (id: string) => onChosen(chosen.filter((c) => c.id !== id));
  const toggle = (c: MyCommunity) =>
    chosenIds.has(c.id) ? remove(c.id) : add(c);

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (open) {
        // Stops here: the sheet's own Esc would close the whole setup.
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
      return;
    }
    if (e.key === "Backspace" && !search.input && chosen.length > 0) {
      e.preventDefault();
      remove(chosen[chosen.length - 1].id);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) return setOpen(true);
      if (rows.length === 0) return;
      const step = e.key === "ArrowDown" ? 1 : -1;
      setActive((a) => (a + step + rows.length) % rows.length);
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const hit = open ? rows[active] : undefined;
      if (hit && (chosenIds.has(hit.id) || !full)) toggle(hit);
    }
  };

  const suggested = recent.filter((c) => !chosenIds.has(c.id)).slice(0, 3);
  const shownTopics =
    topic && !topics.includes(topic) ? [topic, ...topics.slice(0, 2)] : topics;

  const placeholder = full
    ? `${MAX_COMMUNITIES} of ${MAX_COMMUNITIES} added`
    : search.allTotal === 0
      ? "You're not in any communities yet"
      : search.allTotal
        ? `Add a community · search all ${fmt(search.allTotal)}`
        : "Add a community";

  /* ---- edit mode: shown, not offered ---- */
  if (readOnly) {
    return (
      <div className="flex w-full flex-col items-center gap-3">
        {verticalLabel(topic) && (
          <div className="flex items-center gap-2">
            <span className={note}>Topic</span>
            <span className={chip(true, "cursor-default")}>{verticalLabel(topic)}</span>
          </div>
        )}
        <div className="flex min-h-12 w-full flex-wrap items-center gap-1.5 rounded-xl bg-primary/5 px-3.5 py-1.5">
          <span className={clsx(note, "mr-0.5")}>To</span>
          <FollowersToken />
          {chosen.map((c) => (
            <span
              key={c.id}
              className="inline-flex h-8 max-w-full items-center rounded-pill bg-primary/10 px-3 font-sans text-[calc(13px*var(--ws-fs))] font-medium text-primary"
            >
              <span className="truncate">{c.name}</span>
            </span>
          ))}
        </div>
        <p className={clsx(note, "text-center")}>
          Who a room goes to is set when it's made, so this part can't change.
        </p>
      </div>
    );
  }

  /* ---- the panel ---- */
  let body: ReactNode;
  if (results.loading) {
    body = (
      <>
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
        <RowSkeleton />
      </>
    );
  } else if (results.error && results.items.length === 0) {
    body = (
      <div className="flex flex-col items-start gap-2 px-3 py-4">
        <p className="font-sans text-[calc(13.5px*var(--ws-fs))] text-muted">
          Couldn't load your communities.
        </p>
        <button
          type="button"
          onMouseDown={keepFocus}
          onClick={search.retry}
          className={chip(false)}
        >
          <ArrowClockwise size={14} weight="bold" />
          Try again
        </button>
      </div>
    );
  } else if (rows.length === 0) {
    body = (
      <p className="px-3 py-4 font-sans text-[calc(13.5px*var(--ws-fs))] text-muted">
        {q
          ? `None of your communities match “${q}”. Try part of the name.`
          : "You're not in any communities yet. Your followers still hear about the room."}
      </p>
    );
  } else {
    body = rows.map((c, i) => {
      const on = chosenIds.has(c.id);
      const off = !on && full;
      const section =
        !q && i === 0 && recentCount > 0
          ? "Recently active"
          : !q && i === recentCount
            ? "All, A to Z"
            : null;
      return (
        <div key={`${i < recentCount ? "r" : "a"}-${c.id}`}>
          {section && (
            <div
              role="presentation"
              className="px-2.5 pb-1 pt-2.5 font-sans text-[calc(12.5px*var(--ws-fs))] font-medium text-muted"
            >
              {section}
            </div>
          )}
          {/* biome-ignore lint/a11y/useKeyWithClickEvents: the field owns the keyboard (aria-activedescendant). */}
          <div
            id={optId(i)}
            role="option"
            tabIndex={-1}
            aria-selected={on}
            aria-disabled={off || undefined}
            onMouseDown={keepFocus}
            onMouseMove={() => setActive(i)}
            onClick={() => !off && toggle(c)}
            className={clsx(
              "flex min-h-12 w-full items-center gap-3 rounded-lg px-2.5 py-1.5 text-left transition-colors",
              i === active && "bg-primary/5",
              off ? "cursor-default opacity-40" : "cursor-pointer",
            )}
          >
            <CommunityAvatar c={c} />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="truncate font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
                <Highlight text={c.name} q={q} />
              </span>
              <span className="mt-0.5 font-sans text-[calc(12px*var(--ws-fs))] tabular-nums text-muted">
                {fmt(c.membersCount)} {c.membersCount === 1 ? "member" : "members"}
              </span>
            </span>
            <span
              aria-hidden
              className={clsx(
                "flex h-5 w-5 shrink-0 items-center justify-center rounded-pill",
                on ? "bg-brand text-brand-on" : "ring-2 ring-inset ring-primary/25",
              )}
            >
              {on && <Check size={11} weight="bold" />}
            </span>
          </div>
        </div>
      );
    });
  }

  const remaining = Math.max(0, results.total - results.items.length);
  const footer = results.loadingMore ? (
    <span className="flex items-center gap-2">
      <Spinner size={13} weight="bold" className="animate-spin" />
      Loading more
    </span>
  ) : results.error && results.items.length > 0 ? (
    <span className="flex items-center gap-2">
      Couldn't load more.
      <button
        type="button"
        onMouseDown={keepFocus}
        onClick={search.retry}
        className="cursor-pointer font-medium text-primary underline underline-offset-2"
      >
        Try again
      </button>
    </span>
  ) : results.hasMore ? (
    q ? (
      `Showing ${fmt(results.items.length)} of ${fmt(results.total)}. Scroll for more, or keep typing.`
    ) : (
      `${fmt(remaining)} more. Type to search all of them.`
    )
  ) : null;

  return (
    <div className="flex w-full flex-col items-center gap-3">
      {/* Topic: suggested from the title, the 14 a tap away. */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <span className={clsx(note, "mr-0.5 font-medium")}>Topic</span>
        {shownTopics.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={topic === id}
            onClick={() => onTopic(topic === id ? "" : id)}
            className={chip(topic === id)}
          >
            {verticalLabel(id)}
          </button>
        ))}
        <button
          ref={allTopics}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={topicOpen}
          onClick={() => setTopicOpen((o) => !o)}
          className={chip(false)}
        >
          All topics
        </button>
      </div>

      {/* The "To" field. A press anywhere in it that is not a control focuses the input. */}
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a convenience; the input is the real control. */}
      <div
        ref={field}
        onMouseDown={(e) => {
          if ((e.target as HTMLElement).closest("button,input")) return;
          e.preventDefault();
          input.current?.focus();
        }}
        className="flex min-h-12 w-full cursor-text flex-wrap items-center gap-1.5 rounded-xl bg-primary/10 py-1.5 pl-3.5 pr-2 transition-shadow focus-within:ring-2 focus-within:ring-gold"
      >
        <span className={clsx(note, "mr-0.5")}>To</span>
        <FollowersToken />
        {chosen.map((c) => {
          const bad = problem?.communityId === c.id;
          return (
            <span
              key={c.id}
              className={clsx(
                "inline-flex h-8 max-w-full items-center gap-0.5 rounded-pill pl-3 pr-1 font-sans text-[calc(13px*var(--ws-fs))] font-medium",
                bad ? "bg-danger/15 text-danger ring-1 ring-inset ring-danger" : "bg-primary text-page",
              )}
            >
              <span className="max-w-[16rem] truncate">{c.name}</span>
              <button
                type="button"
                aria-label={`Remove ${c.name}`}
                onMouseDown={keepFocus}
                onClick={() => remove(c.id)}
                className="relative flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded-pill opacity-70 transition-opacity before:absolute before:-inset-2 before:content-[''] hover:opacity-100"
              >
                <X size={12} weight="bold" />
              </button>
            </span>
          );
        })}
        <input
          ref={input}
          value={search.input}
          onChange={(e) => {
            search.setInput(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={onKey}
          role="combobox"
          aria-label="Add a community"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && rows[active] ? optId(active) : undefined}
          autoComplete="off"
          spellCheck={false}
          maxLength={48}
          placeholder={placeholder}
          className="h-9 min-w-[10rem] flex-1 bg-transparent font-sans text-base font-medium text-primary caret-gold outline-none placeholder:font-normal placeholder:text-subtle sm:text-[calc(14px*var(--ws-fs))]"
        />
      </div>

      {/* Under the field: the room's likely communities, or why there are no more. */}
      <div className="flex min-h-10 flex-wrap items-center justify-center gap-2 text-center">
        {problem ? (
          <p role="alert" className="flex items-center gap-1.5 font-sans text-[calc(13px*var(--ws-fs))] text-danger">
            <WarningCircle size={15} weight="fill" className="shrink-0" />
            {problem.message}
          </p>
        ) : full ? (
          <span className={note}>
            That's the most a room can go to. Remove one to add another.
          </span>
        ) : suggested.length > 0 ? (
          <>
            <span className={note}>Suggested for this room</span>
            {suggested.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={keepFocus}
                onClick={() => add(c)}
                className={chip(false)}
              >
                <Plus size={12} weight="bold" />
                {c.name}
              </button>
            ))}
          </>
        ) : null}
      </div>

      <FloatingPanel
        open={open}
        host={host}
        anchor={field}
        onDismiss={() => setOpen(false)}
        role="presentation"
        label="Your communities"
      >
        {/* biome-ignore lint/a11y/noStaticElementInteractions: keeps the field focused while the list is used by pointer. */}
        <div onMouseDown={keepFocus} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-3">
            <b className="font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
              {q
                ? results.loading
                  ? "Searching"
                  : results.total
                    ? `${fmt(results.total)} ${results.total === 1 ? "match" : "matches"}`
                    : "No matches"
                : "Your communities"}
            </b>
            <span className={clsx(note, "tabular-nums")}>
              {!q && search.allTotal ? `${fmt(search.allTotal)} · ` : ""}
              {chosen.length} of {MAX_COMMUNITIES} chosen
            </span>
          </div>
          {full && (
            <p className="mx-3 mb-1.5 rounded-lg bg-primary/5 px-3 py-2 font-sans text-[calc(13px*var(--ws-fs))] text-muted">
              A room can go to three communities. Remove one to add another.
            </p>
          )}
          <div
            ref={list}
            id={listId}
            role="listbox"
            aria-label="Your communities"
            onScroll={(e) => {
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight > el.scrollHeight - 120) search.loadMore();
            }}
            className={clsx(
              "min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5 transition-opacity",
              (results.stale || search.settling) && "opacity-60",
            )}
          >
            {body}
          </div>
          {footer && (
            <div className="shrink-0 border-t border-hairline px-4 py-2.5 font-sans text-[calc(12.5px*var(--ws-fs))] text-muted">
              {footer}
            </div>
          )}
        </div>
      </FloatingPanel>

      <TopicPanel
        open={topicOpen}
        host={host}
        anchor={allTopics}
        topic={topic}
        onClose={(refocus) => {
          setTopicOpen(false);
          if (refocus) allTopics.current?.focus();
        }}
        onPick={onTopic}
      />
    </div>
  );
}

function FollowersToken() {
  return (
    <span className="inline-flex h-8 items-center rounded-pill bg-primary/10 px-3 font-sans text-[calc(13px*var(--ws-fs))] font-medium text-primary ring-1 ring-inset ring-hairline">
      Your followers
    </span>
  );
}

/** "All topics": the 14 verticals with a filter, the same keys as the field. */
function TopicPanel({
  open,
  host,
  anchor,
  topic,
  onClose,
  onPick,
}: {
  open: boolean;
  host: HTMLElement | null;
  anchor: React.RefObject<HTMLButtonElement | null>;
  topic: string;
  onClose: (refocus: boolean) => void;
  onPick: (id: string) => void;
}) {
  const uid = useId();
  const [tq, setTq] = useState("");
  const [active, setActive] = useState(0);
  const s = tq.trim().toLowerCase();
  const list = VERTICALS.filter(
    (v) => !s || v.label.toLowerCase().includes(s) || v.blurb.toLowerCase().includes(s),
  );

  useEffect(() => {
    if (open) {
      setTq("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    document.getElementById(`${uid}-t-${active}`)?.scrollIntoView({ block: "nearest" });
  }, [active, uid]);

  const pick = (id: string) => {
    onPick(id);
    onClose(true);
  };

  return (
    <FloatingPanel
      open={open}
      host={host}
      anchor={anchor}
      onDismiss={() => onClose(false)}
      width={440}
      maxHeight={440}
      label="All topics"
    >
      <div className="flex items-baseline justify-between gap-3 px-4 pb-2 pt-3">
        <b className="font-sans text-[calc(14px*var(--ws-fs))] font-semibold text-primary">
          All topics
        </b>
        <span className={note}>{VERTICALS.length} topics</span>
      </div>
      <input
        // biome-ignore lint/a11y/noAutofocus: the panel opened to be searched.
        autoFocus
        value={tq}
        onChange={(e) => {
          setTq(e.target.value);
          setActive(0);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            onClose(true);
          } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (list.length === 0) return;
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((a) => (a + step + list.length) % list.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            const hit = list[active];
            if (hit) pick(hit.id);
          }
        }}
        role="combobox"
        aria-label="Search topics"
        aria-expanded
        aria-controls={`${uid}-tl`}
        aria-activedescendant={list[active] ? `${uid}-t-${active}` : undefined}
        placeholder="Search topics"
        className="mx-3 mb-1.5 h-10 shrink-0 rounded-lg bg-primary/5 px-3 font-sans text-base font-medium text-primary caret-gold outline-none placeholder:font-normal placeholder:text-subtle sm:text-[calc(14px*var(--ws-fs))]"
      />
      <div
        id={`${uid}-tl`}
        role="listbox"
        aria-label="Topics"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-1.5 pb-1.5"
      >
        {list.length === 0 ? (
          <p className="px-3 py-4 font-sans text-[calc(13.5px*var(--ws-fs))] text-muted">
            No topic matches “{tq.trim()}”.
          </p>
        ) : (
          list.map((v, i) => {
            const on = topic === v.id;
            return (
              // biome-ignore lint/a11y/useKeyWithClickEvents: the search field owns the keyboard.
              <div
                key={v.id}
                id={`${uid}-t-${i}`}
                role="option"
                tabIndex={-1}
                aria-selected={on}
                onMouseDown={keepFocus}
                onMouseMove={() => setActive(i)}
                onClick={() => pick(v.id)}
                className={clsx(
                  "flex min-h-12 cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5",
                  i === active && "bg-primary/5",
                )}
              >
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="font-sans text-[calc(14px*var(--ws-fs))] font-medium text-primary">
                    <Highlight text={v.label} q={tq.trim()} />
                  </span>
                  <span className="mt-0.5 truncate font-sans text-[calc(12px*var(--ws-fs))] text-muted">
                    {v.blurb}
                  </span>
                </span>
                <span
                  aria-hidden
                  className={clsx(
                    "flex h-5 w-5 shrink-0 items-center justify-center rounded-pill",
                    on ? "bg-brand text-brand-on" : "ring-2 ring-inset ring-primary/25",
                  )}
                >
                  {on && <Check size={11} weight="bold" />}
                </span>
              </div>
            );
          })
        )}
      </div>
    </FloatingPanel>
  );
}
