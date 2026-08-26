"use client";

import {
	forwardRef,
	useImperativeHandle,
	useRef,
	type ClipboardEvent,
	type KeyboardEvent,
} from "react";
import { DEFAULT_AVATAR } from "@/const";
import {
	activeMentionQuery,
	type MentionUser,
} from "@/components/feed/MentionAutocomplete";

/**
 * The composer's text surface: a contentEditable that renders a tagged person
 * as an ATOMIC inline badge (avatar + display name, no `@`) sitting in the
 * run of text, instead of leaving a bare `@handle` behind.
 *
 * Why contentEditable and not a textarea: a textarea holds a single string and
 * can only ever paint one uniform run of glyphs, so an inline avatar is not
 * expressible in one. The badges here are real elements marked
 * `contenteditable="false"`, which is what makes them behave like a single
 * character — arrow keys step over them, one Backspace removes the whole
 * person, and selection can never land inside a name.
 *
 * The parent keeps owning a plain-text `content` string: every edit serializes
 * the DOM back to text with badges written out as `@username`, so drafts, the
 * character budget, link detection, topic classification and the post payload
 * all keep working on an ordinary string and none of them know badges exist.
 *
 * Deliberately UNCONTROLLED: React renders the surface once and never re-renders
 * its children. Writing `content` back into the DOM on every keystroke would
 * destroy and rebuild the nodes the caret lives in, which collapses the
 * selection to the start of the box on every character. Programmatic changes
 * (draft restore, emoji, clearing after a post) go through the imperative
 * handle instead.
 */

const BADGE_CLASS =
	"ws-mention inline-flex items-center gap-1 align-middle rounded-pill bg-raised border border-hairline pl-0.5 pr-2 py-[0.1em] text-[0.9em] font-semibold text-primary leading-none";
const BADGE_AVATAR_CLASS =
	"h-[1.35em] w-[1.35em] rounded-pill object-cover bg-surface";
/** Phosphor SealCheck (fill) — same glyph as VerifiedIcon, but this surface
 *  builds raw DOM (contentEditable badges), so the path is inlined. */
const SEAL_CHECK_PATH =
	"M225.86,102.82c-3.77-3.94-7.67-8-9.14-11.57-1.36-3.27-1.44-8.69-1.52-13.94-.15-9.76-.31-20.82-8-28.51s-18.75-7.85-28.51-8c-5.25-.08-10.67-.16-13.94-1.52-3.56-1.47-7.63-5.37-11.57-9.14C146.28,23.51,138.44,16,128,16s-18.27,7.51-25.18,14.14c-3.94,3.77-8,7.67-11.57,9.14C88,40.64,82.56,40.72,77.31,40.8c-9.76.15-20.82.31-28.51,8S41,67.55,40.8,77.31c-.08,5.25-.16,10.67-1.52,13.94-1.47,3.56-5.37,7.63-9.14,11.57C23.51,109.72,16,117.56,16,128s7.51,18.27,14.14,25.18c3.77,3.94,7.67,8,9.14,11.57,1.36,3.27,1.44,8.69,1.52,13.94.15,9.76.31,20.82,8,28.51s18.75,7.85,28.51,8c5.25.08,10.67.16,13.94,1.52,3.56,1.47,7.63,5.37,11.57,9.14C109.72,232.49,117.56,240,128,240s18.27-7.51,25.18-14.14c3.94-3.77,8-7.67,11.57-9.14,3.27-1.36,8.69-1.44,13.94-1.52,9.76-.15,20.82-.31,28.51-8s7.85-18.75,8-28.51c.08-5.25.16-10.67,1.52-13.94,1.47-3.56,5.37-7.63,9.14-11.57C232.49,146.28,240,138.44,240,128S232.49,109.73,225.86,102.82Zm-52.2,6.84-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35a8,8,0,0,1,11.32,11.32Z";

function createVerifiedSeal(): SVGSVGElement {
	const NS = "http://www.w3.org/2000/svg";
	const svg = document.createElementNS(NS, "svg");
	svg.setAttribute("viewBox", "0 0 256 256");
	svg.setAttribute("aria-label", "Verified");
	svg.setAttribute("class", "h-[0.95em] w-[0.95em] shrink-0 text-gold");
	svg.setAttribute("fill", "currentColor");
	const path = document.createElementNS(NS, "path");
	path.setAttribute("d", SEAL_CHECK_PATH);
	svg.appendChild(path);
	return svg;
}

