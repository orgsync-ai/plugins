/** @typedef {{ sourceId: string, revision: number, title: string, knowledgeStatus: string, lastChangedAt: string }} HintDecision */
/** @param {"related" | "changed" | "differs"} kind @param {readonly HintDecision[]} decisions
 * @param {{ decided?: string, stated?: string }} [facts] */
export function hintText(kind: "related" | "changed" | "differs", decisions: readonly HintDecision[], facts?: {
    decided?: string;
    stated?: string;
}): string;
export const MAX_HINT_CHARS: 300;
export type HintDecision = {
    sourceId: string;
    revision: number;
    title: string;
    knowledgeStatus: string;
    lastChangedAt: string;
};
