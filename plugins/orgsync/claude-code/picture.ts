import type { OrgSyncChange, OrgSyncItem, OrgSyncPicture, OrgSyncSource, OrgSyncStatus } from "../types/index.js";

type RecordValue = Record<string, unknown>;
const invalid = (): never => { throw new Error("unavailable"); };
const record = (v: unknown): RecordValue => v !== null && typeof v === "object" && !Array.isArray(v) ? v as RecordValue : invalid();
const string = (v: unknown): string => typeof v === "string" && v.length > 0 && v.length <= 8192 ? v : invalid();
const number = (v: unknown): number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0 ? v : invalid();
const revision = (v: unknown): number => number(v) > 0 ? number(v) : invalid();
const boolean = (v: unknown): boolean => typeof v === "boolean" ? v : invalid();
const array = (v: unknown): unknown[] => Array.isArray(v) && v.length <= 500 ? v : invalid();
const date = (v: unknown): string => /^\d{4}-\d\d-\d\dT/.test(string(v)) && Number.isFinite(Date.parse(string(v))) ? string(v) : invalid();
const nullableDate = (v: unknown): string | null => v === null ? null : date(v);
const person = (v: unknown) => { const p = record(v); return { personId: string(p.personId), label: string(p.label) }; };
const statuses = ["reported_information", "accepted_decision", "disputed", "superseded", "withdrawn"] as const;
const status = (v: unknown): OrgSyncStatus => statuses.includes(v as OrgSyncStatus) ? v as OrgSyncStatus : invalid();
export const statusWords = (v: OrgSyncStatus): string => ({ reported_information: "reported information", accepted_decision: "accepted decision", disputed: "disputed", superseded: "superseded", withdrawn: "withdrawn" })[v];
export const display = (v: string): string => v.replace(/[\x00-\x1f\x7f-\x9f]/g, " ");
const dateFormat = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const shortDate = (value: string): string => dateFormat.format(new Date(value));
export const readable = (value: string): string => display(value).replace(/\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})\b/g, time => Number.isFinite(Date.parse(time)) ? shortDate(time) : time);
const source = (v: unknown) => { const s = record(v); return { sourceId: string(s.sourceId), revision: revision(s.revision), title: string(s.title) }; };
const section = (v: unknown) => {
  const s = record(v), items = array(s.items), count = number(s.count), truncated = boolean(s.truncated);
  if (count < items.length || (!truncated && count !== items.length)) invalid();
  return { count, items, truncated };
};
const limitationWords = new Map([
  ["drafts_require_submit_scope", "This connection cannot show your private drafts."],
  ["work_profile_missing", "Your work profile has not been set."],
  ["lookback_clamped", "Changes cover only the past 30 days."],
  ["deletion_titles_withheld", "Deleted source titles are hidden."],
  ["deletion_actor_unavailable", "Who deleted a source is unavailable."]
]);

// Structured content wins, including a refusal. Never rescue it with a second, contradictory body.
export function toolBody(value: unknown, allowError = false): RecordValue | null {
  try {
    const result = record(value);
    if (result.isError === true && !allowError) return null;
    if (result.structuredContent !== undefined) return record(result.structuredContent);
    const blocks = array(result.content).map(record).filter(b => b.type === "text");
    if (blocks.length !== 1) return null;
    const text = blocks[0]?.text;
    if (typeof text !== "string" || text.length > 262144) return null;
    return record(JSON.parse(text));
  } catch { return null; }
}

export function refusalStopsReads(value: unknown): boolean {
  const body = toolBody(value, true);
  if (!body) return false;
  if (body.status === "denied") return true;
  return typeof body.code === "string" && /auth|revok|expir|permission|authority|scope|membership|connection|credential|access|forbidden|unauthorized|consent|policy/i.test(body.code);
}

