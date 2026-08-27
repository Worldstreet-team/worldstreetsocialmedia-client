"use client";

import {
  Camera,
  DotsThree,
  PencilSimple,
  Trash,
  UserMinus,
  UsersThree,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ConfirmModal from "@/components/ui/ConfirmModal";
import ConfirmModalPortal from "@/components/ui/ConfirmModalPortal";
import {
  OverlayHeader,
  OverlayPanel,
  OverlayScrim,
  useOverlayDismiss,
} from "@/components/ui/Overlay";
import { SafeAvatar } from "@/components/ui/SafeAvatar";
import { useToast } from "@/components/ui/Toast/ToastContext";
import { CATEGORIES as TAXONOMY } from "@/data/categories";
import { useT } from "@/i18n/client";
import {
  type CommunityMemberRow,
  deleteCommunityAction,
  getCommunityMembersAction,
  removeMemberAction,
  updateCommunityAction,
} from "@/lib/community.actions";

/**
 * Everything an owner can do to their community, reachable from one ⋯
 * button. Until this existed, `owner` granted exactly one power: being
 * unable to leave. No edit, no delete, no removing a member — a community,
 * once created, was permanently whatever its first minute made it.
 */
export function ManageCommunity({
  community,
  onChanged,
}: {
  community: {
    id: string;
    slug: string;
    name: string;
    description?: string;
    category: string;
    avatar?: string;
  };
  /** The screen refetches after a successful edit or removal. */
  onChanged: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // The scrim catches the outside click and the hook owns Escape plus the body
  // scroll lock — the pair of hand-rolled document listeners that used to live
  // here did the first two and never locked the page behind the menu.
  const close = useCallback(() => setOpen(false), []);
  useOverlayDismiss(open, close);

  const doDelete = async () => {
    setConfirmDelete(false);
    const res = await deleteCommunityAction(community.id);
    if (res.success) {
      toast(t("community.deletedToast"), { type: "success" });
      router.push("/communities");
    } else {
      toast(res.message ?? t("promo.failed"), { type: "error" });
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("community.manage")}
        aria-haspopup="dialog"
        aria-expanded={open}
        className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-muted transition-colors hover:bg-raised hover:text-primary"
      >
        <DotsThree size={20} weight="bold" />
      </button>

      {/* The owner menu, on the standard overlay grammar's `anchored` panel —
          the variant for menus. `aria-haspopup` says "dialog" now because the
          panel IS one; the list of actions keeps its menu semantics inside. */}
      <ConfirmModalPortal>
        <AnimatePresence>
          {open && (
            // A menu is not a modal: the community page you are managing stays
            // lit behind it on desktop.
            <OverlayScrim
              key="manage-scrim"
              onClose={close}
              dim={false}
              label={t("common.close")}
            />
          )}
          {open && (
            <OverlayPanel
              key="manage-panel"
              variant="anchored"
              label={t("community.manage")}
            >
              <OverlayHeader
                title={t("community.manage")}
                onClose={close}
                closeLabel={t("common.close")}
              />
              <div
                role="menu"
                className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[calc(8px+var(--ws-safe-bottom))]"
              >
                {[
                  {
                    id: "edit",
                    label: t("community.edit"),
                    icon: PencilSimple,
                    danger: false,
                    run: () => setEditing(true),
                  },
                  {
                    id: "members",
                    label: t("community.members.title"),
                    icon: UsersThree,
                    danger: false,
                    run: () => setMembersOpen(true),
                  },
                  {
                    id: "delete",
                    label: t("community.delete"),
                    icon: Trash,
                    danger: true,
                    run: () => setConfirmDelete(true),
                  },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOpen(false);
                      item.run();
                    }}
                    className={clsx(
                      "flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left font-sans text-[13px] font-medium transition-colors hover:bg-raised",
                      item.danger ? "text-danger" : "text-primary",
                    )}
                  >
                    <item.icon size={15} weight="bold" />
                    {item.label}
                  </button>
                ))}
              </div>
            </OverlayPanel>
          )}
        </AnimatePresence>
      </ConfirmModalPortal>

      {editing && (
        <EditCommunitySheet
          community={community}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onChanged();
          }}
        />
      )}

      {membersOpen && (
        <MembersSheet
          communityId={community.id}
          slug={community.slug}
          onClose={() => setMembersOpen(false)}
          onChanged={onChanged}
        />
      )}

      <ConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        title={t("community.deleteTitle")}
        message={t("community.deleteBody")}
        confirmText={t("community.deleteConfirm")}
        cancelText={t("voice.keepIt")}
        isDestructive
      />
    </div>
  );
}

