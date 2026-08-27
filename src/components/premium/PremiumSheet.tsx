"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import VerifiedIcon from "@/assets/icons/VerifiedIcon";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ChartLineUp,
  ChatCircle,
  Crown,
  Lightning,
  SealCheck,
  Sparkle,
  TextAa,
  TrendUp,
  X,
} from "@phosphor-icons/react";
import { useAtom } from "jotai";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import WolfIcon from "@/assets/icons/WolfIcon";
import { useToast } from "@/components/ui/Toast/ToastContext";
import {
  cancelSubscriptionAction,
  getSubscriptionAction,
  subscribeAction,
  type MembershipTier,
  type SubscriptionState,
} from "@/lib/subscription.actions";
import { premiumOpenAtom } from "@/store/ui.atom";
import { userAtom } from "@/store/user.atom";
import { useT } from "@/i18n/client";

const EASE = [0.2, 0, 0, 1] as const;
/* The orbit's own curve: a slight overshoot so the glyphs land with a bounce
   rather than easing flatly into place. */
const ORBIT_EASE = [0.22, 1.35, 0.36, 1] as const;

/**
 * Metal per tier — the same literals VerifiedIcon pins, because they are the
 * material of the mark, not theme colours. rgb triplets so washes can be
 * mixed at any alpha without a parser.
 */
const METALS: Record<MembershipTier, { hex: string; rgb: string }> = {
  bronze: { hex: "#B87333", rgb: "184 115 51" },
  silver: { hex: "#B8BCC4", rgb: "184 188 196" },
  gold: { hex: "#EAB308", rgb: "234 179 8" },
};

/**
 * The glyph ring around the seal: eight icons on a loose circle, blurred and
 * tinted with the tier's metal so they read as atmosphere, not content.
 * Positions are % of the hero box; sizes vary so the ring has depth.
 */
const ORBIT: {
  Icon: React.ComponentType<{ size?: number; weight?: any }>;
  x: string;
  y: string;
  s: number;
}[] = [
  { Icon: SealCheck, x: "14%", y: "22%", s: 20 },
  { Icon: TextAa, x: "27%", y: "62%", s: 16 },
  { Icon: TrendUp, x: "10%", y: "48%", s: 14 },
  { Icon: Crown, x: "50%", y: "8%", s: 16 },
  { Icon: ChartLineUp, x: "72%", y: "60%", s: 16 },
  { Icon: Lightning, x: "85%", y: "40%", s: 14 },
  { Icon: Sparkle, x: "81%", y: "18%", s: 18 },
  { Icon: ChatCircle, x: "62%", y: "72%", s: 14 },
];

/**
 * The verified-subscription sheet: the pitch when you are not subscribed, the
 * management surface when you are. One sheet for both, because the moment
 * after subscribing should show you what you now hold, not a dead end.
 *
 * Frosted glass (owner ruling): translucent theme-following frost, no border,
 * blur at the usage site. The hero wears the selected tier — its metal fades
 * from the top of the card into the frost, and the glyph ring re-enters with
 * a staggered vertical cascade whenever the tier changes.
 */
