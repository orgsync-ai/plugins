// @ts-check
// D-195 capture: the session value a captured item carries, and its idempotency key. OrgSync never learns the client's own
// session id: only `cs1_` + SHA-256 of a fixed prefix and that id reaches it, and the server stores a second digest by person.
import { sha256Hex } from "./sha256.js";

export const CAPTURE_SESSION_PREFIX = "orgsync-capture-session:v1:";
/** The contract's longest opaque id (`CONTRACT_LIMITS.maxOpaqueIdChars`). */
const MAX_ID_CHARS = 200;

/** `cs1_` + SHA-256 hex of `orgsync-capture-session:v1:` and the client's session id. @param {string} clientSessionId */
export function captureSession(clientSessionId) {
  if (typeof clientSessionId !== "string" || !clientSessionId) throw new TypeError("capture_session_id_required");
  return `cs1_${sha256Hex(`${CAPTURE_SESSION_PREFIX}${clientSessionId}`)}`;
}

/** Whether a value has the shape the contract accepts for `capture.session`. @param {unknown} value */
export const isCaptureSession = value => typeof value === "string" && /^cs1_[a-f0-9]{64}$/.test(value);

/** `cap1:` + SHA-256 hex of the session, the title and the summary, so a retry of the same item is the same draft.
 * Pass the title and summary exactly as they are submitted. @param {string} session @param {{ title: string, summary: string }} item */
export function captureIdempotencyKey(session, item) {
  return `cap1:${sha256Hex(`${session}\n${item.title}\n${item.summary}`)}`.slice(0, MAX_ID_CHARS);
}