/** Description / category / avatar. The name is immutable — the slug is
 *  every link in the wild. */
function EditCommunitySheet({
  community,
  onClose,
  onSaved,
}: {
  community: {
    id: string;
    name: string;
    description?: string;
    category: string;
    avatar?: string;
  };
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [description, setDescription] = useState(community.description ?? "");
  const [category, setCategory] = useState(community.category);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Mounted only while open, so the hook is armed unconditionally — Escape and
  // the scroll lock, which the local keydown listener only half-covered.
  useOverlayDismiss(true, onClose);

  useEffect(
    () => () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    },
    [avatarPreview],
  );

  const save = async () => {
    if (saving) return;
    setSaving(true);
    const form = new FormData();
    form.append("description", description.trim());
    form.append("category", category);
    if (avatarFile) form.append("avatar", avatarFile);
    const res = await updateCommunityAction(community.id, form);
    setSaving(false);
    if (res.success) {
      toast(t("voice.saved"), { type: "success" });
      onSaved();
    } else {
      toast(res.message ?? t("promo.failed"), { type: "error" });
    }
  };

  return (
    // A form that wants the width: the grammar's `sheet`.
    <ConfirmModalPortal>
      <OverlayScrim onClose={onClose} label={t("common.back")} />
      <OverlayPanel variant="sheet" label={t("community.edit")}>
        <OverlayHeader
          title={t("community.edit")}
          onClose={onClose}
          closeLabel={t("common.back")}
        />
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-[calc(20px+var(--ws-safe-bottom))]">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label={t("community.changeAvatar")}
              className="group relative h-16 w-16 shrink-0 cursor-pointer overflow-hidden rounded-xl bg-raised"
            >
              {avatarPreview || community.avatar ? (
                <SafeAvatar src={avatarPreview ?? community.avatar} className="object-cover" sizes="64px" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-display text-2xl font-semibold text-gold">
                  {community.name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-scrim opacity-0 transition-opacity group-hover:opacity-100">
                <Camera size={18} className="text-primary" />
              </span>
            </button>
            <div className="min-w-0">
              <p className="truncate font-sans text-[15px] font-semibold text-primary">
                {community.name}
              </p>
              <p className="font-sans text-[12px] text-subtle">
                {t("community.nameLocked")}
              </p>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setAvatarFile(f);
                setAvatarPreview(URL.createObjectURL(f));
              }}
            />
          </div>

          <label className="mt-4 block">
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
              {t("community.descriptionLabel")}
            </span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={280}
              rows={3}
              className="mt-1.5 w-full resize-none rounded-lg border border-hairline bg-sunken px-3 py-2.5 font-sans text-sm text-primary outline-none placeholder:text-subtle focus:border-brand/60"
            />
          </label>

          <span className="mt-3 block font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle">
            {t("community.categoryLabel")}
          </span>
          <div className="mt-1.5 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
            {TAXONOMY.slice(0, 30).map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setCategory(c.id)}
                aria-pressed={category === c.id}
                className={clsx(
                  "h-7 cursor-pointer rounded-pill px-2.5 font-sans text-[12px] font-medium transition-colors",
                  category === c.id
                    ? "bg-primary text-page font-semibold"
                    : "bg-chip text-muted hover:text-primary",
                )}
              >
                {c.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="mt-5 flex h-11 w-full cursor-pointer items-center justify-center rounded-pill bg-primary font-sans text-[14px] font-semibold text-page transition-colors hover:bg-muted disabled:opacity-50"
          >
            {t("voice.saveChanges")}
          </button>
        </div>
      </OverlayPanel>
    </ConfirmModalPortal>
  );
}

/** The roster. Owner sees a remove control per row; removal also bans. */
function MembersSheet({
  communityId,
  slug,
  onClose,
  onChanged,
}: {
  communityId: string;
  slug: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useT();
  const { toast } = useToast();
  const [members, setMembers] = useState<CommunityMemberRow[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [removeTarget, setRemoveTarget] = useState<CommunityMemberRow | null>(
    null,
  );

  const load = async (offset = 0) => {
    const res = await getCommunityMembersAction(slug, offset);
    if (res.success) {
      setMembers((prev) =>
        offset === 0 ? res.members : [...prev, ...res.members],
      );
      setNextOffset(res.nextOffset);
    }
    setLoading(false);
  };

  // Mounted only while open, so the hook is armed unconditionally.
  useOverlayDismiss(true, onClose);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only
  useEffect(() => {
    void load(0);
  }, []);

  const doRemove = async () => {
    const target = removeTarget;
    if (!target) return;
    setRemoveTarget(null);
    const res = await removeMemberAction(communityId, target.id);
    if (res.success) {
      setMembers((prev) => prev.filter((m) => m.id !== target.id));
      toast(t("community.removedToast"), { type: "success" });
      onChanged();
    } else {
      toast(res.message ?? t("promo.failed"), { type: "error" });
    }
  };

  return (
    // The roster is a flow that wants the width: the grammar's `sheet`.
    <ConfirmModalPortal>
      <OverlayScrim onClose={onClose} label={t("common.back")} />
      <OverlayPanel variant="sheet" label={t("community.members.title")}>
        <OverlayHeader
          title={t("community.members.title")}
          onClose={onClose}
          closeLabel={t("common.back")}
        />

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[calc(8px+var(--ws-safe-bottom))]">
          {loading ? (
            <p className="py-8 text-center font-sans text-sm text-subtle">…</p>
          ) : (
            members.map((m) => (
              <div
                key={m.id}
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-raised/50"
              >
                <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-pill bg-raised">
                  <SafeAvatar src={m.avatar} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-sans text-[13.5px] font-semibold text-primary">
                    {[m.firstName, m.lastName].filter(Boolean).join(" ") ||
                      `@${m.username}`}
                  </span>
                  <span className="block truncate font-sans text-[12px] text-subtle">
                    @{m.username}
                    {m.isOwner ? ` · ${t("community.owner")}` : ""}
                  </span>
                </span>
                {!m.isOwner && (
                  <button
                    type="button"
                    onClick={() => setRemoveTarget(m)}
                    aria-label={t("community.remove")}
                    title={t("community.remove")}
                    className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-pill text-subtle transition-colors hover:bg-danger/10 hover:text-danger"
                  >
                    <UserMinus size={16} />
                  </button>
                )}
              </div>
            ))
          )}

          {nextOffset !== null && (
            <button
              type="button"
              onClick={() => void load(nextOffset)}
              className="mx-auto my-2 block h-9 cursor-pointer rounded-pill bg-raised px-4 font-sans text-[13px] font-medium text-muted transition-colors hover:text-primary"
            >
              {t("rail.showMore")}
            </button>
          )}
        </div>
      </OverlayPanel>

      {/* A SIBLING of the panel, not a child of the scrim. Nested inside the
          old click-catcher its clicks bubbled through the React tree and shut
          the roster out from under the confirm. */}
      <ConfirmModal
        isOpen={Boolean(removeTarget)}
        onClose={() => setRemoveTarget(null)}
        onConfirm={doRemove}
        title={t("community.removeTitle")}
        message={t("community.removeBody")}
        confirmText={t("community.remove")}
        cancelText={t("voice.keepIt")}
        isDestructive
      />
    </ConfirmModalPortal>
  );
}
