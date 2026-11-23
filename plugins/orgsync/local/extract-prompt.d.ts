/**
 * The extractor's whole prompt. `transcript` is the redacted text (`local/redact.js`); its newest 80,000 characters are kept.
 * @param {{ transcript: string, earlierTitles?: readonly string[], decisionTitles?: readonly string[], queuedTitles?: readonly string[] }} input
 */
export function extractPrompt(input: {
    transcript: string;
    earlierTitles?: readonly string[];
    decisionTitles?: readonly string[];
    queuedTitles?: readonly string[];
}): string;
/**
 * The extractor's items, each with exactly the known fields and the right types. A malformed answer reads as no items; an item
 * of the wrong shape is left out. Sizes, labels and confidence are the gate's to judge.
 * @param {string} text @returns {import("./gate.js").CaptureItem[]}
 */
export function parseExtraction(text: string): import("./gate.js").CaptureItem[];
/** The extractor's version per surface; a change to the prompt or its parsing takes a new version. */
export const EXTRACTORS: Readonly<{
    claude_code: "cc-1";
    codex: "codex-1";
}>;
/** The newest part of a transcript an extractor reads, about 20,000 tokens (plan B2 §4.5 cost estimate). */
export const MAX_TRANSCRIPT_CHARS: 80000;
