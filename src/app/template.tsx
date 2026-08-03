/**
 * Route-transition wrapper. Next remounts `template.tsx` on every navigation,
 * so the animate-rise entrance (opacity + 8px, motion-slow) replays per page —
 * the sanctioned "page-section reveal". Enter-only; exits are instant per
 * 06-motion. Fixed/portal UI (palette, toasts, modals) lives outside this
 * tree in the root layout, so the transient transform can't mis-anchor it.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-rise">{children}</div>;
}
