/**
 * KaTeX for Vivid's answers, loaded on demand: VividMarkdown imports this
 * module only when an answer contains math, so the library and its CSS (and
 * fonts, which the browser fetches only for glyphs it draws) never ride the
 * main bundle.
 */
import "katex/dist/katex.min.css";
import katex from "katex";

/** Safe by configuration: no \href, \url or \htmlClass (trust: false), and
 *  bad TeX renders as red source instead of throwing. */
export function renderTeX(tex: string, display: boolean): string {
	return katex.renderToString(tex, {
		displayMode: display,
		throwOnError: false,
		strict: "ignore",
		trust: false,
		output: "htmlAndMathml",
	});
}
