export const AS_OF = "2026-10-11T12:00:00.000Z";
export const BEFORE = "2026-10-11T11:00:00.000Z";
export const PERSON = { personId: "person-a", label: "Sam" };
export const SOURCE = { sourceId: "source-a", revision: 2, title: "Refund approvals" };
export function pictureFixture() {
  return {
    status: "picture", requestId: "request-a", company: { companyId: "company-a", name: "Acorn" }, asOf: AS_OF,
    window: { since: null as string | null, until: AS_OF, sinceClamped: false },
    yourRole: { person: { ...PERSON }, permissionProfile: "owner", workProfile: { title: "Support lead", description: "HIDDEN DESCRIPTION", responsibilities: ["Refund reviews"], roleObjectives: null, managerPersonId: null, assigningActorId: null, revision: 1, updatedAt: BEFORE } },
    needsYou: {
      pendingDrafts: { count: 1, items: [{ draftId: "draft-a", title: "Support hours", revision: 1, createdAt: BEFORE, updatedAt: BEFORE, expiresAt: "2026-10-12T12:00:00.000Z" }], truncated: false },
      approver: { awaitingProposals: { count: 1, items: [{ proposalId: "proposal-a", revision: 1, source: { ...SOURCE }, proposedBy: { ...PERSON }, sharedAt: BEFORE }], truncated: false }, recentProblemReports: { count: 0, items: [], truncated: false } },
      ownDecidedProposals: { count: 0, items: [], truncated: false }
    },
    changedForYou: { count: 0, items: [] as unknown[], truncated: false },
    decisionsThatShapeYourWork: { ordering: "first_published_desc", page: { count: 1, items: [{ sourceId: SOURCE.sourceId, title: SOURCE.title, currentRevision: 2, knowledgeStatus: "accepted_decision", knowledgeStatusSet: { via: "status_change", by: { ...PERSON }, at: BEFORE }, effectiveAt: null, publishedAt: BEFORE, processing: "ready", usableAsCurrentGuidance: true }], truncated: false } },
    limitations: [] as string[]
  };
}
export const wire = (structuredContent: unknown) => ({ isError: false, content: [], structuredContent });
export const jsonWire = (body: unknown) => ({ isError: false, content: [{ type: "text", text: JSON.stringify(body) }] });
export const changed = (eventId = "event-a", at = AS_OF) => ({ kind: "status_changed", eventId, at, by: { ...PERSON }, source: { ...SOURCE }, previousKnowledgeStatus: "accepted_decision", knowledgeStatus: "disputed", effectiveAt: null });
export const sourceFixture = () => ({ status: "source", ...SOURCE, knowledgeStatus: "accepted_decision", knowledgeStatusSet: { via: "status_change", by: { ...PERSON }, at: BEFORE } });
