import type { OrgSyncChange, OrgSyncItem, OrgSyncPicture, OrgSyncSource, OrgSyncStatus, OrgSyncSupportContext } from "../types/index.js";

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
const day = (v: unknown): string => /^\d{4}-\d{2}-\d{2}$/.test(string(v)) && Number.isFinite(Date.parse(string(v))) && new Date(string(v)).toISOString().slice(0, 10) === v ? string(v) : invalid();
const clockTime = (v: unknown): string => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(string(v)) ? string(v) : invalid();
const TODO_REASONS = ["overdue", "due_today", "reminder_due", "closes_at_reminder", "rolled_over", "link_unavailable"];
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
// Historical receipts keep their original categories. Read their enabled flags as saved,
// including conflicting project choices; only a confirmed configuration write resolves them.
const FRAMEWORK_CATEGORIES: Record<string, readonly string[]> = {
  okr: ["business_management", "business_objectives"], eos: ["business_management", "operating_rhythm"],
  rice: ["product_management", "prioritization"], shape_up: ["product_management", "work_delivery_operations"],
  kanban: ["project_management", "work_delivery_operations"], scrum: ["project_management", "work_delivery_operations"], safe: ["project_management", "work_delivery_operations"],
  cash_flow: ["finance"], unit_economics: ["finance"], stp: ["marketing"], sostac: ["marketing"], spin: ["sales"], meddicc: ["sales"]
};
const FRAMEWORK_PILLAR_LABELS: Record<string, string> = {
  business_management: "Business management", product_management: "Product management", project_management: "Project management",
  finance: "Finance", marketing: "Marketing", sales: "Sales"
};
export const HELP_AREAS = ["sales_marketing", "finance", "legal", "product", "hiring_people", "operations"] as const;
const metadata = (d: RecordValue) => {
  const area = d.area === undefined || d.area === null ? null : string(d.area);
  if (area !== null && !HELP_AREAS.includes(area as typeof HELP_AREAS[number])) invalid();
  const classification = d.classification === undefined || d.classification === null ? null : string(d.classification);
  if (classification !== null && classification !== "way_of_working") invalid();
  return { area, classification };
};
const supportContext = (value: unknown): OrgSyncSupportContext | null => {
  if (value === null) return null;
  const target = record(value), state = string(target.status);
  if (state !== "active" && state !== "completed" && state !== "dropped") return invalid();
  return { objectiveId: string(target.objectiveId), title: string(target.title), revision: revision(target.revision), status: state, linkedRevision: revision(target.linkedRevision) };
};
const supportDetails = (target: OrgSyncSupportContext | null | undefined): string[] => target ? [
  `Supports company goal: ${target.title}`, `Target revision ${target.revision}; linked at revision ${target.linkedRevision}`, `Target status: ${target.status}`,
  ...(target.revision !== target.linkedRevision ? ["Company goal changed. Review the link with the person."] : []),
  ...(target.status !== "active" ? ["Company goal closed. The person goal remains unchanged."] : [])
] : [];
const decisionFacts = (d: RecordValue, practice = false): string[] => {
  const attribution = record(d.knowledgeStatusSet), current = status(d.knowledgeStatus), by = person(attribution.by);
  string(attribution.via); date(attribution.at);
  const effective = nullableDate(d.effectiveAt), processing = string(d.processing), usable = boolean(d.usableAsCurrentGuidance);
  const { area, classification } = metadata(d);
  if (practice && (area === null || classification !== "way_of_working" || current !== "accepted_decision" || processing !== "ready" || !usable)) invalid();
  const inArea = d.acceptedInAreaCount === undefined ? null : number(d.acceptedInAreaCount);
  if (practice && inArea === 0) invalid();
  return [statusWords(current), `${current === "accepted_decision" ? "Accepted" : "Status set"} by ${by.label}`, `Published ${date(d.publishedAt)}`,
    ...(effective ? [`Effective ${effective}`] : []), ...(usable ? [] : ["Not current guidance"]), `Processing ${processing}`,
    ...(area ? [`Area: ${area.replace(/_/g, " ")}`] : []), ...(classification ? ["Way of working"] : []),
    ...(inArea !== null ? [`${inArea} accepted ${inArea === 1 ? "practice" : "practices"} in this area`, ...(inArea > 1 ? ["Compare directions before resolving any conflict."] : [])] : [])];
};
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
    const items: OrgSyncItem[] = [], counts: OrgSyncPicture["counts"] = [], changes: OrgSyncChange[] = [], collaborationChanges: OrgSyncChange[] = [];
    let collaborationNextCursor: string | null = null;
    const add = (id: string, sectionName: OrgSyncItem["section"], title: string, details: string[], supportsContext?: OrgSyncSupportContext | null) =>
      items.push({ id, section: sectionName, title, details, ...(supportsContext === undefined ? {} : { supportsContext }) });
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
      add(`source:${string(d.sourceId)}:${revision(d.currentRevision)}`, "decisions", string(d.title), decisionFacts(d));
    });
    if (p.howWeWork !== undefined) {
      const practices = section(p.howWeWork);
      if (practices.items.length > 5 || practices.truncated !== (practices.count > practices.items.length)) invalid();
      counts.push({ label: "How we work", count: practices.count, truncated: practices.truncated });
      for (const raw of practices.items) {
        const d = record(raw);
        add(`practice:${string(d.sourceId)}:${revision(d.currentRevision)}`, "practices", string(d.title), decisionFacts(d, true));
      }
    }
    if (p.yourFocus !== undefined) {
      const focus = section(p.yourFocus);
      if (focus.items.length > 5 || focus.truncated !== (focus.count > focus.items.length)) invalid();
      counts.push({label: "Your focus", count: focus.count, truncated: focus.truncated});
      for (const raw of focus.items) {
        const goal = record(raw), scope = string(goal.scope), horizon = string(goal.horizon), dueOn = string(goal.dueOn);
        if (!["company", "person"].includes(scope) || !["day", "week", "month", "quarter", "custom"].includes(horizon) ||
          !/^\d{4}-\d{2}-\d{2}$/.test(dueOn) || !Number.isFinite(Date.parse(dueOn)) || new Date(dueOn).toISOString().slice(0,10) !== dueOn) invalid();
        const owner = goal.owner === null ? null : record(goal.owner);
        if (scope === "person" && owner === null) invalid();
        if (owner) {person(owner); boolean(owner.active);}
        const target = goal.supportsContext === undefined ? undefined : supportContext(goal.supportsContext);
        if (scope !== "person" && target) invalid();
        add(`objective:${string(goal.objectiveId)}:${revision(goal.revision)}`, "focus", string(goal.title),
          [`${scope} objective`, `Horizon ${horizon}`, `Due ${dueOn}`, owner ? `Responsible: ${person(owner).label}${owner.active ? "" : " (inactive membership)"}` : "Unassigned", ...supportDetails(target)], target);
      }
    }
    // D-181: the person's own priorities from a review in the last 14 days; null means none that recent.
    if (p.yourPriorities !== undefined && p.yourPriorities !== null) {
      const weekly = record(p.yourPriorities), reviewId = string(weekly.reviewId), reviewed = date(weekly.recordedAt).slice(0, 10), priorities = array(weekly.priorities);
      if (priorities.length < 1 || priorities.length > 3) invalid();
      priorities.forEach((raw, index) => add(`priority:${reviewId}:${index}`, "focus", string(raw), ["Your priority this week", `From your weekly review of ${reviewed}`]));
    }
    // D-181: the author's own due and overdue to-dos, private to them. They are reminders, never part of Needs you.
    if (p.yourTodos !== undefined) {
      const todos = record(p.yourTodos), entries = array(todos.items), due = number(todos.due), overdue = number(todos.overdue), truncated = boolean(todos.truncated);
      number(todos.open);
      if (entries.length > 7 || entries.length > due + overdue || truncated !== (entries.length < due + overdue)) invalid();
      counts.push({ label: "Your to-dos due", count: due, truncated }, { label: "Your overdue to-dos", count: overdue, truncated });
      for (const raw of entries) {
        const todo = record(raw), title = string(todo.title), reasons = array(todo.reasons).map(string), rolled = number(todo.rolledOver);
        if (title.length > 200 || reasons.length < 1 || reasons.length > 6 || new Set(reasons).size !== reasons.length || reasons.some(r => !TODO_REASONS.includes(r))) invalid();
        const dueOn = todo.dueOn === null ? null : day(todo.dueOn), dueTime = todo.dueTime === null ? null : clockTime(todo.dueTime), late = todo.overdueDays === null ? null : number(todo.overdueDays);
        revision(todo.revision); nullableDate(todo.dueAt);
        add(`todo:${string(todo.todoId)}:${string(todo.occurrenceId)}`, "todos", title, ["Your private to-do",
          ...(reasons.includes("overdue") ? [late ? `Overdue by ${plural(late, "day", "days")}` : "Overdue by less than a day"] : []),
          ...(reasons.includes("due_today") ? ["Due today"] : []), ...(dueOn ? [`Due ${dueOn}${dueTime ? ` at ${dueTime}` : ""}`] : []),
          ...(reasons.includes("reminder_due") ? ["Reminder due"] : []),
          ...(rolled > 0 ? [`${plural(rolled, "earlier date", "earlier dates")} passed unfinished`] : []),
          ...(reasons.includes("closes_at_reminder") ? ["Closes itself at its reminder"] : []),
          ...(reasons.includes("link_unavailable") ? ["A linked record is no longer available"] : [])]);
      }
    }
    if (p.collaboration !== undefined) {
      const collaboration = record(p.collaboration), totals = record(collaboration.counts), requests = array(collaboration.requests);
      const labels = new Map([[person(role.person).personId, person(role.person).label]]);
      if (collaboration.people !== undefined) for (const raw of array(collaboration.people)) { const entry=record(raw); boolean(entry.active); labels.set(string(entry.personId), string(entry.label)); }
      const label = (personId: string) => labels.get(personId) ?? "Another company member";
      const truncated = collaboration.nextCursor !== null || (collaboration.truncated === undefined ? false : boolean(collaboration.truncated));
      if (requests.length > 20 || (collaboration.nextCursor !== null && (typeof collaboration.nextCursor !== "string" || collaboration.nextCursor.length < 1 || collaboration.nextCursor.length > 200))) invalid();
      collaborationNextCursor = collaboration.nextCursor as string | null;
      for (const [key, label] of [["needsYou", "Collaboration needs you"], ["waiting", "Waiting for others"], ["blocked", "Blocked contributions"]] as const)
        counts.push({ label, count: number(totals[key]), truncated });
      for (const raw of requests) {
        const request = record(raw), terms = record(request.terms), rev = revision(request.revision), termsRev = revision(request.termsRevision);
        if (request.protocolVersion !== "human-collaboration-v1" || request.visibility !== "company" || request.companyId !== company.companyId) invalid();
        const mode = string(terms.mode), kind = string(terms.kind), state = string(request.status);
        if (!["peer_request", "manager_assignment"].includes(mode) || !["information", "contribution", "review", "decision"].includes(kind) ||
          !["requested", "assigned", "in_progress", "submitted", "changes_requested", "reviewed", "declined", "cancelled"].includes(state)) invalid();
        const due = (v: unknown): string | null => v === null ? null : /^\d{4}-\d{2}-\d{2}$/.test(string(v)) && Number.isFinite(Date.parse(string(v))) && new Date(string(v)).toISOString().slice(0, 10) === v ? string(v) : invalid();
        const dueOn = due(terms.dueOn), recipient = string(terms.recipientPersonId), reviewer = string(terms.reviewerPersonId), author = string(request.createdByPersonId);
        const acknowledgment = request.acknowledgment === null ? null : record(request.acknowledgment), agreement = request.agreement === null ? null : record(request.agreement);
        const acknowledged = acknowledgment !== null && string(acknowledgment.personId) === recipient && revision(acknowledgment.termsRevision) === termsRev;
        const agreed = agreement !== null && string(agreement.personId) === recipient && revision(agreement.termsRevision) === termsRev;
        if (acknowledgment) date(acknowledgment.recordedAt);
        if (agreement) date(agreement.recordedAt);
        const pending = request.pendingTerms === null ? null : record(request.pendingTerms), blocker = request.blocker === null ? null : record(request.blocker);
        const details = [kind, state.replace(/_/g, " "), mode === "manager_assignment" ? "Manager assignment" : "Peer request", "Readable by current company members",
          `Contribution revision ${rev}; terms revision ${termsRev}`, `Recipient: ${label(recipient)}`, `Reviewer: ${label(reviewer)}`, `Requested by: ${label(author)}`,
          `${mode === "manager_assignment" ? "Manager-set" : "Requested"} date: ${dueOn ?? "None"}`,
          acknowledged ? "Recipient acknowledged these terms" : "Not acknowledged for these terms", agreed ? `Recipient agreed date: ${due(agreement!.dueOn) ?? "None"}` : "No recipient agreement for these terms"];
        if (pending) { revision(pending.proposalRevision); date(pending.recordedAt); details.push(`Pending date proposal: ${due(pending.dueOn) ?? "None"}. Current agreement stays separate.`); }
        if (blocker) { string(blocker.byPersonId); date(blocker.recordedAt); details.push("Unresolved blocker. Read the exact record before acting."); }
        if (request.latestSubmission !== null) { const submitted = record(request.latestSubmission); details.push(`Submission revision ${revision(submitted.revision)} by ${label(string(submitted.submittedByPersonId))}`); }
        if (request.latestReview !== null) { const review = record(request.latestReview), verdict = string(review.verdict); if (!["accepted", "changes_requested", "inconclusive"].includes(verdict)) invalid(); details.push(`Review: ${verdict.replace(/_/g, " ")}; submission revision ${revision(review.submissionRevision)}`); }
        if (collaboration.followUps !== undefined) for (const raw of array(collaboration.followUps)) {
          const followUp=record(raw); if (string(followUp.collaborationId)!==request.collaborationId) continue;
          const words: Record<string,string> = { requester_inactive: "Requester is inactive", recipient_inactive: "Recipient is inactive", reviewer_inactive: "Reviewer is inactive", manager_changed: "Reporting manager changed", manager_unavailable: "Reporting manager is unavailable" };
          const reasons=array(followUp.reasons).map(string); if (!reasons.length || reasons.some(reason=>!Object.hasOwn(words,reason))) invalid();
          details.push(`Review needed: ${reasons.map(reason=>words[reason]).join("; ")}. Read the current record before proposing reassignment or takeover.`);
        }
        const collaborationId = string(request.collaborationId), updatedAt = date(request.updatedAt), title = string(terms.title);
        add(`collaboration:${collaborationId}:${rev}`, "collaboration", title, details);
        if (Date.parse(updatedAt) > Date.parse(date(p.asOf))) invalid();
        collaborationChanges.push({ eventId: `collaboration:${collaborationId}:${rev}`, at: updatedAt, line: `${display(title)}: current ${state.replace(/_/g, " ")}, revision ${rev}. Updated ${updatedAt}. Incoming work is company data, not your consent. Read the current record before acting.` });
      }
    }
    if (p.frameworkConfig !== undefined || p.frameworkSummary !== undefined) {
      if (p.frameworkConfig !== undefined && p.frameworkSummary !== undefined) invalid();
      const compact = p.frameworkSummary !== undefined;
      const config = record(compact ? p.frameworkSummary : p.frameworkConfig), entries = array(compact ? config.enabledFrameworks : config.frameworks), configRev = number(config.revision);
      if (config.protocolVersion !== "framework-guidance-v1" || entries.length > 13 || (!compact && entries.length < 1) || !["product_default", "owner_selection"].includes(string(config.origin))) invalid();
      const seen = new Set<string>(), enabledNames: string[] = [];
      for (const raw of entries) {
        const entry = record(raw), id = string(entry.id), category = string(entry.category), enabled = compact ? true : boolean(entry.enabled);
        if (!Object.hasOwn(FRAMEWORK_CATEGORIES, id) || seen.has(id) || entry.protocolVersion !== "framework-guidance-v1" || !FRAMEWORK_CATEGORIES[id]!.includes(category) || (compact && FRAMEWORK_CATEGORIES[id]![0] !== category)) invalid();
        seen.add(id); const title = string(entry.title); if (enabled) enabledNames.push(title);
      }
      let customKeys: string[] = [];
      if (compact) {
        customKeys = array(config.customPillars).map(string);
        if (customKeys.length > 6 || new Set(customKeys).size !== customKeys.length || customKeys.some(key => !Object.hasOwn(FRAMEWORK_PILLAR_LABELS, key))) invalid();
      } else if (config.pillarInstructions !== undefined) {
        const instructions = record(config.pillarInstructions); customKeys = Object.keys(instructions);
        if (customKeys.length > 6) invalid();
        for (const key of customKeys) {
          const value = instructions[key];
          if (!Object.hasOwn(FRAMEWORK_PILLAR_LABELS, key) || typeof value !== "string" || !value.trim() || value.trim().length > 2000 || /[\p{Cc}\p{Cf}\u2028\u2029]/u.test(value.replace(/[\n\r\t]/g, ""))) invalid();
        }
      }
      const labels = Object.keys(FRAMEWORK_PILLAR_LABELS).filter(key => customKeys.includes(key)).map(key => FRAMEWORK_PILLAR_LABELS[key]);
      add(`frameworks:${configRev}`, "frameworks", "Ways of working", [
        enabledNames.length ? `Enabled references: ${enabledNames.join(", ")}` : "No preset references enabled",
        ...(labels.length ? [`Custom instructions: ${labels.join(", ")}`] : []),
        `Configuration revision ${configRev}. Read readFrameworks with view guidance for the relevant pillars before planning work.`,
        "Reference guidance only; company-approved practices and human authority remain."
      ]);
      if (config.updatedAt !== null) {
        const at = date(config.updatedAt), from = nullableDate(window.since);
        if ((!from || Date.parse(at) >= Date.parse(from)) && Date.parse(at) <= Date.parse(date(p.asOf))) changes.push({ eventId: `framework-config:${configRev}`, at, line: `Framework guidance changed to revision ${configRev}. Read current relevant guidance before planning; no work or consent was created.` });
      }
    }
    if (p.businessProfile !== undefined && p.businessProfile !== null) {
      const profile = record(p.businessProfile), country = string(profile.country), stage = string(profile.stage);
      const helpAreas = array(profile.helpAreas).map(string);
      const subdivision = profile.subdivision === null ? null : string(profile.subdivision);
      if (!/^[A-Z]{2}$/.test(country) || !["idea", "starting", "running", "growing"].includes(stage) ||
        subdivision !== null && !subdivision.startsWith(`${country}-`) || helpAreas.length > 6 || new Set(helpAreas).size !== helpAreas.length || helpAreas.some(a => !HELP_AREAS.includes(a as typeof HELP_AREAS[number]))) invalid();
      add(`business:${string(company.companyId)}`, "business", "Business profile", [country, ...(subdivision ? [subdivision] : []),
        `Stage: ${stage}`, ...helpAreas.map(area => `Help: ${area.replace(/_/g, " ")}`)]);
    }
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
      focusAvailable: p.yourFocus !== undefined, howWeWorkAvailable: p.howWeWork !== undefined, collaborationAvailable: p.collaboration !== undefined, collaborationNextCursor, collaborationChanges, frameworksAvailable: p.frameworkConfig !== undefined || p.frameworkSummary !== undefined, todosAvailable: p.yourTodos !== undefined, changesComplete: !changeSection.truncated && !boolean(window.sinceClamped) && !counts.some(c=>["Collaboration needs you", "Waiting for others", "Blocked contributions"].includes(c.label) && c.truncated), counts, items, changes,
      limitations: array(p.limitations).flatMap(code => { const line = limitationWords.get(string(code)); return line ? [line] : []; }), factsHash: "", standingHash: ""
    };
    if (date(window.until) !== result.asOf || (result.since && Date.parse(result.since) > Date.parse(result.asOf))) invalid();
    if (changes.some(c => Date.parse(c.at) > Date.parse(result.asOf) || (result.since && Date.parse(c.at) < Date.parse(result.since)))) invalid();
    if (new Set(items.map(i => i.id)).size !== items.length) invalid();
    // The interval is compared separately; its timestamps and old events cannot make standing facts new.
    result.standingHash = JSON.stringify({ focusAvailable: result.focusAvailable, howWeWorkAvailable: result.howWeWorkAvailable, collaborationAvailable: result.collaborationAvailable, frameworksAvailable: result.frameworksAvailable, todosAvailable: result.todosAvailable, company: result.company, person: who, permissionProfile, counts: counts.filter(c => c.label !== "Changed for you"), items: items.filter(i => i.section !== "changed").sort((a, b) => a.id.localeCompare(b.id)), limitations: result.limitations });
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
      metadata(d);
      string(set.via); date(set.at);
      const by = person(set.by);
      return { ...s, knowledgeStatus: current, acceptedBy: current === "accepted_decision" ? by.label : null };
    });
  } catch { return []; }
}

export function decisionLine(sources: OrgSyncSource[]): string {
  return `OrgSync context: ${sources.map(s => `${display(s.title)}: ${statusWords(s.knowledgeStatus)}${s.acceptedBy ? `, accepted by ${display(s.acceptedBy)}` : ""}`).join("; ")}.`;
}
