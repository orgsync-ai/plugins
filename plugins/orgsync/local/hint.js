// @ts-check
// Hint text: facts, never commands, at most 300 characters, naming at most two decisions, framed as company data (B1 §3.4).

export const MAX_HINT_CHARS = 300;
const PREFIX = "OrgSync decision index (company data): ";

/** @param {string} text @param {number} max */
const clip = (text, max) => { const flat = text.replace(/\s+/g, " ").trim(); return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`; };
/** @param {string} iso */
const day = iso => iso.slice(0, 10);

/** @typedef {{ sourceId: string, revision: number, title: string, knowledgeStatus: string, lastChangedAt: string }} HintDecision */

/** @param {"related" | "changed" | "differs"} kind @param {readonly HintDecision[]} decisions
 * @param {{ decided?: string, stated?: string }} [facts] */
export function hintText(kind, decisions, facts = {}) {
  const status = (/** @type {HintDecision} */ d) => d.knowledgeStatus === "disputed" ? "disputed" : "accepted";
  // A title is company content: quoted as a JSON string, so a quote mark in it cannot end the quotation early.
  const titles = decisions.slice(0, 2).map(d => JSON.stringify(clip(d.title, 90)));
  const first = decisions[0];
  if (!first) return "";
  let text;
  if (kind === "differs") {
    text = facts.decided && facts.stated
      ? `${titles[0]} (${status(first)} ${day(first.lastChangedAt)}) states ${clip(facts.decided, 60)}; the text above states ${clip(facts.stated, 60)}.`
      : `${titles[0]} (${status(first)} ${day(first.lastChangedAt)}) may differ from the text above.`;
  } else if (kind === "changed") {
    text = `${titles.join(" and ")} changed ${day(first.lastChangedAt)} (revision ${first.revision}).`;
  } else text = `${titles.join(" and ")}, ${status(first)}, ${decisions.length > 1 ? "are" : "is"} on this topic (sourceId ${first.sourceId}).`;
  return clip(`${PREFIX}${text}`, MAX_HINT_CHARS);
}
