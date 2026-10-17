"use client";

import { Component, type ComponentType, type ReactNode } from "react";
import * as D from "./data";
import * as L from "./learn";
import * as F from "./life";
import type { Props } from "./parts";

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