/** Elements Chrome wraps a new line in; each starts a fresh line in the text. */
const BLOCK_TAGS = new Set(["DIV", "P"]);

export interface MentionInputHandle {
	focus: () => void;
	/** Replace everything. `known` re-badges any @handle it recognises. */
	setText: (text: string, known?: MentionUser[]) => void;
	/** Insert a string at the caret (emoji picker). */
	insertText: (text: string) => void;
	/** Swap the @token under the caret for a badge. */
	insertMention: (user: MentionUser) => void;
}

export interface MentionQuery {
	query: string;
	start: number;
	end: number;
}

interface MentionInputProps {
	id?: string;
	className?: string;
	ariaLabel?: string;
	onChange: (text: string) => void;
	/** The @token the caret sits in, or null. Drives the typeahead. */
	onQueryChange: (query: MentionQuery | null) => void;
	/** Fired for image pastes; plain text is handled internally. */
	onPaste?: (e: ClipboardEvent) => void;
	onKeyDown?: (e: KeyboardEvent) => void;
}

export function displayName(user: MentionUser) {
	return (
		[user.firstName, user.lastName].filter(Boolean).join(" ") || user.username
	);
}

function createBadge(user: MentionUser): HTMLElement {
	const badge = document.createElement("span");
	badge.contentEditable = "false";
	badge.dataset.mentionUsername = user.username;
	badge.dataset.mentionId = user._id;
	badge.className = BADGE_CLASS;

	const avatar = document.createElement("img");
	avatar.src = user.avatar || DEFAULT_AVATAR;
	avatar.alt = "";
	avatar.draggable = false;
	avatar.className = BADGE_AVATAR_CLASS;

	const label = document.createElement("span");
	label.textContent = displayName(user);

	badge.append(avatar, label);
	// The tick travels with the person, exactly as it does beside names.
	if (user.isVerified) badge.append(createVerifiedSeal());
	return badge;
}

interface WalkContext {
	text: string;
	caret: number | null;
	stopNode: Node | null;
	stopOffset: number;
}

/** Serialize the surface to plain text, noting where the caret falls in it. */
function walk(node: Node, ctx: WalkContext) {
	const children = Array.from(node.childNodes);

	for (let i = 0; i < children.length; i += 1) {
		// Caret anchored to this element between two children.
		if (ctx.stopNode === node && ctx.stopOffset === i) ctx.caret = ctx.text.length;

		const child = children[i];

		if (child.nodeType === Node.TEXT_NODE) {
			const value = child.nodeValue ?? "";
			if (ctx.stopNode === child) {
				ctx.caret = ctx.text.length + Math.min(ctx.stopOffset, value.length);
			}
			ctx.text += value;
			continue;
		}

		if (!(child instanceof HTMLElement)) continue;

		if (child.dataset.mentionUsername) {
			if (ctx.stopNode === child) ctx.caret = ctx.text.length;
			ctx.text += `@${child.dataset.mentionUsername}`;
		} else if (child.tagName === "BR") {
			// Chrome parks a filler <br> at the end of a contentEditable so the
			// last line stays focusable. The author never typed it, so counting
			// it would append a phantom newline to every post.
			const isFiller = children
				.slice(i + 1)
				.every(
					(n) =>
						n.nodeType === Node.TEXT_NODE && !(n.nodeValue ?? "").length,
				);
			if (!isFiller) ctx.text += "\n";
		} else {
			if (BLOCK_TAGS.has(child.tagName)) ctx.text += "\n";
			walk(child, ctx);
		}
	}

	if (ctx.stopNode === node && ctx.stopOffset === children.length) {
		ctx.caret = ctx.text.length;
	}
}

function readValue(root: HTMLElement): { text: string; caret: number | null } {
	const selection = window.getSelection();
	const anchored =
		selection &&
		selection.rangeCount > 0 &&
		root.contains(selection.getRangeAt(0).startContainer);
	const range = anchored ? selection.getRangeAt(0) : null;

	const ctx: WalkContext = {
		text: "",
		caret: null,
		stopNode: range ? range.startContainer : null,
		stopOffset: range ? range.startOffset : 0,
	};
	walk(root, ctx);
	return { text: ctx.text, caret: ctx.caret };
}

function placeCaret(node: Node, offset: number) {
	const selection = window.getSelection();
	if (!selection) return;
	const range = document.createRange();
	range.setStart(node, offset);
	range.collapse(true);
	selection.removeAllRanges();
	selection.addRange(range);
}

