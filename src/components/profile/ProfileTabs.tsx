"use client";

import { Tabs } from "@/components/ui/Tabs";
import { useT } from "@/i18n/client";

export type ProfileTab = "posts" | "replies" | "street" | "media" | "likes";

const KEYS: ProfileTab[] = ["posts", "replies", "street", "media", "likes"];

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
