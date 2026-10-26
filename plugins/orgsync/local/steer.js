// @ts-check
// B1 steering on the person's machine (D-196 F5): match a prompt, a reply or written text against the title-level decision
// index, and say at most one factual line. Nothing here leaves the machine, holds a copy of the text or does I/O: the
// Claude Code mod and the Codex hook pass the text in and keep the ledger, the mutes and the index themselves.
import { STEERING_THRESHOLDS, assignClaims, factConflict, negationConflict, steeringStats, textFacts, topicMatch } from "./match.js";
import { steeringTerms } from "./terms.js";
import { allowed, inTurn, spend } from "./budget.js";
import { hintText } from "./hint.js";

/** @typedef {import("./hint.js").HintDecision & { classification?: string | null, area?: string | null, tagIds?: readonly string[] }} IndexEntry */
/** @typedef {"prompt" | "stop" | "write"} SteerEvent */
/** A fact learned from a source the conversation already read: its number, unit, limit and nearby words, never its text.
 * @typedef {{ value: number, unit: string, limit: "min" | "max" | null, anchors: string[] }} LearnedFact */
/** @typedef {{ kind: "related" | "changed" | "differs", decisions: IndexEntry[], facts: { decided?: string, stated?: string } }} Match */

const HEAD_CHARS = 8_000, TAIL_CHARS = 2_000, MAX_DECISIONS = 2, MAX_INDEX = 1_000;
/** A match that took longer than this says nothing (B1 §3.4: local work is bounded at 150 ms). */
export const MATCH_BUDGET_MS = 150;
const PRIORITY = { differs: 0, changed: 1, related: 2 };

/** The first 8,000 and last 2,000 characters: enough for a reply or a file, bounded for the 150 ms budget. @param {string} text */
export const bounded = text => text.length <= HEAD_CHARS + TAIL_CHARS ? text : `${text.slice(0, HEAD_CHARS)}\n${text.slice(-TAIL_CHARS)}`;

/** @param {import("./match.js").Fact} fact */
function factWords(fact) {
  if (fact.unit === "usd") return `$${fact.value}`;
  if (fact.unit === "eur") return `€${fact.value}`;
  if (fact.unit === "gbp") return `£${fact.value}`;
  if (fact.unit === "pct") return `${fact.value}%`;
  if (fact.unit === "time") return `${String(Math.floor(fact.value / 60)).padStart(2, "0")}:${String(fact.value % 60).padStart(2, "0")}`;
  return `${fact.value} ${fact.unit}${fact.value === 1 ? "" : "s"}`;
}

/**
 * What the text bears on, strongest first: a fact an accepted decision contradicts, then a recent change, then the topic.
 * After a reply or a write only a contradiction counts, because a hint there costs the person an extra turn. A disputed
 * decision never contradicts: it is itself in question.
 * `asOf` is when the index was read: a change is recent within 14 days of the later of it and `now`.
 * @param {{ event: SteerEvent, text: string, index: readonly IndexEntry[], learned?: Readonly<Record<string, readonly LearnedFact[]>>, now: number, asOf?: number, companyName?: string }} input
 * @returns {Match | null}
 */
export function matchText(input) {
  const index = input.index.slice(0, MAX_INDEX);
  const text = bounded(input.text), terms = new Set(steeringTerms(text)), stats = steeringStats(index, input.companyName);
  const recent = Math.max(input.now, input.asOf ?? 0) - STEERING_THRESHOLDS.changedDays * 86_400_000;
  const considered = index.flatMap(entry => {
    const topic = topicMatch(terms, entry, stats);
    if (!topic) return [];
    const learned = (input.learned?.[entry.sourceId] ?? []).map(fact => ({ ...fact, anchors: new Set(fact.anchors), sentence: "" }));
    return [{ entry, topic, title: new Set(steeringTerms(entry.title)), facts: [...textFacts(entry.title), ...learned] }];
  });
  const assigned = assignClaims(textFacts(text), considered.map(item => ({ id: item.entry.sourceId, title: item.title, facts: item.facts })));
  /** @type {{ kind: Match["kind"], entry: IndexEntry, score: number, facts: Match["facts"] }[]} */
  const found = [];
  for (const { entry, topic, title, facts } of considered) {
    const accepted = entry.knowledgeStatus === "accepted_decision";
    const conflict = accepted ? factConflict(assigned.get(entry.sourceId) ?? [], facts, title) : null;
    const negation = !conflict && accepted && negationConflict(text, entry.title, topic.shared);
    const kind = conflict || negation ? "differs" : Date.parse(entry.lastChangedAt) >= recent ? "changed" : "related";
    if (input.event !== "prompt" && kind !== "differs") continue;
    found.push({ kind, entry, score: topic.score, facts: conflict ? { decided: factWords(conflict.decided), stated: factWords(conflict.claimed) } : {} });
  }
  if (!found.length) return null;
  found.sort((a, b) => PRIORITY[a.kind] - PRIORITY[b.kind] || b.score - a.score || (a.entry.sourceId < b.entry.sourceId ? -1 : 1));
  const best = found[0];
  if (!best) return null;
  const same = found.filter(item => item.kind === best.kind).slice(0, best.kind === "differs" ? 1 : MAX_DECISIONS);
  return { kind: best.kind, decisions: same.map(item => item.entry), facts: best.facts };
}