export const MentionInput = forwardRef<MentionInputHandle, MentionInputProps>(
	function MentionInput(
		{ id, className, ariaLabel, onChange, onQueryChange, onPaste, onKeyDown },
		ref,
	) {
		const rootRef = useRef<HTMLDivElement>(null);

		/** Serialize, hand the text up, and re-evaluate the @token under the caret. */
		const emit = () => {
			const root = rootRef.current;
			if (!root) return;
			const { text, caret } = readValue(root);
			onChange(text);
			onQueryChange(caret === null ? null : activeMentionQuery(text, caret));
		};

		const insertTextAtCaret = (value: string) => {
			const root = rootRef.current;
			if (!root) return;
			root.focus();
			const selection = window.getSelection();

			if (
				!selection ||
				selection.rangeCount === 0 ||
				!root.contains(selection.getRangeAt(0).startContainer)
			) {
				// No live caret in the surface — append instead of dropping the text.
				const node = document.createTextNode(value);
				root.appendChild(node);
				placeCaret(node, value.length);
				emit();
				return;
			}

			const range = selection.getRangeAt(0);
			range.deleteContents();
			const node = document.createTextNode(value);
			range.insertNode(node);
			placeCaret(node, value.length);
			emit();
		};

		useImperativeHandle(ref, () => ({
			focus: () => rootRef.current?.focus(),

			setText: (text: string, known: MentionUser[] = []) => {
				const root = rootRef.current;
				if (!root) return;
				root.replaceChildren();

				if (text) {
					const byUsername = new Map(
						known.map((u) => [u.username.toLowerCase(), u]),
					);
					// Split on @handles so a restored draft comes back as badges
					// rather than as the raw text the badges serialized to.
					const parts = text.split(/(@[A-Za-z0-9_]+)/g);
					for (const part of parts) {
						if (!part) continue;
						const user = part.startsWith("@")
							? byUsername.get(part.slice(1).toLowerCase())
							: undefined;
						root.appendChild(
							user ? createBadge(user) : document.createTextNode(part),
						);
					}
				}

				emit();
			},

			insertText: insertTextAtCaret,

			insertMention: (user: MentionUser) => {
				const root = rootRef.current;
				if (!root) return;
				const selection = window.getSelection();
				if (
					!selection ||
					selection.rangeCount === 0 ||
					!root.contains(selection.getRangeAt(0).startContainer)
				) {
					return;
				}

				const range = selection.getRangeAt(0);
				const node = range.startContainer;
				if (node.nodeType !== Node.TEXT_NODE) return;

				const value = node.nodeValue ?? "";
				const upToCaret = value.slice(0, range.startOffset);
				const match = upToCaret.match(/(^|\s)@([A-Za-z0-9_]{0,30})$/);
				if (!match) return;

				// Swap exactly the @token — the leading space in the match is a
				// boundary, not part of it, so it must survive.
				const tokenStart = range.startOffset - match[2].length - 1;
				const tokenRange = document.createRange();
				tokenRange.setStart(node, tokenStart);
				tokenRange.setEnd(node, range.startOffset);
				tokenRange.deleteContents();

				const badge = createBadge(user);
				tokenRange.insertNode(badge);

				// A trailing space keeps the caret out of the badge and lets the
				// author keep typing straight away.
				const trailing = document.createTextNode(" ");
				badge.after(trailing);
				placeCaret(trailing, 1);

				emit();
			},
		}));

		return (
			// biome-ignore lint/a11y/useSemanticElements: a textarea holds one flat string and cannot render inline mention badges, which is the whole point of this surface
			<div
				id={id}
				ref={rootRef}
				role="textbox"
				aria-label={ariaLabel}
				aria-multiline="true"
				tabIndex={0}
				contentEditable
				suppressContentEditableWarning
				className={className}
				onInput={emit}
				onKeyUp={emit}
				onMouseUp={emit}
				onFocus={emit}
				onBlur={() => onQueryChange(null)}
				onKeyDown={onKeyDown}
				onPaste={(e) => {
					const hasFiles = Array.from(e.clipboardData.files).some((f) =>
						f.type.startsWith("image/"),
					);
					if (hasFiles) {
						onPaste?.(e);
						return;
					}
					// Never let the browser paste markup into the surface: it would
					// drop foreign nodes (and their styles) in among the badges.
					e.preventDefault();
					insertTextAtCaret(e.clipboardData.getData("text/plain"));
				}}
			/>
		);
	},
);
