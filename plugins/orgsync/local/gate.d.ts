/** Whether a run of 13 to 19 digits, spaces or dashes allowed between them, passes the Luhn check, as a card number does.
 * Identical to core's `hasCardNumber`. @param {string} text */
export function hasCardNumber(text: string): boolean;
/** Whether a text names one individual: a personal pronoun, or a capitalised name that is not a sentence's first word.
 * @param {string} text */
export function individualNamed(text: string): boolean;
/** The never-capture topic a text bears on, or null. @param {string} text */
export function sensitiveTopic(text: string): string;
/** Whether a text pairs one individual with a personal attribute (third-party personal data). @param {string} text */
export function personalAboutIndividual(text: string): boolean;
/**
 * Why one item may not leave the machine, as a fixed word, or null when it may. The checks run in a fixed order, cheapest first.
 * @param {unknown} item @param {{ source: string | null | undefined, threshold?: number }} options
 */
export function gateReason(item: unknown, options: {
    source: string | null | undefined;
    threshold?: number;
}): string;
/** Items that pass every check, and the index and reason of each that does not.
 * @param {readonly unknown[]} items @param {{ source: string | null | undefined, threshold?: number }} options
 * @returns {{ kept: CaptureItem[], dropped: Dropped[] }} */
export function gateItems(items: readonly unknown[], options: {
    source: string | null | undefined;
    threshold?: number;
}): {
    kept: CaptureItem[];
    dropped: Dropped[];
};
/**
 * Research B8's first fix, the person's side: drop a candidate that matches a current decision title, an item already in the
 * person's queue, an item captured earlier in the session, or an earlier candidate of this run. The server also refuses an
 * exact-title duplicate (`capture_duplicate`).
 * @template {{ title: string }} T
 * @param {readonly T[]} items
 * @param {{ decisionTitles?: readonly string[], queuedTitles?: readonly string[], earlierTitles?: readonly string[] }} known
 * @returns {{ kept: T[], dropped: Dropped[] }}
 */
export function dedupeItems<T extends {
    title: string;
}>(items: readonly T[], known: {
    decisionTitles?: readonly string[];
    queuedTitles?: readonly string[];
    earlierTitles?: readonly string[];
}): {
    kept: T[];
    dropped: Dropped[];
};
export const GATE_VERSION: "gate-1";
/** Credential shapes, identical to packages/core/src/capture-policy.ts `CAPTURE_CREDENTIAL_PATTERNS`, which the server refuses
 * with `capture_sensitive_pattern`. tests/capture-gate-parity.test.ts keeps them identical; change both together. */
export const CREDENTIAL_PATTERNS: readonly RegExp[];
/** Secrets said in words, on the person's side only (the server keeps the shared list above): a password, passphrase or key
 * followed by a value with a digit or symbol, in English or French. */
export const LOCAL_SECRET_PATTERNS: readonly RegExp[];
/** What `maskSecrets` puts in place of a secret; an item that still carries it is about a secret and is dropped. */
export const MASK: "[secret]";
export function hasCredential(text: string): boolean;
/** The contract's limits for a captured item (`CAPTURE_LIMITS`, `CONTRACT_LIMITS.maxTitleChars`) and Q9's per-run cap. */
export const CAPTURED_LIMITS: Readonly<{
    maxTitleChars: 120;
    maxSummaryChars: 600;
    maxExcerpts: 3;
    maxExcerptChars: 500;
    perRun: 5;
}>;
/** The lowest confidence kept, per extractor; research B8 tunes these. */
export const THRESHOLDS: Readonly<Record<string, number>>;
export const DEFAULT_THRESHOLD: 0.7;
export const ITEM_KINDS: readonly string[];
export const SENSITIVE_LABELS: readonly string[];
export const HELP_AREAS: readonly string[];
/** At least this share of a title and summary's content words must come from the conversation. */
export const GROUNDED_SHARE: number;
export function titleKey(title: string): string;
export type ItemKind = "decision" | "rule" | "price" | "owner" | "commitment" | "way_of_working" | "goal";
/**
 * An extracted candidate, as `parseExtraction` returns it.
 */
export type CaptureItem = {
    title: string;
    summary: string;
    excerpts: string[];
    kind: ItemKind;
    area?: string | null;
    confidence: number;
    sensitive: string;
    decided: "confirmed" | "proposed";
    scope: "company" | "personal" | "session";
};
export type Dropped = {
    index: number;
    reason: string;
};
