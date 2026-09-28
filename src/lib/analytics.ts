import type { PostHog, PostHogConfig } from "posthog-js";

/**
 * PostHog, loaded after the page is idle.
 *
 * `posthog-js` is about 300KB and used to ride the root layout as a static
 * import, so every visitor paid for it before the feed painted. Now the
 * library is fetched with `import()` from an idle callback, and every call
 * made before it lands (`capture`, `identify`, `reset`) is queued and
 * replayed in order once it has. Callers never see the difference: they use
 * this module's API, not `posthog` itself.
 *
 * The queue is armed by `initAnalytics()`. Until then, and when there is no
 * key at all, calls are dropped rather than held forever.
 */

type Job = (ph: PostHog) => void;

let instance: PostHog | null = null;
let armed = false;
let started = false;
const queue: Job[] = [];
const QUEUE_CAP = 100;

function run(job: Job) {
  if (instance) {
    job(instance);
    return;
  }
  if (!armed) return;
  if (queue.length >= QUEUE_CAP) queue.shift();
  queue.push(job);
}

function whenIdle(fn: () => void) {
  if (typeof window === "undefined") return;
  const w = window as Window & {
    requestIdleCallback?: (
      cb: () => void,
      opts?: { timeout: number },
    ) => number;
  };
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(fn, { timeout: 4000 });
  } else {
    window.setTimeout(fn, 1500);
  }
}

/**
 * Arm the queue and load the library once the browser is idle. Safe to call
 * more than once; only the first call does anything.
 */
export function initAnalytics(key: string, options: Partial<PostHogConfig>) {
  if (started || typeof window === "undefined") return;
  started = true;
  armed = true;
  whenIdle(() => {
    import("posthog-js")
      .then(({ default: posthog }) => {
        if (!posthog.__loaded) posthog.init(key, options);
        instance = posthog;
        for (const job of queue.splice(0)) job(posthog);
      })
      .catch(() => {
        // A blocked or failed script (ad blockers commonly stop analytics)
        // is not an error the app should surface. Drop what was queued.
        armed = false;
        queue.length = 0;
      });
  });
}

export const analytics = {
  capture(event: string, properties?: Record<string, unknown>) {
    run((ph) => ph.capture(event, properties));
  },
  identify(id: string, properties?: Record<string, unknown>) {
    run((ph) => ph.identify(id, properties));
  },
  reset() {
    run((ph) => ph.reset());
  },
};