export function PremiumSheet() {
  const t = useT();
  const { toast } = useToast();
  const [open, setOpen] = useAtom(premiumOpenAtom);
  const [user, setUser] = useAtom(userAtom);
  const reduce = useReducedMotion();

  const [state, setState] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  // Gold is preselected: it is the level the tick was designed around, and the
  // cheaper rungs read as a step down from it rather than a default.
  const [tier, setTier] = useState<MembershipTier>("gold");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getSubscriptionAction();
    if (res.success) setState(res.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open) return;
    setError(null);
    void load();
  }, [open, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const sub = state?.subscription;
  const live = sub && (sub.status === "active" || sub.status === "past_due");
  const metal = METALS[tier];

  // Prices come from the gateway's ladder; these are only a first paint before
  // it answers, and the server re-derives the real amount at charge time.
  const ladder: { id: MembershipTier; priceUsdMinor: number }[] =
    state?.tiers ?? [
      { id: "bronze", priceUsdMinor: 5_000 },
      { id: "silver", priceUsdMinor: 25_000 },
      { id: "gold", priceUsdMinor: 50_000 },
    ];
  const selected = ladder.find((x) => x.id === tier) ?? ladder[ladder.length - 1];
  const price = (selected.priceUsdMinor / 100)
    .toFixed(2)
    .replace(/\.00$/, "");
  const periodEnd = sub
    ? new Date(sub.currentPeriodEnd).toLocaleDateString(t.locale, {
        month: "long",
        day: "numeric",
      })
    : "";

  const subscribe = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await subscribeAction(tier);
    setBusy(false);
    if (res.success) {
      // The tick is live server-side; reflect it in the hydrated atom so the
      // whole app updates without a reload.
      setUser((prev: any) =>
        prev
          ? {
              ...prev,
              isVerified: true,
              verification: { ...(prev.verification ?? {}), tier },
            }
          : prev,
      );
      toast(t("premium.verifiedSince"), { type: "success" });
      void load();
      return;
    }
    if (res.code === "INSUFFICIENT_BALANCE") setError(t("premium.insufficient"));
    else if (res.status === 503) setError(t("premium.unavailable"));
    else setError(res.message);
  };

  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    const res = await cancelSubscriptionAction();
    setBusy(false);
    if (res.success) void load();
    else toast(res.message, { type: "error" });
  };

  // The list is a function of the selected tier: the sheet has to show what
  // THIS level buys, not one plan's worth of promises. Perks the tier does not
  // include are dropped rather than greyed out — a list you can read top to
  // bottom beats a list of things you cannot have.
  const PERKS: {
    icon: React.ReactNode;
    title: string;
    sub: string;
  }[] = [
    {
      icon: (
        <VerifiedIcon size={{ width: "17", height: "17" }} tier={tier} />
      ),
      title: t("premium.perk.tick"),
      sub: t(`premium.perk.tickSub.${tier}`),
    },
    {
      icon: <TextAa size={17} weight="duotone" className="text-muted" />,
      title: t("premium.perk.composer"),
      sub: t(`premium.perk.composerSub.${tier}`),
    },
    {
      icon: <Sparkle size={17} weight="duotone" className="text-muted" />,
      title: t("premium.perk.vivid"),
      sub: t(`premium.perk.vividSub.${tier}`),
    },
    ...(tier === "bronze"
      ? []
      : [
          {
            icon: (
              <ChartLineUp size={17} weight="duotone" className="text-muted" />
            ),
            title: t("premium.perk.analytics"),
            sub: t("premium.perk.analyticsSub"),
          },
        ]),
    {
      icon: <TrendUp size={17} weight="duotone" className="text-muted" />,
      title: t("premium.perk.reach"),
      sub: t("premium.perk.reachSub"),
    },
    // The Wolf is the summit perk: gold only, by design — it is what the
    // $500 rung is FOR.
    ...(tier === "gold"
      ? [
          {
            icon: <WolfIcon size={18} />,
            title: t("premium.perk.wolf"),
            sub: t("premium.perk.wolfSub"),
          },
        ]
      : []),
  ];

  /* Orbit choreography: the layer re-keys per tier, children cascade in with
     alternating vertical directions and a per-glyph delay. Exit runs the same
     cascade outward, so a tier switch reads as the old metal lifting away and
     the new one settling in. */
  const orbitLayer = {
    hidden: {},
    visible: { transition: { staggerChildren: reduce ? 0 : 0.05 } },
    exit: { transition: { staggerChildren: reduce ? 0 : 0.03 } },
  };
  const orbitGlyph = {
    hidden: (i: number) => ({
      y: reduce ? 0 : i % 2 === 0 ? -22 : 22,
      opacity: 0,
    }),
    visible: {
      y: 0,
      opacity: 0.35,
      transition: { duration: reduce ? 0 : 0.7, ease: ORBIT_EASE },
    },
    exit: (i: number) => ({
      y: reduce ? 0 : i % 2 === 0 ? 22 : -22,
      opacity: 0,
      transition: { duration: reduce ? 0 : 0.35, ease: EASE },
    }),
  };

  return (
    <ConfirmModalPortal>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2, ease: EASE }}
        className="fixed inset-0 z-modal flex items-end justify-center glass-veil-sheer backdrop-blur-md backdrop-saturate-150 sm:items-center sm:p-6"
        onClick={() => setOpen(false)}
      >
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.985 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.32, ease: EASE }}
          role="dialog"
          aria-modal="true"
          aria-label={t("premium.title")}
          /* Frosted, theme-following, borderless. The page reads through it. */
          className="relative max-h-[92dvh] w-full overflow-y-auto overflow-x-hidden rounded-t-2xl glass-frost backdrop-blur-2xl backdrop-saturate-150 pb-safe text-primary sm:max-w-[440px] sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Hero: wears the tier ─────────────────────────────────── */}
          <div className="relative overflow-hidden">
            {/* The metal, fading from the top edge into the frost. Crossfades
                between tiers rather than snapping. */}
            <AnimatePresence initial={false}>
              <motion.div
                key={tier}
                aria-hidden
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: reduce ? 0 : 0.45, ease: EASE }}
                className="pointer-events-none absolute inset-0"
                style={{
                  background: `linear-gradient(180deg, rgb(${metal.rgb} / 0.28) 0%, rgb(${metal.rgb} / 0.10) 52%, rgb(${metal.rgb} / 0) 100%)`,
                }}
              />
            </AnimatePresence>

            {/* The glyph ring. Blurred so it stays atmosphere. */}
            <AnimatePresence initial={false} mode="popLayout">
              <motion.div
                key={tier}
                aria-hidden
                variants={orbitLayer}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="pointer-events-none absolute inset-0"
              >
                {ORBIT.map(({ Icon, x, y, s }, i) => (
                  <motion.span
                    key={i}
                    custom={i}
                    variants={orbitGlyph}
                    className="absolute blur-[2px]"
                    style={{ left: x, top: y, color: metal.hex }}
                  >
                    <Icon size={s} weight="fill" />
                  </motion.span>
                ))}
              </motion.div>
            </AnimatePresence>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t("common.cancel")}
              className="absolute right-4 top-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill glass-tile text-muted transition-colors hover:text-primary"
            >
              <X size={15} weight="bold" />
            </button>

            <div className="relative flex flex-col items-center px-6 pb-4 pt-10 text-center">
              <motion.span
                key={`seal-${tier}`}
                initial={reduce ? false : { scale: 0.9, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: ORBIT_EASE }}
                className="flex h-20 w-20 items-center justify-center rounded-pill"
                style={{ background: `rgb(${metal.rgb} / 0.14)` }}
              >
                <VerifiedIcon size={{ width: "44", height: "44" }} tier={tier} />
              </motion.span>
              <span
                className="mt-4 font-sans text-[11px] font-bold uppercase tracking-[0.16em]"
                style={{ color: metal.hex }}
              >
                {t("premium.eyebrow")}
              </span>
              <h2 className="mt-2 font-display text-[28px] font-semibold leading-[1.1] tracking-[-0.02em]">
                {live ? t("premium.manageTitle") : t("premium.title")}
              </h2>
              {!live && (
                <p className="mt-2.5 max-w-[34ch] font-sans text-[14px] leading-relaxed text-muted">
                  {t("premium.pitch")}
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col gap-2.5 px-6 py-6">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-xl bg-raised animate-pulse" />
              ))}
            </div>
          ) : (
            <>
              {/* status card, only while a subscription is live */}
              {live && (
                <div className="mx-6 mt-2 rounded-xl glass-tile p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={clsx(
                        "flex h-6 items-center gap-1.5 rounded-pill px-2.5 font-sans text-[11px] font-bold uppercase tracking-wide",
                        sub!.status === "past_due"
                          ? "bg-danger/15 text-danger"
                          : "",
                      )}
                      style={
                        sub!.status === "past_due"
                          ? undefined
                          : {
                              background: `rgb(${metal.rgb} / 0.15)`,
                              color: metal.hex,
                            }
                      }
                    >
                      {sub!.status === "past_due"
                        ? t("premium.pastDue")
                        : t("premium.active")}
                    </span>
                    <span className="font-sans text-[12.5px] tabular-nums text-muted">
                      {(sub!.cancelAtPeriodEnd
                        ? t("premium.keeps")
                        : t("premium.renews")
                      ).replace("{date}", periodEnd)}
                    </span>
                  </div>
                  {sub!.cancelAtPeriodEnd && (
                    <p className="mt-2.5 font-sans text-[12.5px] leading-relaxed text-subtle">
                      {t("premium.canceledNote")}
                    </p>
                  )}
                  {sub!.status === "past_due" && (
                    <p className="mt-2.5 font-sans text-[12.5px] leading-relaxed text-subtle">
                      {t("premium.pastDueNote")}
                    </p>
                  )}
                </div>
              )}

              <div className="flex flex-col gap-1 px-4 py-4">
                {PERKS.map((perk) => (
                  <div
                    key={perk.title}
                    className="flex items-center gap-3.5 rounded-xl px-2.5 py-2.5"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl glass-tile ">
                      {perk.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-sans text-[14px] font-semibold leading-snug">
                        {perk.title}
                      </span>
                      <span className="block font-sans text-[12.5px] leading-snug text-muted">
                        {perk.sub}
                      </span>
                    </span>
                  </div>
                ))}
              </div>

              <div className="px-6 pb-6">
                {/* Three levels, same tick in three metals. Selecting one only
                    changes what gets charged — the price itself is always the
                    gateway's, never this component's. */}
                {!live && (
                  <div className="mb-6 mt-1 flex gap-2.5">
                    {ladder.map((rung) => {
                      const on = rung.id === tier;
                      const m = METALS[rung.id];
                      return (
                        <button
                          key={rung.id}
                          type="button"
                          onClick={() => setTier(rung.id)}
                          aria-pressed={on}
                          className={clsx(
                            "relative flex-1 cursor-pointer rounded-xl px-2 pb-3 pt-3.5 text-center transition-all",
                            on ? "" : "glass-tile ",
                          )}
                          style={
                            on
                              ? {
                                  background: `rgb(${m.rgb} / 0.13)`,
                                  boxShadow: `inset 0 0 0 1.5px rgb(${m.rgb} / 0.55)`,
                                }
                              : undefined
                          }
                        >
                          {/* The summit rung carries the crowd's pick. */}
                          {rung.id === "gold" && (
                            <span
                              className="absolute -top-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-pill px-2 py-0.5 font-sans text-[9px] font-bold uppercase tracking-[0.08em] text-[#0c0a09]"
                              style={{ background: METALS.gold.hex }}
                            >
                              {t("premium.tier.popular")}
                            </span>
                          )}
                          <span className="flex items-center justify-center gap-1">
                            <VerifiedIcon
                              size={{ width: "13", height: "13" }}
                              tier={rung.id}
                            />
                            <span className="font-sans text-[12.5px] font-semibold text-primary">
                              {t(`premium.tier.${rung.id}`)}
                            </span>
                          </span>
                          <span className="mt-1 block font-sans text-[12.5px] tabular-nums text-muted">
                            ${(rung.priceUsdMinor / 100).toFixed(0)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {!live && (
                  <div className="mb-5 flex items-baseline justify-center gap-2 overflow-hidden">
                    <AnimatePresence initial={false} mode="popLayout">
                      <motion.span
                        key={price}
                        initial={reduce ? false : { y: 26, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={reduce ? { opacity: 0 } : { y: -26, opacity: 0 }}
                        transition={{ duration: 0.4, ease: ORBIT_EASE }}
                        className="font-display text-[52px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-primary"
                      >
                        ${price}
                      </motion.span>
                    </AnimatePresence>
                    <span className="font-sans text-[14px] text-muted">
                      {t("premium.perMonth")}
                    </span>
                  </div>
                )}

                {error && (
                  <p className="mb-3 text-center font-sans text-[12.5px] leading-relaxed text-danger">
                    {error}
                  </p>
                )}
                {!live && state && !state.available && !error && (
                  <p className="mb-3 text-center font-sans text-[12.5px] leading-relaxed text-subtle">
                    {t("premium.unavailable")}
                  </p>
                )}

                {live ? (
                  <div className="flex flex-col gap-2">
                    {(sub!.cancelAtPeriodEnd || sub!.status === "past_due") && (
                      <button
                        type="button"
                        onClick={subscribe}
                        disabled={busy}
                        className="flex h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-pill bg-brand font-sans text-[14px] font-semibold text-brand-on transition-opacity hover:opacity-90 disabled:opacity-50"
                      >
                        {busy && (
                          <span className="h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current/30 border-t-current" />
                        )}
                        {sub!.status === "past_due"
                          ? t("premium.retry")
                          : t("premium.resume")}
                      </button>
                    )}
                    {!sub!.cancelAtPeriodEnd && (
                      <button
                        type="button"
                        onClick={cancel}
                        disabled={busy}
                        className="h-10 w-full cursor-pointer rounded-pill font-sans text-[13px] font-semibold text-muted transition-colors hover:bg-raised hover:text-primary disabled:opacity-50"
                      >
                        {t("premium.cancel")}
                      </button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={subscribe}
                    disabled={busy || !state?.available}
                    className={clsx(
                      "flex h-11 w-full items-center justify-center gap-2 rounded-pill font-sans text-[14px] font-semibold transition-colors",
                      busy || !state?.available
                        ? "cursor-not-allowed bg-raised text-subtle"
                        : "cursor-pointer bg-brand text-brand-on hover:opacity-90",
                    )}
                  >
                    {busy && (
                      <span className="h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current/30 border-t-current" />
                    )}
                    {busy ? t("premium.processing") : t("premium.cta")}
                  </button>
                )}

                <p className="mt-3 text-center font-sans text-[11.5px] text-subtle">
                  {t("premium.billedFromWallet")}
                </p>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </ConfirmModalPortal>
  );
}
