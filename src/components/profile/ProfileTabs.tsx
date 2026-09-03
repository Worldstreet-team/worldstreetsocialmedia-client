"use client";

import { Tabs } from "@/components/ui/Tabs";
import { useT } from "@/i18n/client";

export type ProfileTab = "posts" | "replies" | "street" | "media" | "likes";

// Media leads (owner ruling 2026-09-03): a profile opens on what the person
// has MADE visually, then the words.
const KEYS: ProfileTab[] = ["media", "posts", "replies", "street", "likes"];

export function ProfileTabs({
  active,
  onChange,
}: {
  active: ProfileTab;
  onChange: (tab: ProfileTab) => void;
}) {
  const t = useT();
  return (
    <div className="border-b border-hairline">
      <Tabs
        items={KEYS.map((key) => ({ key, label: t(`profile.tab.${key}`) }))}
        value={active}
        onChange={onChange}
        ariaLabel={t("profile.tabsLabel")}
        size="lg"
      />
    </div>
  );
}