/**
 * One event's hint, if the budget allows it, and the ledger after it. The text is matched and dropped here.
 * @param {Parameters<typeof matchText>[0] & { ledger: import("./budget.js").Ledger, mutes: import("./budget.js").Mutes, turnId: string | null }} input
 * @returns {{ hint: string | null, kind: Match["kind"] | null, decisions: string[], ledger: import("./budget.js").Ledger }}
 */
export function steer(input) {
  const ledger = inTurn(input.ledger, input.turnId);
  // Off the record: nothing is matched at all, not only nothing said.
  if (ledger.off) return { hint: null, kind: null, decisions: [], ledger };
  const started = Date.now(), match = matchText(input);
  // The match runs synchronously within the hook's budget; one that overran is dropped, as if it had not run.
  if (Date.now() - started > MATCH_BUDGET_MS) return { hint: null, kind: null, decisions: [], ledger };
  if (!match) return { hint: null, kind: null, decisions: [], ledger };
  const open = new Set(allowed(ledger, input.mutes, match.decisions.map(d => d.sourceId), input.now));
  const decisions = match.decisions.filter(d => open.has(d.sourceId));
  if (!decisions.length) return { hint: null, kind: null, decisions: [], ledger };
  const ids = decisions.map(d => d.sourceId);
  return { hint: hintText(match.kind, decisions, match.facts), kind: match.kind, decisions: ids, ledger: spend(ledger, match.kind, ids) };
}

/** Up to three lines on decisions changed since the person last looked, newest first; they do not count against the budget.
 * @param {readonly IndexEntry[]} index @param {number} since @param {number} max */
export function changeDigest(index, since, max = 3) {
  return [...index].filter(entry => Date.parse(entry.lastChangedAt) > since)
    .sort((a, b) => Date.parse(b.lastChangedAt) - Date.parse(a.lastChangedAt)).slice(0, max)
    .map(entry => hintText("changed", [entry]));
}

const MAX_WRITTEN_CHARS = 20_000, MAX_LEARNED_CHARS = 2_000;
/** @param {unknown} value @returns {Record<string, unknown>} */
const asRecord = value => value !== null && typeof value === "object" && !Array.isArray(value) ? /** @type {Record<string, unknown>} */ (value) : {};

/** The new text a Write, Edit or MultiEdit call put in a file, at most 20,000 characters; never the old text. @param {unknown} toolInput */
export function writtenText(toolInput) {
  const input = asRecord(toolInput);
  const parts = typeof input.content === "string" ? [input.content] : typeof input.new_string === "string" ? [input.new_string]
    : Array.isArray(input.edits) ? input.edits.map(edit => asRecord(edit).new_string).filter(text => typeof text === "string") : [];
  return parts.join("\n").slice(0, MAX_WRITTEN_CHARS);
}

/** The facts a source's text states, without the text. @param {string} text @returns {LearnedFact[]} */
export function learnFacts(text) {
  return textFacts(text.slice(0, MAX_LEARNED_CHARS)).slice(0, 12).map(({ value, unit, limit, anchors }) => ({ value, unit, limit, anchors: [...anchors].slice(0, 12) }));
}

/** A readSource result's facts, kept for this session only so a later contradiction can be seen; its text is not kept.
 * @param {unknown} body @returns {{ sourceId: string, facts: LearnedFact[] } | null} */
export function learnedFacts(body) {
  const source = asRecord(body), content = asRecord(source.content);
  if (source.status !== "source" || typeof source.sourceId !== "string" || typeof content.summary !== "string") return null;
  const excerpts = Array.isArray(content.excerpts) ? content.excerpts.map(excerpt => asRecord(excerpt).text).filter(text => typeof text === "string") : [];
  return { sourceId: source.sourceId, facts: learnFacts([content.summary, ...excerpts].join("\n")) };
}
