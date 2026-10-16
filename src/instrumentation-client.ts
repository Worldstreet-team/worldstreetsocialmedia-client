import { markNavigation } from "@/lib/pending-nav";

/**
 * Next calls this at the start of every client navigation (a link, a
 * router.push, back and forward). Recording where the person is going lets
 * the rest of the app stay out of the way until they get there: see
 * lib/pending-nav.ts.
 */
export function onRouterTransitionStart(url: string) {
	markNavigation(url);
}
