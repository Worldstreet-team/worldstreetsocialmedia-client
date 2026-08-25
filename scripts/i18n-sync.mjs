#!/usr/bin/env node
// Custom catalog sync — the "automatic translation" pipeline, no Google.
//
//   node scripts/i18n-sync.mjs            report missing keys per locale
//   node scripts/i18n-sync.mjs --fill     fill gaps via the translator below
//
// en.json is the source of truth. Every other catalog is diffed against it;
// missing keys are filled by `translateBatch`, which is a seam: point it at
// the team's own translation service (or an LLM endpoint) — the default
// copies English through and flags the value so untranslated strings are
// greppable, never invisible.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	"../src/i18n/dictionaries",
);
const FILL = process.argv.includes("--fill");
const TODO_PREFIX = "⟪untranslated⟫ ";

/** The seam. Swap this body for the in-house translator when it exists. */
async function translateBatch(entries, targetLocale) {
	// entries: [key, englishText][] → returns [key, translatedText][]
	return entries.map(([key, text]) => [key, TODO_PREFIX + text]);
}

const en = JSON.parse(readFileSync(join(DIR, "en.json"), "utf8"));
const locales = readdirSync(DIR)
	.filter((f) => f.endsWith(".json") && f !== "en.json")
	.map((f) => f.replace(".json", ""));

let dirty = false;
for (const locale of locales) {
	const path = join(DIR, `${locale}.json`);
	const dict = JSON.parse(readFileSync(path, "utf8"));
	const missing = Object.keys(en).filter((k) => !(k in dict));
	const orphaned = Object.keys(dict).filter((k) => !(k in en));
	const pending = Object.entries(dict).filter(([, v]) =>
		String(v).startsWith(TODO_PREFIX),
	);

	console.log(
		`${locale}: ${missing.length} missing, ${orphaned.length} orphaned, ${pending.length} awaiting translation`,
	);

	if (FILL && (missing.length || orphaned.length)) {
		const filled = await translateBatch(
			missing.map((k) => [k, en[k]]),
			locale,
		);
		for (const [k, v] of filled) dict[k] = v;
		for (const k of orphaned) delete dict[k];
		// Keep key order aligned with en.json so diffs stay readable.
		const ordered = Object.fromEntries(
			Object.keys(en).map((k) => [k, dict[k]]),
		);
		writeFileSync(path, `${JSON.stringify(ordered, null, 2)}\n`);
		dirty = true;
		console.log(`  → ${locale}.json updated`);
	}
}
if (!FILL && !dirty) console.log("run with --fill to write catalogs");
