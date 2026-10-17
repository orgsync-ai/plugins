export type OrgSyncLook = { asOf: string; factsHash: string; boundaryEventIds: string[] };
export type OrgSyncPerson = { personId: string; label: string };
export type OrgSyncStatus = "reported_information" | "accepted_decision" | "disputed" | "superseded" | "withdrawn";
export type OrgSyncSupportContext = { objectiveId: string; title: string; revision: number; status: "active" | "completed" | "dropped"; linkedRevision: number };
export type OrgSyncItem = { id: string; section: "needs" | "changed" | "decisions" | "practices" | "focus" | "business" | "role"; title: string; details: string[]; supportsContext?: OrgSyncSupportContext | null };
export type OrgSyncChange = { eventId: string; at: string; line: string };
export type OrgSyncSource = { sourceId: string; revision: number; title: string; knowledgeStatus: OrgSyncStatus; acceptedBy: string | null };
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
  baseline: string | null;
  lease: { id: string; expires: number } | null;
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
};
declare module "claude-code" {
  interface PluginState { orgsync: { data: OrgSyncData } }
}
