/**
 * What the text bears on, strongest first: a fact an accepted decision contradicts, then a recent change, then the topic.
 * After a reply or a write only a contradiction counts, because a hint there costs the person an extra turn. A disputed
 * decision never contradicts: it is itself in question.
 * `asOf` is when the index was read: a change is recent within 14 days of the later of it and `now`.
 * @param {{ event: SteerEvent, text: string, index: readonly IndexEntry[], learned?: Readonly<Record<string, readonly LearnedFact[]>>, now: number, asOf?: number, companyName?: string }} input
 * @returns {Match | null}
 */
export function matchText(input: {
    event: SteerEvent;
    text: string;
    index: readonly IndexEntry[];
    learned?: Readonly<Record<string, readonly LearnedFact[]>>;
    now: number;
    asOf?: number;
    companyName?: string;
}): Match | null;
/**
 * One event's hint, if the budget allows it, and the ledger after it. The text is matched and dropped here.
 * @param {Parameters<typeof matchText>[0] & { ledger: import("./budget.js").Ledger, mutes: import("./budget.js").Mutes, turnId: string | null }} input
 * @returns {{ hint: string | null, kind: Match["kind"] | null, decisions: string[], ledger: import("./budget.js").Ledger }}
 */
export function steer(input: Parameters<typeof matchText>[0] & {
    ledger: import("./budget.js").Ledger;
    mutes: import("./budget.js").Mutes;
    turnId: string | null;
}): {
    hint: string | null;
    kind: Match["kind"] | null;
    decisions: string[];
    ledger: import("./budget.js").Ledger;
};
/** Up to three lines on decisions changed since the person last looked, newest first; they do not count against the budget.
 * @param {readonly IndexEntry[]} index @param {number} since @param {number} max */
export function changeDigest(index: readonly IndexEntry[], since: number, max?: number): string[];
/** The new text a Write, Edit or MultiEdit call put in a file, at most 20,000 characters; never the old text. @param {unknown} toolInput */
export function writtenText(toolInput: unknown): string;
/** The facts a source's text states, without the text. @param {string} text @returns {LearnedFact[]} */
export function learnFacts(text: string): LearnedFact[];
/** A readSource result's facts, kept for this session only so a later contradiction can be seen; its text is not kept.
 * @param {unknown} body @returns {{ sourceId: string, facts: LearnedFact[] } | null} */
export function learnedFacts(body: unknown): {
    sourceId: string;
    facts: LearnedFact[];
} | null;
/** A match that took longer than this says nothing (B1 §3.4: local work is bounded at 150 ms). */
export const MATCH_BUDGET_MS: 150;
export function bounded(text: string): string;
export type IndexEntry = import("./hint.js").HintDecision & {
    classification?: string | null;
    area?: string | null;
    tagIds?: readonly string[];
};
export type SteerEvent = "prompt" | "stop" | "write";
/**
 * A fact learned from a source the conversation already read: its number, unit, limit and nearby words, never its text.
 */
export type LearnedFact = {
    value: number;
    unit: string;
    limit: "min" | "max" | null;
    anchors: string[];
};
export type Match = {
    kind: "related" | "changed" | "differs";
    decisions: IndexEntry[];
    facts: {
        decided?: string;
        stated?: string;
    };
};
