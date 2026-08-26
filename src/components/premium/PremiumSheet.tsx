"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { motion, useReducedMotion } from "framer-motion";
import {
  ChartLineUp,
  SealCheck,
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
  type SubscriptionState,
} from "@/lib/subscription.actions";
import { premiumOpenAtom } from "@/store/ui.atom";
import { userAtom } from "@/store/user.atom";
import { useT } from "@/i18n/client";

const EASE = [0.2, 0, 0, 1] as const;

/**
 * The verified-subscription sheet: the pitch when you are not subscribed, the
 * management surface when you are. One sheet for both, because the moment
 * after subscribing should show you what you now hold, not a dead end.
 *
 * Glass, like the other brand-moment sheets. Gold appears exactly twice: the
 * seal and the CTA, so the sheet sells the tick by looking like it.
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
  const price = ((state?.priceUsdMinor ?? 800) / 100).toFixed(2).replace(/\.00$/, "");
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
    const res = await subscribeAction();
    setBusy(false);
    if (res.success) {
      // The tick is live server-side; reflect it in the hydrated atom so the
      // whole app updates without a reload.
      setUser((prev: any) => (prev ? { ...prev, isVerified: true } : prev));
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

  const PERKS: {
    icon: React.ReactNode;
    title: string;
    sub: string;
  }[] = [
    {
      icon: <SealCheck size={17} weight="fill" className="text-gold" />,
      title: t("premium.perk.tick"),
      sub: t("premium.perk.tickSub"),
    },
    {
      icon: <TextAa size={17} weight="duotone" className="text-muted" />,
      title: t("premium.perk.composer"),
      sub: t("premium.perk.composerSub"),
    },
    {
      icon: <ChartLineUp size={17} weight="duotone" className="text-muted" />,
      title: t("premium.perk.analytics"),
      sub: t("premium.perk.analyticsSub"),
    },
    {
      icon: <TrendUp size={17} weight="duotone" className="text-muted" />,
      title: t("premium.perk.reach"),
      sub: t("premium.perk.reachSub"),
    },
    {
      icon: <WolfIcon size={18} />,
      title: t("premium.perk.wolf"),
      sub: t("premium.perk.wolfSub"),
    },
  ];

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
          /* `glass-dock` is fixed-dark in BOTH themes — right for creator
             chrome floating over video, wrong for a sheet the reader studies:
             in light mode it was a dark slab. This follows the theme. */
          className="relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-surface pb-safe text-primary sm:max-w-[440px] sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* The gold moment: a flat wash band, not a gradient. Drama comes
              from scale and contrast, not from light. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[188px] bg-gold/[0.07]"
          />

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label={t("common.cancel")}
            className="absolute right-4 top-4 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-pill bg-raised text-muted transition-colors hover:text-primary"
          >
            <X size={15} weight="bold" />
          </button>

          <div className="relative flex flex-col items-center px-6 pt-9 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-pill bg-gold/[0.12]">
              <SealCheck size={44} weight="fill" className="text-gold" />
            </span>
            <span className="mt-4 font-sans text-[11px] font-bold uppercase tracking-[0.16em] text-gold">
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
                <div className="mx-6 mt-5 rounded-xl bg-raised p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span
                      className={clsx(
                        "flex h-6 items-center gap-1.5 rounded-pill px-2.5 font-sans text-[11px] font-bold uppercase tracking-wide",
                        sub!.status === "past_due"
                          ? "bg-danger/15 text-danger"
                          : "bg-[#EAB308]/15 text-gold",
                      )}
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

              <div className="flex flex-col gap-1 px-4 py-5">
                {PERKS.map((perk) => (
                  <div
                    key={perk.title}
                    className="flex items-center gap-3.5 rounded-xl px-2.5 py-2.5"
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-raised">
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
                {!live && (
                  <div className="mb-5 flex items-baseline justify-center gap-2">
                    <span className="font-display text-[52px] font-semibold leading-none tracking-[-0.03em] tabular-nums text-primary">
                      ${price}
                    </span>
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