export function parsePicture(value: unknown): OrgSyncPicture | null {
  try {
    const p = toolBody(value);
    if (!p || p.status !== "picture") return null;
    string(p.requestId);
    const company = record(p.company), role = record(p.yourRole), window = record(p.window), needs = record(p.needsYou);
    const permissionProfile = role.permissionProfile;
    if (permissionProfile !== "owner" && permissionProfile !== "decision_approver" && permissionProfile !== "member") return null;
    const items: OrgSyncItem[] = [], counts: OrgSyncPicture["counts"] = [], changes: OrgSyncChange[] = [];
    const add = (id: string, sectionName: OrgSyncItem["section"], title: string, details: string[]) => items.push({ id, section: sectionName, title, details });
    const readSection = (raw: unknown, label: string, key: string, visit: (v: RecordValue) => void) => {
      const s = section(raw); counts.push({ label, count: s.count, truncated: s.truncated });
      for (const item of s.items) if (item !== null && typeof item === "object" && !Array.isArray(item) && key in item) visit(record(item));
      return s;
    };
    if (needs.pendingDrafts !== null) readSection(needs.pendingDrafts, "Pending drafts", "draftId", d => {
      const rev = revision(d.revision); date(d.createdAt);
      add(`draft:${string(d.draftId)}:${rev}`, "needs", string(d.title), [`Private draft revision ${rev}`, `Updated ${date(d.updatedAt)}`, `Expires ${date(d.expiresAt)}`]);
    });
    if (needs.approver !== null) {
      const a = record(needs.approver);
      if (permissionProfile === "member") invalid();
      readSection(a.awaitingProposals, "Proposals awaiting you", "proposalId", v => {
        const s = source(v.source);
        add(`proposal:${string(v.proposalId)}:${revision(v.revision)}`, "needs", s.title, [`Correction proposed by ${person(v.proposedBy).label}`, `Shared ${date(v.sharedAt)}`]);
      });
      readSection(a.recentProblemReports, "Recent problem reports", "reportId", v => {
        const s = source(v.source);
        add(`report:${string(v.reportId)}`, "needs", s.title, [`${string(v.issueType).replace(/_/g, " ")} reported by ${person(v.reportedBy).label}`, `Reported ${date(v.reportedAt)}`]);
      });
      // An older server sends no such section, and its absence is not a malformed picture.
      if (a.recentSharedSources !== undefined) readSection(a.recentSharedSources, "Newly shared reported information", "sharedBy", v => {
        const s = source(v.source);
        add(`shared:${s.sourceId}:${s.revision}`, "needs", s.title, [`Shared by ${person(v.sharedBy).label} as reported information`, "Not yet accepted as a company decision", `Shared ${date(v.sharedAt)}`]);
      });
    }
    readSection(needs.ownDecidedProposals, "Your decided proposals", "proposalId", v => {
      const s = source(v.source);
      if (v.outcome !== "accepted" && v.outcome !== "rejected") invalid();
      if (v.acceptedRevision !== null) revision(v.acceptedRevision);
      add(`proposal:${string(v.proposalId)}:${revision(v.revision)}`, "needs", s.title, [`${v.outcome} by ${person(v.by).label}`, `Decided ${date(v.at)}`]);
    });
    const changeSection = readSection(p.changedForYou, "Changed for you", "kind", v => {
      if (!["source_published", "status_changed", "correction_accepted", "source_deleted"].includes(v.kind as string)) return;
      const eventId = string(v.eventId), at = date(v.at), kind = string(v.kind);
      let title: string, details: string[] = [];
      if (kind === "source_deleted") {
        if (v.source !== null) invalid();
        title = "A source was deleted";
        details = [v.by === null ? "Deleted" : `Deleted by ${person(v.by).label}`, at];
      } else {
        const s = source(v.source), by = person(v.by), current = status(v.knowledgeStatus);
        title = s.title;
        if (kind === "source_published") details = [`Published by ${by.label}`, statusWords(current), at];
        else if (kind === "status_changed") details = [`${statusWords(status(v.previousKnowledgeStatus))} to ${statusWords(current)}`, `Changed by ${by.label}`, at];
        else if (kind === "correction_accepted") {
          revision(v.previousRevision); status(v.previousRevisionStatus);
          details = [v.proposedBy === null ? `Correction accepted by ${by.label}` : `Correction proposed by ${person(v.proposedBy).label}, accepted by ${by.label}`, statusWords(current), at];
        } else invalid();
        if (kind !== "source_published") { const effective = nullableDate(v.effectiveAt); if (effective) details.push(`Effective ${effective}`); }
      }
      add(`event:${eventId}`, "changed", title, details);
      changes.push({ eventId, at, line: `${display(title)}: ${details.map(display).join("; ")}. Re-check before relying on it.` });
    });
    const decisions = record(p.decisionsThatShapeYourWork);
    if (decisions.ordering !== "first_published_desc") invalid();
    readSection(decisions.page, "Decisions that shape your work", "sourceId", d => {
      const attribution = record(d.knowledgeStatusSet), current = status(d.knowledgeStatus), by = person(attribution.by);
      string(attribution.via); date(attribution.at);
      const effective = nullableDate(d.effectiveAt), processing = string(d.processing), usable = boolean(d.usableAsCurrentGuidance);
      add(`source:${string(d.sourceId)}:${revision(d.currentRevision)}`, "decisions", string(d.title), [statusWords(current), `${current === "accepted_decision" ? "Accepted" : "Status set"} by ${by.label}`, `Published ${date(d.publishedAt)}`, ...(effective ? [`Effective ${effective}`] : []), ...(usable ? [] : ["Not current guidance"]), `Processing ${processing}`]);
    });
    const who = person(role.person);
    const details = [permissionProfile.replace(/_/g, " ")];
    if (role.workProfile !== null) {
      const work = record(role.workProfile);
      if (work.title !== null && work.title !== "") details.push(string(work.title));
      details.push(...array(work.responsibilities).map(string));
    }
    add(`person:${who.personId}`, "role", who.label, details);
    const result: OrgSyncPicture = {
      company: { companyId: string(company.companyId), name: string(company.name) }, person: who, permissionProfile,
      asOf: date(p.asOf), since: nullableDate(window.since), sinceClamped: boolean(window.sinceClamped),
      changesComplete: !changeSection.truncated && !boolean(window.sinceClamped), counts, items, changes,
      limitations: array(p.limitations).flatMap(code => { const line = limitationWords.get(string(code)); return line ? [line] : []; }), factsHash: "", standingHash: ""
    };
    if (date(window.until) !== result.asOf || (result.since && Date.parse(result.since) > Date.parse(result.asOf))) invalid();
    if (changes.some(c => Date.parse(c.at) > Date.parse(result.asOf) || (result.since && Date.parse(c.at) < Date.parse(result.since)))) invalid();
    if (new Set(items.map(i => i.id)).size !== items.length) invalid();
    // The interval is compared separately; its timestamps and old events cannot make standing facts new.
    result.standingHash = JSON.stringify({ company: result.company, person: who, permissionProfile, counts: counts.filter(c => c.label !== "Changed for you"), items: items.filter(i => i.section !== "changed").sort((a, b) => a.id.localeCompare(b.id)), limitations: result.limitations });
    result.factsHash = JSON.stringify({ standing: result.standingHash, counts: counts.filter(c => c.label === "Changed for you"), changes: items.filter(i => i.section === "changed").sort((a, b) => a.id.localeCompare(b.id)) });
    return result;
  } catch { return null; }
}

