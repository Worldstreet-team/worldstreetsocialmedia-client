"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useAtomValue } from "jotai";
import { analytics, initAnalytics } from "@/lib/analytics";
import { userAtom } from "@/store/user.atom";

/**
 * PostHog.
 *
 * The key is a *public* project key (`phc_…`) — it is designed to ship in the
 * bundle and can only write events, never read them. It still rides an env var
 * so staging and production can be separated without a code change.
 *
 * Pageviews are captured manually: the App Router does client-side navigation,
 * so PostHog's automatic capture would only ever see the first paint.
 *
 * The library itself loads after the page is idle (`src/lib/analytics.ts`);
 * the calls below queue until it has, so the first pageview and the identify
 * are not lost to the wait.
 */
const KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://eu.i.posthog.com";

export default function AnalyticsProvider() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const user = useAtomValue(userAtom);

  useEffect(() => {
    if (!KEY || typeof window === "undefined") return;
    initAnalytics(KEY, {
      api_host: HOST,
      // We fire these ourselves below; autocapture would miss route changes.
      capture_pageview: false,
      capture_pageleave: true,
      // Never record what people type — this app carries DMs and drafts.
      autocapture: false,
      persistence: "localStorage+cookie",
    });
  }, []);

  // Identify once the profile hydrates, so sessions before sign-in still join
  // up to the account afterwards.
  useEffect(() => {
    if (!KEY) return;
    if (user?.userId) {
      analytics.identify(user.userId, {
        username: user.username,
        isVerified: user.isVerified,
      });
    }
  }, [user?.userId, user?.username, user?.isVerified]);

  useEffect(() => {
    if (!KEY || !pathname) return;
    const qs = searchParams?.toString();
    analytics.capture("$pageview", {
      $current_url: `${window.location.origin}${pathname}${qs ? `?${qs}` : ""}`,
    });
  }, [pathname, searchParams]);

  return null;
}
