"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useState } from "react";
import { renderRichText } from "@/components/ui/RichText";

/**
 * Vivid's answers as formatted text: paragraphs, bold and italics, lists,
 * headings, quotes, code, links and simple tables, the subset a chat model
 * writes. Plain runs go through renderRichText, so $cashtags, #hashtags,
 * @mentions and bare links are live, the same as in a post.
 *
 * Hand-rolled on purpose (no markdown package in the app), and safe by
 * construction: a link is only drawn for http(s) or an in-app path, and the
 * only HTML it ever sets is KaTeX's own output for math (trust off). It
 * reads a half-streamed answer too: an unclosed marker shows as text until
 * its pair arrives.
 *
 * Math (owner 2026-10-16, "latex"): $$...$$ and \[...\] are display math,
 * \(...\) is inline. A single $ never is: answers here are full of $5 and
 * $BTC. KaTeX loads only when an answer has math (katex-render.ts).
 */

const INLINE =
	/(\\\(.+?\\\)|\$\$[^$\n]+?\$\$)|(`[^`\n]+`)|(\[[^\]\n]+\]\((?:https?:\/\/|\/)[^\s)]+\))|(\*\*[^*\n]+\*\*|__[^_\n]+__)|((?<![\w*])\*[^*\s][^*\n]*?\*(?![\w*])|(?<![\w_])_[^_\s][^_\n]*?_(?![\w_]))/g;

function inline(text: string, key: string): ReactNode[] {
	const out: ReactNode[] = [];
	let last = 0;
	let i = 0;
	// A fresh matcher per call: bold and italics recurse into inline(), and a
	// shared global regex would have its position reset by the inner call,
	// sending this loop back to the start of the line forever.
	const re = new RegExp(INLINE.source, "g");
	for (let m = re.exec(text); m; m = re.exec(text)) {
		if (m.index > last) out.push(...plain(text.slice(last, m.index), `${key}p${i}`));
		const k = `${key}i${i++}`;
		const [whole, math, code, link, bold, em] = m;
		if (math) {
			// \(...\) and $$...$$ both carry two-character fences.
			out.push(<TeX key={k} tex={math.slice(2, -2)} display={false} />);
		} else if (code) {
			out.push(
				<code key={k} className="rounded-[5px] bg-primary/[0.07] px-1.5 py-px font-mono text-[0.88em] text-primary">
					{code.slice(1, -1)}
				</code>,
			);
		} else if (link) {
			const cut = link.indexOf("](");
			const label = link.slice(1, cut);
			const href = link.slice(cut + 2, -1);
			out.push(
				href.startsWith("/") ? (
					<Link key={k} href={href} className="font-medium text-primary underline decoration-primary/30 underline-offset-[3px] hover:decoration-primary">
						{label}
					</Link>
				) : (
					<a
						key={k}
						href={href}
						target="_blank"
						rel="noopener noreferrer"
						className="font-medium text-primary underline decoration-primary/30 underline-offset-[3px] hover:decoration-primary"
					>
						{label}
					</a>
				),
			);
		} else if (bold) {
			out.push(
				<strong key={k} className="font-semibold text-primary">
					{inline(bold.slice(2, -2), k)}
				</strong>,
			);
		} else if (em) {
			out.push(<em key={k}>{inline(em.slice(1, -1), k)}</em>);
		} else {
			out.push(whole);
		}
		last = m.index + whole.length;
	}
	if (last < text.length) out.push(...plain(text.slice(last), `${key}p${i}`));
	return out;
}

/** Text with no markdown left in it: entities become links, line breaks stay. */
function plain(text: string, key: string): ReactNode[] {
	const lines = text.split("\n");
	const out: ReactNode[] = [];
	lines.forEach((line, n) => {
		if (n > 0) out.push(<br key={`${key}b${n}`} />);
		if (line) out.push(<span key={`${key}t${n}`}>{renderRichText(line)}</span>);
	});
	return out;
}

type Block =
	| { t: "p"; text: string }
	| { t: "math"; tex: string }
	| { t: "h"; level: number; text: string }
	| { t: "ul" | "ol"; items: { text: string; depth: number; n?: number }[] }
	| { t: "quote"; text: string }
	| { t: "code"; text: string }
	| { t: "hr" }
	| { t: "table"; head: string[]; rows: string[][] };

const BULLET = /^(\s*)([-*•])\s+(.*)$/;
const NUMBER = /^(\s*)(\d{1,3})[.)]\s+(.*)$/;
const cells = (row: string) =>
	row
		.trim()
		.replace(/^\||\|$/g, "")
		.split("|")
		.map((c) => c.trim());

function parse(src: string): Block[] {
	const lines = src.replace(/\r\n?/g, "\n").split("\n");
	const blocks: Block[] = [];
	let para: string[] = [];
	const flush = () => {
		if (para.length) blocks.push({ t: "p", text: para.join("\n") });
		para = [];
	};
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		if (trimmed.startsWith("```")) {
			flush();
			const body: string[] = [];
			i++;
			while (i < lines.length && !lines[i].trim().startsWith("```")) body.push(lines[i++]);
			blocks.push({ t: "code", text: body.join("\n") });
			continue;
		}
		if (!trimmed) {
			flush();
			continue;
		}
		// Display math: $$...$$ or \[...\], on one line or across several. An
		// unclosed opener (still streaming) falls through as text.
		if (trimmed.startsWith("$$") || trimmed.startsWith("\\[")) {
			const close = trimmed.startsWith("$$") ? "$$" : "\\]";
			const rest = trimmed.slice(2);
			const here = rest.indexOf(close);
			if (here !== -1) {
				flush();
				blocks.push({ t: "math", tex: rest.slice(0, here) });
				const after = rest.slice(here + 2).trim();
				if (after) para.push(after);
				continue;
			}
			let j = i + 1;
			const body = [rest];
			while (j < lines.length && !lines[j].includes(close)) body.push(lines[j++]);
			if (j < lines.length) {
				flush();
				const last = lines[j];
				const at = last.indexOf(close);
				body.push(last.slice(0, at));
				blocks.push({ t: "math", tex: body.join("\n") });
				const after = last.slice(at + 2).trim();
				if (after) para.push(after);
				i = j;
				continue;
			}
		}
		const h = /^(#{1,4})\s+(.*)$/.exec(trimmed);
		if (h) {
			flush();
			blocks.push({ t: "h", level: h[1].length, text: h[2] });
			continue;
		}
		if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
			flush();
			blocks.push({ t: "hr" });
			continue;
		}
		if (trimmed.startsWith(">")) {
			flush();
			const body: string[] = [];
			while (i < lines.length && lines[i].trim().startsWith(">")) body.push(lines[i++].trim().replace(/^>\s?/, ""));
			i--;
			blocks.push({ t: "quote", text: body.join("\n") });
			continue;
		}
		// A table: a row of cells, then a |---|---| rule.
		if (trimmed.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}/.test(lines[i + 1]) && lines[i + 1].includes("-")) {
			flush();
			const head = cells(trimmed);
			const rows: string[][] = [];
			i += 2;
			while (i < lines.length && lines[i].trim().includes("|")) rows.push(cells(lines[i++]));
			i--;
			blocks.push({ t: "table", head, rows });
			continue;
		}
		const b = BULLET.exec(line);
		const o = b ? null : NUMBER.exec(line);
		if (b || o) {
			flush();
			const kind = b ? "ul" : "ol";
			const items: { text: string; depth: number; n?: number }[] = [];
			while (i < lines.length) {
				const l = lines[i];
				const mb = BULLET.exec(l);
				const mo = mb ? null : NUMBER.exec(l);
				const m = kind === "ul" ? mb : mo;
				if (m) {
					items.push({ text: m[3], depth: m[1].length >= 2 ? 1 : 0, n: kind === "ol" ? Number(m[2]) : undefined });
					i++;
				} else if (l.trim() && /^\s{2,}/.test(l) && items.length) {
					// A wrapped continuation of the item above.
					items[items.length - 1].text += `\n${l.trim()}`;
					i++;
				} else break;
			}
			i--;
			blocks.push({ t: kind, items });
			continue;
		}
		para.push(line);
	}
	flush();
	return blocks;
}

