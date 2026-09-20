"use client";

import { useClerk } from "@clerk/nextjs";
import { useAtomValue } from "jotai";
import { Bell, LogOut, UserCircle, Zap } from "lucide-react";
import Link from "next/link";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { usePreferences } from "@/components/providers/PreferencesProvider";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { UserBadges } from "@/components/ui/UserBadges";
import type { Preferences } from "@/lib/preferences";
import { withThemeTransition } from "@/lib/theme-transition";
import { handleSignOut } from "@/lib/utils";
import { userAtom } from "@/store/user.atom";
import { SelectRow, SettingGroup, SettingRow, rowButton } from "./inspector";

/**
 * What `/settings` opens on (owner 2026-09-20, asking what a person wants
 * to see first). The order is the answer, and it is not the order the
 * surface had:
 *
 * 1. WHICH ACCOUNT am I about to change. One glance, and it heads off the
 *    worst mistake a settings screen can help someone make.
 * 2. WHERE IS THE THING I came for. That is the search in the sidebar's
 *    masthead, the first thing under the title.
 * 3. THE FEW THINGS MOST PEOPLE CAME TO CHANGE, changeable right here.
 *    Notifications first, because "stop telling me things" is the reason
 *    people open settings in a social app; then how it reads, who can
 *    reach them, and what it costs in data.
 * 4. Everything else, as the map. That is the sidebar, always in view.
 * 5. Account admin and the exits LAST, with the destructive things
 *    furthest from the door: they live in Account, behind Danger zone.
 *
 * Before this, `/settings` opened on Account, so the first screen was a
 * username field, an email and Delete account.
 *
 * `variant` is where it is mounted: "page" is the desktop landing, which
 * carries the identity block; "hub" is the top of the phone's hub column,
 * where the masthead above it already says who you are.
 */
export function SettingsOverview({ variant = "page" }: { variant?: "page" | "hub" }) {
	const { prefs, setPrefs } = usePreferences();
	const { resolvedTheme, setTheme } = useTheme();
	const { signOut } = useClerk();
	const user = useAtomValue(userAtom);
	// next-themes resolves on the client; until then say what the server drew.
	const [mounted, setMounted] = useState(false);
	useEffect(() => setMounted(true), []);
	const [leaving, setLeaving] = useState(false);

	const name =
		[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.username;

	return (
		<>
			{variant === "page" && (
				<SettingGroup
					id="you"
					icon={UserCircle}
					title="You"
					caption="The account every setting on this screen belongs to. Your password, email address and sign-in methods are managed by your WorldStreet account."
				>
					<div className="flex items-center gap-3.5 border-b border-t border-hairline py-3">
						<span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-pill bg-sunken">
							<SafeAvatar src={user?.avatar} />
						</span>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-1.5">
								<span className="truncate font-display text-[calc(16px*var(--ws-fs))] font-semibold text-primary">
									{name}
								</span>
								<UserBadges
									isVerified={user?.isVerified}
									verification={(user as { verification?: { tier?: string } })?.verification as never}
									badges={user?.badges}
									size={15}
								/>
							</div>
							<span className="block truncate font-sans text-[calc(13px*var(--ws-fs))] text-muted">
								@{user?.username}
							</span>
						</div>
						<button
							type="button"
							disabled={leaving}
							onClick={() => {
								setLeaving(true);
								void handleSignOut(signOut);
							}}
							className={`${rowButton} flex items-center gap-2`}
						>
							<LogOut className="h-4 w-4" strokeWidth={2} />
							{leaving ? "Signing out…" : "Sign out"}
						</button>
					</div>
				</SettingGroup>
			)}

			<SettingGroup
				id="quick"
				icon={Zap}
				title="The ones people change most"
				caption="Everything else is in the list beside this one, or through the search above it."
			>
				{/* Notifications lead: "stop telling me things" is the reason
				    people open settings. The section is six switches, so this
				    row is the door to it rather than a copy of one switch. */}
				<SettingRow
					label="Notifications"
					hint="What reaches you, and how. Likes, replies, mentions, follows and messages."
				>
					<Link href="/settings/notifications" className={`${rowButton} flex items-center gap-2`}>
						<Bell className="h-4 w-4" strokeWidth={2} />
						Manage
					</Link>
				</SettingRow>
				<SelectRow
					label="Theme"
					hint="Dark or light. Stays on this device."
					value={mounted && resolvedTheme === "light" ? "light" : "dark"}
					options={[
						["dark", "Dark"],
						["light", "Light"],
					]}
					onPick={(v) => withThemeTransition(() => setTheme(v))}
				/>
				<SelectRow
					label="Text size"
					hint="Everything in the app, from this screen to a chat bubble."
					value={prefs.a11y.textScale}
					options={[
						["auto", "Match my device"],
						[90, "90%"],
						[100, "100%"],
						[110, "110%"],
						[125, "125%"],
						[150, "150%"],
						[175, "175%"],
					]}
					onPick={(v) =>
						setPrefs({ a11y: { textScale: v as Preferences["a11y"]["textScale"] } })
					}
				/>
				<SelectRow
					label="Who can start a chat with you"
					hint="Anyone else has to send a request first."
					value={prefs.privacy.dmFrom}
					options={[
						["everyone", "Everyone"],
						["allies", "People you follow"],
					]}
					onPick={(v) =>
						setPrefs({ privacy: { dmFrom: v as Preferences["privacy"]["dmFrom"] } })
					}
				/>
				<SelectRow
					label="Data saver"
					hint="Cuts what the app downloads. Automatic follows your phone's own setting."
					value={prefs.data.saver}
					options={[
						["auto", "Automatic"],
						["on", "On"],
						["off", "Off"],
					]}
					onPick={(v) => setPrefs({ data: { saver: v as Preferences["data"]["saver"] } })}
				/>
			</SettingGroup>
		</>
	);
}
