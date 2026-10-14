"use client";

import { AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { SpaceRecapRows } from "@/components/settings/SpaceSettings";
import {
  OverlayHeader,
  OverlayPanel,
  OverlayScrim,
  useOverlayDismiss,
} from "@/components/ui/Overlay";

/**
 * Space Voice settings, inside Voice, the way Messages carries
 * MessageSettingsSheet: not a second settings store, the SAME preferences
 * (`prefs.spaces`) through the same rows Settings > Notifications > Spaces
 * renders (`SpaceRecapRows`), so the two can never disagree. A new Space
 * Voice preference gets a row in both places.
 *
 * Plain groups on the sheet's own surface, never the frosted SettingGroup:
 * the sheet is already the one blurred layer of this stack. Portalled to the
 * body, so the voice page can open it from anywhere in its tree.
 */
export function SpaceVoiceSettingsSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useOverlayDismiss(open, onClose);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <OverlayScrim
            key="space-settings-scrim"
            onClose={onClose}
            label="Close"
          />
          <OverlayPanel
            key="space-settings-panel"
            variant="sheet"
            ground="solid"
            className="sm:w-[min(560px,94vw)] sm:max-h-[84vh]"
            label="Space settings"
            dragClose={onClose}
          >
            <OverlayHeader title="Space settings" onClose={onClose} />
            <div className="flex flex-col gap-6 overflow-y-auto px-5 pb-[calc(20px+var(--ws-safe-bottom))]">
              <Group title="Recaps">
                <SpaceRecapRows />
              </Group>

              <p className="font-sans text-[calc(13px*var(--ws-fs))] text-muted">
                Recaps land in your notifications, and on your phone if you use
                the app.{" "}
                <Link
                  href="/settings/notifications#group-spaces"
                  onClick={onClose}
                  className="font-semibold text-primary underline underline-offset-2"
                >
                  All settings
                </Link>
              </p>
            </div>
          </OverlayPanel>
        </>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Group({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h3 className="pb-2 font-display text-[calc(15px*var(--ws-fs))] font-semibold tracking-tight text-primary">
        {title}
      </h3>
      <div className="flex flex-col [&>*:last-child]:border-b-0">
        {children}
      </div>
    </section>
  );
}
