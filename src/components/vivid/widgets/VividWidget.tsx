"use client";

import clsx from "clsx";
import { Component, type ComponentType, type ReactNode } from "react";
import * as D from "./data";
import * as L from "./learn";
import * as F from "./life";
import * as LV from "./live";
import * as P from "./plot";
import * as W2 from "./wave2";
import * as W3 from "./wave3";
import { css, type Props } from "./parts";

/**
 * Vivid's widgets: one `ui` card (gateway docs/vivid-widgets.md, protocol v1)
 * drawn from its JSON. The gateway decides what to show and validates the
 * data; the web and the phone app draw the same ids. An id this client does
 * not know draws nothing: the prose already answers.
 */

// biome-ignore lint/suspicious/noExplicitAny: each widget reads its own shape defensively
const REGISTRY: Record<string, ComponentType<Props<any>>> = {
	steps: L.StepsWidget,
	formula: L.FormulaWidget,
	table: D.TableWidget,
	compare: D.CompareWidget,
	proscons: D.ProsConsWidget,
	timeline: F.TimelineWidget,
	checklist: F.ChecklistWidget,
	definition: L.DefinitionWidget,
	stats: D.StatsWidget,
	chart: D.ChartWidget,
	recipe: F.RecipeWidget,
	code: L.CodeWidget,
	convert: L.ConvertWidget,
	calc: L.CalcWidget,
	quiz: L.QuizWidget,
	flashcards: L.FlashcardsWidget,
	tldr: L.TldrWidget,
	quote: L.QuoteWidget,
	itinerary: F.ItineraryWidget,
	budget: D.BudgetWidget,
	place: F.PlaceWidget,
	event: F.EventWidget,
	person: F.PersonWidget,
	palette: D.PaletteWidget,
	translation: L.TranslationWidget,
	progress: D.ProgressWidget,
	decision: D.DecisionWidget,
	glossary: L.GlossaryWidget,
	countdown: F.CountdownWidget,
	market: D.MarketWidget,
	// Wave 2, no live data (docs/vivid-widgets.md 7.2).
	"reply-ideas": W2.ReplyIdeasWidget,
	rewrite: W2.RewriteWidget,
	clarify: W2.ClarifyWidget,
	"answer-hero": W2.AnswerHeroWidget,
	"knowledge-panel": W2.KnowledgePanelWidget,
	"graph-plot": P.GraphPlotWidget,
	"practice-problem": W2.PracticeProblemWidget,
	"scam-check": W2.ScamCheckWidget,
	"secret-warning": W2.SecretWarningWidget,
	"doc-summary": W2.DocSummaryWidget,
	"caption-options": W2.CaptionOptionsWidget,
	diagram: P.DiagramWidget,
	timer: W2.TimerWidget,
	reminder: W2.ReminderWidget,
	// Wave 2 LIVE (7.3): the tool's own payload, by ref.
	weather: LV.WeatherWidget,
	"fx-rate": LV.FxRateWidget,
	// Wave 3 (8): WorldSpace's own world by ref, the member's wallet read only, two calculators.
	"profile-card": W3.ProfileCardWidget,
	"post-embed": W3.PostEmbedWidget,
	trending: W3.TrendingWidget,
	"live-now": W3.LiveNowWidget,
	"space-card": W3.SpaceCardWidget,
	"chat-summary": W3.ChatSummaryWidget,
	"link-summary": W3.LinkSummaryWidget,
	sources: W3.SourcesWidget,
	"wallet-balance": W3.WalletBalanceWidget,
	transactions: W3.TransactionsWidget,
	"send-preview": W3.SendPreviewWidget,
	"trade-plan": W3.TradePlanWidget,
	"position-size": W3.PositionSizeWidget,
};

/** The gateway's cap; a stored thread from before it is held to it too. */
export const MAX_WIDGETS = 4;

export function hasWidget(id: string) {
	return id in REGISTRY;
}

export function VividWidget({
	widget,
	title,
	data,
	live,
}: {
	widget: string;
	title?: string;
	data: Record<string, unknown>;
	/** Arrived on this answer's stream: charts and rings grow in once. */
	live?: boolean;
}) {
	const W = REGISTRY[widget];
	if (!W || !data || typeof data !== "object") return null;
	return (
		<Contain>
			<W data={data} title={title || undefined} live={live} />
		</Contain>
	);
}

/**
 * The place a widget is about to land, while Vivid draws it: the card's own
 * shell, a header line and three rows, so the widget arrives where its shape
 * was ("anything that loads shows its shape"). It pulses with the house
 * skeleton, which stops under reduced motion.
 */
export function WidgetSkeleton() {
	return (
		<div aria-hidden className={clsx(css.root, "flex flex-col gap-4 px-4 pt-4 pb-5 sm:px-5")}>
			<div className="flex items-center gap-2.5">
				<span className="skeleton size-[18px] rounded-full" />
				<span className="skeleton h-3.5 w-32 rounded-pill" />
			</div>
			<span className="skeleton h-16 w-full rounded-[13px]" />
			<div className="flex flex-col gap-2.5">
				<span className="skeleton h-3 w-[86%] rounded-pill" />
				<span className="skeleton h-3 w-[64%] rounded-pill" />
			</div>
		</div>
	);
}

/** A widget that throws on data it did not expect disappears; the answer stays. */
class Contain extends Component<{ children: ReactNode }, { failed: boolean }> {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	render() {
		return this.state.failed ? null : this.props.children;
	}
}
