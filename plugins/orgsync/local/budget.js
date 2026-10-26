// @ts-check
// How often steering may speak (B1 §3.4): at most one hint a turn and three a session, never the same decision twice in a
// session, silence after the person overrides a differs hint, and a 7-day mute after "not relevant". Pure: callers keep the
// ledger in session state and the mutes in per-person storage.

export const BUDGET = Object.freeze({ perTurn: 1, perSession: 3, muteDays: 7 });

/** `off` is the session's off-the-record marker (D-196 F5): while it is set, steering says nothing at all.
 * @typedef {{ turnId: string | null, turnHints: number, sessionHints: number, hinted: string[], overridden: string[], last: { kind: string, decisions: string[] } | null, off?: boolean }} Ledger */
/** @typedef {Record<string, number>} Mutes  sourceId → muted until, in ms */

/** @returns {Ledger} */
export const emptyLedger = () => ({ turnId: null, turnHints: 0, sessionHints: 0, hinted: [], overridden: [], last: null });

/** A ledger whose turn count restarts when a new turn begins. @param {Ledger} ledger @param {string | null} turnId @returns {Ledger} */
export function inTurn(ledger, turnId) {
  return ledger.turnId === turnId ? ledger : { ...ledger, turnId, turnHints: 0 };
}

/** Decisions that may still be named now. @param {Ledger} ledger @param {Mutes} mutes @param {readonly string[]} ids @param {number} now */
export function allowed(ledger, mutes, ids, now) {
  if (ledger.off || ledger.turnHints >= BUDGET.perTurn || ledger.sessionHints >= BUDGET.perSession) return [];
  return ids.filter(id => !ledger.hinted.includes(id) && !ledger.overridden.includes(id) && !((mutes[id] ?? 0) > now));
}

/** @param {Ledger} ledger @param {string} kind @param {readonly string[]} ids @returns {Ledger} */
export function spend(ledger, kind, ids) {
  return { ...ledger, turnHints: ledger.turnHints + 1, sessionHints: ledger.sessionHints + 1, hinted: [...ledger.hinted, ...ids].slice(-50),
    last: { kind, decisions: [...ids] } };
}

// The person's own words turn the session off the record, or back on. Only a prompt they typed counts.
const OFF = /\b(off the record|stop (the )?(orgsync )?hints|no (more )?(orgsync )?hints)\b/i;
const ON = /\b(back on the record|on the record again|resume (the )?(orgsync )?hints|hints back on)\b/i;

/** The ledger after the person's prompt sets or clears the off-the-record marker. @param {Ledger} ledger @param {string} prompt @returns {Ledger} */
export function recordMarker(ledger, prompt) {
  if (ON.test(prompt)) return { ...ledger, off: false };
  if (OFF.test(prompt)) return { ...ledger, off: true, last: null };
  return ledger;
}

const NOT_RELEVANT = /\b(not relevant|irrelevant|ignore (that|this|it)|doesn'?t apply|does not apply|not related)\b/i;
const OVERRIDE = /\b(keep my (number|price|figure|value)|i know|use mine|use my (number|price|figure|value)|that'?s outdated|it'?s outdated|leave it as is)\b/i;

/** Reads the person's next prompt for an answer to the last hint: a 7-day mute or, for a differs hint, a session override.
 * Only words the person typed count; the hint's own decisions are the only ones affected.
 * @param {Ledger} ledger @param {Mutes} mutes @param {string} prompt @param {number} now
 * @returns {{ ledger: Ledger, mutes: Mutes, outcome: "not_relevant" | "overridden" | null }} */
export function answerLast(ledger, mutes, prompt, now) {
  const last = ledger.last;
  if (!last) return { ledger, mutes, outcome: null };
  const cleared = { ...ledger, last: null };
  if (NOT_RELEVANT.test(prompt)) {
    const until = now + BUDGET.muteDays * 86_400_000;
    return { ledger: cleared, mutes: { ...prune(mutes, now), ...Object.fromEntries(last.decisions.map(id => [id, until])) }, outcome: "not_relevant" };
  }
  if (last.kind === "differs" && OVERRIDE.test(prompt)) return { ledger: { ...cleared, overridden: [...ledger.overridden, ...last.decisions] }, mutes, outcome: "overridden" };
  return { ledger: cleared, mutes, outcome: null };
}

/** Mutes that have not yet ended. @param {Mutes} mutes @param {number} now @returns {Mutes} */
export function prune(mutes, now) {
  return Object.fromEntries(Object.entries(mutes).filter(([, until]) => typeof until === "number" && until > now));
}
