/** `cs1_` + SHA-256 hex of `orgsync-capture-session:v1:` and the client's session id. @param {string} clientSessionId */
export function captureSession(clientSessionId: string): string;
/** `cap1:` + SHA-256 hex of the session, the title and the summary, so a retry of the same item is the same draft.
 * Pass the title and summary exactly as they are submitted. @param {string} session @param {{ title: string, summary: string }} item */
export function captureIdempotencyKey(session: string, item: {
    title: string;
    summary: string;
}): string;
export const CAPTURE_SESSION_PREFIX: "orgsync-capture-session:v1:";
export function isCaptureSession(value: unknown): boolean;
