/**
 * The report vocabulary, mirrored from the gateway's `report.model.ts` enums.
 *
 * The `id` values cross the wire and are stored on every report record, so
 * they are permanent — reword a label freely, never rename an id. Order here
 * is the order the reasons are offered, and it is deliberate: the things
 * people most often actually mean sit at the top, and "something else" is
 * last so it is a fallback rather than an easy escape from choosing.
 */

export type ReportTargetType =
	| "user"
	| "post"
	| "comment"
	| "story"
	| "message"
	| "community"
	| "space";

export type ReportReasonId =
	| "spam"
	| "harassment"
	| "hate"
	| "violence"
	| "sexual"
	| "self-harm"
	| "misinformation"
	| "impersonation"
	| "scam"
	| "illegal"
	| "intellectual-property"
	| "other";

export type ReportReason = {
	id: ReportReasonId;
	labelKey: string;
	descKey: string;
	/** Reasons we route with more urgency get a marked treatment. */
	priority?: boolean;
};

export const REPORT_REASONS: ReportReason[] = [
	{ id: "spam", labelKey: "report.reason.spam", descKey: "report.reason.spam.desc" },
	{
		id: "harassment",
		labelKey: "report.reason.harassment",
		descKey: "report.reason.harassment.desc",
	},
	{ id: "hate", labelKey: "report.reason.hate", descKey: "report.reason.hate.desc" },
	{
		id: "violence",
		labelKey: "report.reason.violence",
		descKey: "report.reason.violence.desc",
		priority: true,
	},
	{
		id: "self-harm",
		labelKey: "report.reason.selfHarm",
		descKey: "report.reason.selfHarm.desc",
		priority: true,
	},
	{
		id: "scam",
		labelKey: "report.reason.scam",
		descKey: "report.reason.scam.desc",
	},
	{
		id: "sexual",
		labelKey: "report.reason.sexual",
		descKey: "report.reason.sexual.desc",
	},
	{
		id: "misinformation",
		labelKey: "report.reason.misinformation",
		descKey: "report.reason.misinformation.desc",
	},
	{
		id: "impersonation",
		labelKey: "report.reason.impersonation",
		descKey: "report.reason.impersonation.desc",
	},
	{
		id: "illegal",
		labelKey: "report.reason.illegal",
		descKey: "report.reason.illegal.desc",
	},
	{
		id: "intellectual-property",
		labelKey: "report.reason.ip",
		descKey: "report.reason.ip.desc",
	},
	{ id: "other", labelKey: "report.reason.other", descKey: "report.reason.other.desc" },
];

/** What the sheet calls the thing being reported, in its heading. */
export const REPORT_TARGET_LABEL_KEY: Record<ReportTargetType, string> = {
	user: "report.target.user",
	post: "report.target.post",
	comment: "report.target.comment",
	story: "report.target.story",
	message: "report.target.message",
	community: "report.target.community",
	space: "report.target.space",
};

/** Matches the gateway's `details` maxlength. */
export const REPORT_DETAILS_MAX = 1000;