export function VividMarkdown({ text, className }: { text: string; className?: string }) {
	const blocks = parse(text);
	return (
		<div className={className}>
			{blocks.map((b, n) => {
				const k = `b${n}`;
				switch (b.t) {
					case "p":
						return <p key={k}>{inline(b.text, k)}</p>;
					case "h":
						return b.level <= 2 ? (
							<h3 key={k} className="pt-1 font-display text-[calc(17px*var(--ws-fs))] font-semibold text-primary">
								{inline(b.text, k)}
							</h3>
						) : (
							<h4 key={k} className="pt-1 font-sans text-[calc(15.5px*var(--ws-fs))] font-semibold text-primary">
								{inline(b.text, k)}
							</h4>
						);
					case "ul":
						return (
							<ul key={k} className="flex flex-col gap-1.5">
								{b.items.map((it, j) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: list items have no identity beyond their place
									<li key={j} className={`relative pl-5 ${it.depth ? "ml-5" : ""}`}>
										<span aria-hidden="true" className="absolute top-[0.72em] left-1 h-[5px] w-[5px] -translate-y-1/2 rounded-full bg-primary/45" />
										{inline(it.text, `${k}${j}`)}
									</li>
								))}
							</ul>
						);
					case "ol":
						return (
							<ol key={k} className="flex flex-col gap-1.5">
								{b.items.map((it, j) => (
									// biome-ignore lint/suspicious/noArrayIndexKey: list items have no identity beyond their place
									<li key={j} className={`relative pl-7 ${it.depth ? "ml-5" : ""}`}>
										<span aria-hidden="true" className="absolute top-0 left-0 w-5 text-right font-medium text-muted tabular-nums">
											{it.n ?? j + 1}.
										</span>
										{inline(it.text, `${k}${j}`)}
									</li>
								))}
							</ol>
						);
					case "quote":
						return (
							<blockquote key={k} className="border-primary/20 border-l-2 pl-3.5 text-muted">
								{inline(b.text, k)}
							</blockquote>
						);
					case "code":
						return (
							<pre key={k} className="overflow-x-auto rounded-[10px] bg-primary/[0.05] px-3.5 py-3 font-mono text-[calc(13px*var(--ws-fs))] leading-relaxed text-primary">
								<code>{b.text}</code>
							</pre>
						);
					case "hr":
						return <hr key={k} className="border-hairline" />;
					case "math":
						return <TeX key={k} tex={b.tex} display />;
					case "table":
						return (
							<div key={k} className="overflow-x-auto rounded-[10px] ring-1 ring-primary/[0.08]">
								<table className="w-full border-collapse text-left text-[calc(14px*var(--ws-fs))]">
									<thead>
										<tr>
											{b.head.map((c, j) => (
												// biome-ignore lint/suspicious/noArrayIndexKey: table cells are positional
												<th key={j} className="bg-primary/[0.04] px-3 py-2 font-semibold text-primary">
													{inline(c, `${k}h${j}`)}
												</th>
											))}
										</tr>
									</thead>
									<tbody>
										{b.rows.map((r, j) => (
											// biome-ignore lint/suspicious/noArrayIndexKey: table rows are positional
											<tr key={j} className="border-hairline border-t">
												{r.map((c, x) => (
													// biome-ignore lint/suspicious/noArrayIndexKey: table cells are positional
													<td key={x} className="px-3 py-2 align-top tabular-nums">
														{inline(c, `${k}r${j}c${x}`)}
													</td>
												))}
											</tr>
										))}
									</tbody>
								</table>
							</div>
						);
					default:
						return null;
				}
			})}
		</div>
	);
}

