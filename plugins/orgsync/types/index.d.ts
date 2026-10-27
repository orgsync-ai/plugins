export type OrgSyncLook = { asOf: string; factsHash: string; boundaryEventIds: string[] };
export type OrgSyncPerson = { personId: string; label: string };
export type OrgSyncStatus = "reported_information" | "accepted_decision" | "disputed" | "superseded" | "withdrawn";
export type OrgSyncSupportContext = { objectiveId: string; title: string; revision: number; status: "active" | "completed" | "dropped"; linkedRevision: number };
export type OrgSyncItem = { id: string; section: "needs" | "todos" | "changed" | "decisions" | "practices" | "focus" | "collaboration" | "frameworks" | "business" | "role"; title: string; details: string[]; supportsContext?: OrgSyncSupportContext | null };
export type OrgSyncChange = { eventId: string; at: string; line: string };
export type OrgSyncSource = { sourceId: string; revision: number; title: string; knowledgeStatus: OrgSyncStatus; acceptedBy: string | null };
/** D-195: the person's own capture state and queue counts from the picture; absent from a server without capture, never "off". */
export type OrgSyncCaptureState = { company: "on" | "off"; you: "on" | "off" | "paused" | "needs_notice" | "unavailable"; pausedUntil: string | null; queued: number; expiringSoon: number };
export type OrgSyncPicture = {
  company: { companyId: string; name: string };
  person: OrgSyncPerson;
  permissionProfile: "owner" | "decision_approver" | "member";
  asOf: string;
  since: string | null;
  sinceClamped: boolean;
  changesComplete: boolean;
  focusAvailable?: boolean;
  howWeWorkAvailable?: boolean;
  collaborationAvailable?: boolean;
  collaborationNextCursor?: string | null;
  collaborationChanges?: OrgSyncChange[];
  frameworksAvailable?: boolean;
  /** D-181: the author's own due and overdue to-dos. Absent means unavailable on this connection, never none. */
  todosAvailable?: boolean;
  capture?: OrgSyncCaptureState;
  counts: { label: string; count: number; truncated: boolean }[];
  items: OrgSyncItem[];
  changes: OrgSyncChange[];
  limitations: string[];
  factsHash: string;
  standingHash: string;
};
export type OrgSyncSentence = { text: string; itemIds: string[] };
export type OrgSyncBrief = { key: string; sentences: OrgSyncSentence[] };
export type OrgSyncLock = { token: string; expires: number };
export type OrgSyncRuntime = {
  sessionId: string;
  generation: number;
  server: string | null;
  tools: Record<string, string>;
  phase: "idle" | "loading" | "ready" | "unavailable";
  stopped: boolean;
  lastAttempt: number | null;
  nextAttempt: number;
  failures: number;
  pollSince: string | null;
  collaborationCursor: string | null;
  collaborationCursorHistory: string[];
  baseline: string | null;
  lease: { id: string; expires: number } | null;
};
/** B1 steering, for this session only: the hint budget, and the facts (numbers, units, nearby words, never text) of sources
 * already read in this conversation. */
export type OrgSyncSteering = {
  /** `off` is the off-the-record marker: set by the person's own words, it silences every hint for the session. `captureOff` is
   * the same marker for capture (D-195), and sticky: "back on the record" clears `off` only. */
  ledger: { turnId: string | null; turnHints: number; sessionHints: number; hinted: string[]; overridden: string[]; last: { kind: string; decisions: string[] } | null; off?: boolean; captureOff?: boolean; forgets?: number };
  /** Counts the person's prompts, so a turn runs from one prompt to the next. */
  turn: number;
  learned: Record<string, { value: number; unit: string; limit: "min" | "max" | null; anchors: string[] }[]>;
  digested: boolean;
  /** The picture's standing facts when the decision index was last read; a change reads it again. */
  indexFacts: string | null;
};
/** D-195 capture in this session. It holds no conversation text: the session's digest, the sticky off-the-record mark, how far
 * the redacted text has been read (its length and a SHA-256 of it), and the latest state OrgSync's `status` gave. */
export type OrgSyncCapture = {
  session: string | null;
  off: boolean;
  mark: { length: number; hash: string } | null;
  running: OrgSyncLock | null;
  /** Prompts sent when the idle wait began; capture runs at the end of the wait only if no prompt came since. */
  idleTurns: number | null;
  /** How many of the person's requests to forget this session (the steering ledger's `forgets`) the mod has carried out. */
  forgotten?: number;
  you: OrgSyncCaptureState["you"] | null;
};
export type OrgSyncData = {
  runtime: OrgSyncRuntime | null;
  picture: OrgSyncPicture | null;
  briefs: OrgSyncBrief[];
  brief: OrgSyncSentence[];
  briefFacts: string | null;
  bandVisible: boolean;
  injected: boolean;
  injecting: OrgSyncLock | null;
  briefing: OrgSyncLock | null;
  pending: OrgSyncChange[];
  delivering: OrgSyncLock & { ids: string[] } | null;
  delivered: string[];
  memory: { path: string; toolUseId: string } | null;
  offeredPaths: string[];
  turn: { id: string; sources: OrgSyncSource[]; notified: string | null } | null;
  lastDecisionLine: string | null;
  steering?: OrgSyncSteering;
  capture?: OrgSyncCapture;
};
declare module "claude-code" {
  interface PluginState { orgsync: { data: OrgSyncData } }
}