export function lookKey(p: OrgSyncPicture): string { return `look:v1:${encodeURIComponent(p.company.companyId)}:${encodeURIComponent(p.person.personId)}`; }
export function sameSubject(a: OrgSyncPicture, b: OrgSyncPicture): boolean { return a.company.companyId === b.company.companyId && a.person.personId === b.person.personId; }

export function mapTools(server: string, tools: { name: string; mcp: boolean }[]): Record<string, string> {
  const result: Record<string, string> = {};
  const aliases = new Set([server, server.replace(/[^a-zA-Z0-9_-]/g, "_")]);
  for (const tool of ["readPermittedContext", "readSource"]) {
    const matches = tools.filter(t => t.mcp && [...aliases].some(alias => t.name === `mcp__${alias}__${tool}`));
    if (matches.length === 1) result[matches[0]!.name] = tool;
  }
  return result;
}

export function parseSources(value: unknown, tool: string): OrgSyncSource[] {
  try {
    const body = toolBody(value);
    if (!body || (tool === "readSource" ? body.status !== "source" : body.status !== "success" && body.status !== "conflict")) return [];
    const values = tool === "readSource" ? [body] : array(body.sources);
    return values.map(v => {
      const s = source(v), d = record(v), current = status(d.knowledgeStatus), set = record(d.knowledgeStatusSet);
      string(set.via); date(set.at);
      const by = person(set.by);
      return { ...s, knowledgeStatus: current, acceptedBy: current === "accepted_decision" ? by.label : null };
    });
  } catch { return []; }
}

export function decisionLine(sources: OrgSyncSource[]): string {
  return `OrgSync context: ${sources.map(s => `${display(s.title)}: ${statusWords(s.knowledgeStatus)}${s.acceptedBy ? `, accepted by ${display(s.acceptedBy)}` : ""}`).join("; ")}.`;
}