/**
 * A short string with the answer's inline grammar (maths, bold, code, links),
 * no blocks: the text fields inside a widget (components/vivid/widgets).
 */
export function VividInline({ text }: { text: string }) {
	return <>{inline(text, "w")}</>;
}

/** One piece of math, rendered by KaTeX once it has loaded; the source shows until then. */
export function TeX({ tex, display }: { tex: string; display: boolean }) {
	const [html, setHtml] = useState<string | null>(null);
	useEffect(() => {
		let alive = true;
		void import("./katex-render").then((m) => {
			if (alive) setHtml(m.renderTeX(tex.trim(), display));
		});
		return () => {
			alive = false;
		};
	}, [tex, display]);
	if (html === null) {
		return display ? (
			<pre className="overflow-x-auto font-mono text-[calc(13px*var(--ws-fs))] text-muted">{tex.trim()}</pre>
		) : (
			<code className="font-mono text-[0.9em] text-muted">{tex}</code>
		);
	}
	return display ? (
		// biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output, trust off (katex-render.ts)
		<div className="overflow-x-auto overflow-y-hidden py-1 text-primary" dangerouslySetInnerHTML={{ __html: html }} />
	) : (
		// biome-ignore lint/security/noDangerouslySetInnerHtml: KaTeX output, trust off (katex-render.ts)
		<span className="text-primary" dangerouslySetInnerHTML={{ __html: html }} />
	);
}
