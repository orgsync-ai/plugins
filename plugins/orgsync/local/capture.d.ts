/**
 * `submitDraft`'s arguments for one gated item, as the OrgSync MCP tool takes them. `audience` and `approvalRequest` are the
 * server's to set (the tool always saves a private draft), so they are not sent. A way of working carries its classification
 * when it names an area, as the contract requires.
 * @param {import("./gate.js").CaptureItem} item
 * @param {{ surface: string, extractor: string, trigger: string, session: string, date: Date | string | number }} context
 */
export function toSubmission(item: import("./gate.js").CaptureItem, context: {
    surface: string;
    extractor: string;
    trigger: string;
    session: string;
    date: Date | string | number;
}): {
    capture: {
        session: string;
        surface: string;
        extractor: string;
        trigger: string;
        gate: string;
    };
    classification?: string;
    area?: string;
    idempotencyKey: string;
    title: string;
    summary: string;
    excerpts: {
        text: string;
    }[];
    sourceOrigin: string;
    captureIntent: string;
};
/**
 * One run's items: the gate, then the duplicate check, then at most five, clearest first as the extractor ordered them. Each
 * dropped item names its index in `items` and a fixed reason.
 * @param {readonly unknown[]} items
 * @param {{ source: string | null | undefined, extractor?: string, threshold?: number, decisionTitles?: readonly string[], queuedTitles?: readonly string[], earlierTitles?: readonly string[] }} options
 * @returns {{ kept: import("./gate.js").CaptureItem[], dropped: import("./gate.js").Dropped[] }}
 */
export function captureRun(items: readonly unknown[], options: {
    source: string | null | undefined;
    extractor?: string;
    threshold?: number;
    decisionTitles?: readonly string[];
    queuedTitles?: readonly string[];
    earlierTitles?: readonly string[];
}): {
    kept: import("./gate.js").CaptureItem[];
    dropped: import("./gate.js").Dropped[];
};
/**
 * From an extractor's raw answer to `submitDraft` arguments in one call: parse, gate, deduplicate, cap. The mod uses it on what
 * the worker left when it had no Node to gate with, and the worker uses it on what it extracted itself.
 * @param {{ answer: string, source: string, surface: string, extractor: string, trigger: string, session: string, date: Date | string | number,
 *   decisionTitles?: readonly string[], queuedTitles?: readonly string[], earlierTitles?: readonly string[] }} input
 */
export function submissionsFromAnswer(input: {
    answer: string;
    source: string;
    surface: string;
    extractor: string;
    trigger: string;
    session: string;
    date: Date | string | number;
    decisionTitles?: readonly string[];
    queuedTitles?: readonly string[];
    earlierTitles?: readonly string[];
}): {
    submissions: {
        capture: {
            session: string;
            surface: string;
            extractor: string;
            trigger: string;
            gate: string;
        };
        classification?: string;
        area?: string;
        idempotencyKey: string;
        title: string;
        summary: string;
        excerpts: {
            text: string;
        }[];
        sourceOrigin: string;
        captureIntent: string;
    }[];
    extracted: number;
    dropped: import("./gate.js").Dropped[];
};
/**
 * Whether any of the person's own turns in `$.session.messages()` put the session off the record, said not to save it or asked to
 * forget it (local/budget.js's words), so a resumed or forked session keeps it even under a new id (D-195: sticky for the whole
 * session). Text the app or OrgSync's mod injected, such as a skill a command loaded, is not the person's and is skipped.
 * @param {readonly { role?: unknown, text?: unknown }[]} messages
 */
export function offTheRecordIn(messages: readonly {
    role?: unknown;
    text?: unknown;
}[]): boolean;
/**
 * The one indicator line (plan B2 §4.6) from a `status` or picture `capture` block and this computer's own state: the session's
 * off-the-record marker, a local pause, and items that could not reach OrgSync. An empty string shows nothing.
 * @param {{ capture?: { company?: string, you?: string, pausedUntil?: string | null } | null, off?: boolean, pausedUntil?: number | null,
 *   unsent?: boolean, now?: number }} state
 */
export function captureLine(state: {
    capture?: {
        company?: string;
        you?: string;
        pausedUntil?: string | null;
    } | null;
    off?: boolean;
    pausedUntil?: number | null;
    unsent?: boolean;
    now?: number;
}): string;
/** The surfaces this package captures from, with the words its items' origin and intent use. Never a path or a session id. */
export const SURFACE_LABELS: Readonly<Record<string, string>>;
export const CAPTURE_TRIGGERS: readonly string[];
export function captureIntentFor(surface: string): string;
export function sourceOriginFor(surface: string, date: Date): string;
