/** A ledger whose turn count restarts when a new turn begins. @param {Ledger} ledger @param {string | null} turnId @returns {Ledger} */
export function inTurn(ledger: Ledger, turnId: string | null): Ledger;
/** Decisions that may still be named now. @param {Ledger} ledger @param {Mutes} mutes @param {readonly string[]} ids @param {number} now */
export function allowed(ledger: Ledger, mutes: Mutes, ids: readonly string[], now: number): string[];
/** @param {Ledger} ledger @param {string} kind @param {readonly string[]} ids @returns {Ledger} */
export function spend(ledger: Ledger, kind: string, ids: readonly string[]): Ledger;
/** The ledger after the person's prompt sets or clears the off-the-record marker; clearing it never clears `captureOff`. A forget
 * also counts up `forgets`, so the mod forgets each time it is asked.
 * @param {Ledger} ledger @param {string} prompt @returns {Ledger} */
export function recordMarker(ledger: Ledger, prompt: string): Ledger;
/** Reads the person's next prompt for an answer to the last hint: a 7-day mute or, for a differs hint, a session override.
 * Only words the person typed count; the hint's own decisions are the only ones affected.
 * @param {Ledger} ledger @param {Mutes} mutes @param {string} prompt @param {number} now
 * @returns {{ ledger: Ledger, mutes: Mutes, outcome: "not_relevant" | "overridden" | null }} */
export function answerLast(ledger: Ledger, mutes: Mutes, prompt: string, now: number): {
    ledger: Ledger;
    mutes: Mutes;
    outcome: "not_relevant" | "overridden" | null;
};
/** Mutes that have not yet ended. @param {Mutes} mutes @param {number} now @returns {Mutes} */
export function prune(mutes: Mutes, now: number): Mutes;
export const BUDGET: Readonly<{
    perTurn: 1;
    perSession: 3;
    muteDays: 7;
}>;
export function emptyLedger(): Ledger;
/**
 * `off` is the session's off-the-record marker (D-196 F5): while it is set, steering says nothing at all. `captureOff` is the same
 * marker for capture, and sticky (D-195): once the person goes off the record, nothing from the session is captured, earlier turns
 * included, even after "back on the record", which resumes hints only. `forgets` counts the person's requests to forget it.
 */
export type Ledger = {
    turnId: string | null;
    turnHints: number;
    sessionHints: number;
    hinted: string[];
    overridden: string[];
    last: {
        kind: string;
        decisions: string[];
    } | null;
    off?: boolean;
    captureOff?: boolean;
    forgets?: number;
};
/**
 * sourceId → muted until, in ms
 */
export type Mutes = Record<string, number>;
