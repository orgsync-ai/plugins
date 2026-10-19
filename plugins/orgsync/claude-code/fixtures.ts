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
export const focusFixture = () => ({count:7,truncated:true,items:[{objectiveId:"objective-a",revision:1,scope:"company",title:"First five conversations",
  horizon:"week",dueOn:"2026-10-21",owner:{...PERSON,active:true}}]});

export const practiceFixture = () => ({ ...pictureFixture().decisionsThatShapeYourWork.page.items[0]!,
  sourceId: "source-practice", title: "Review customer conversations weekly", area: "sales_marketing", classification: "way_of_working", acceptedInAreaCount: 2 });
export const supportContextFixture = () => ({ objectiveId: "company-goal", title: "Win five customers", revision: 3, status: "active", linkedRevision: 2 });

export const collaborationFixture = () => ({ collaborationId: "contribution-a", companyId: "company-a", protocolVersion: "human-collaboration-v1", visibility: "company",
  revision: 1, termsRevision: 1, terms: { kind: "contribution", mode: "manager_assignment", title: "Interview evidence", purpose: "HIDDEN REQUEST PURPOSE", expectedResponse: "HIDDEN RESPONSE INSTRUCTIONS",
    criteria: "HIDDEN CRITERIA", recipientPersonId: "person-a", reviewerPersonId: "person-b", dueOn: "2026-10-23", objective: { objectiveId: "goal-a", revision: 2 }, sourceReferences: [] },
  status: "assigned", createdByPersonId: "person-b", responsibleManagerPersonId: "person-b", assignmentChain: [{ personId: "person-a", managerPersonId: "person-b", profileRevision: 1, membershipEpoch: 0 }],
  acknowledgment: null, agreement: null, pendingTerms: null, blocker: null, latestSubmission: null, latestReview: null,
  startedAt: null, completedAt: null, createdAt: AS_OF, updatedAt: AS_OF });
export const legacyFrameworkConfigFixture = () => ({ revision: 0, protocolVersion: "framework-guidance-v1", origin: "product_default", updatedAt: null, updatedBy: null, frameworks: [
  { id: "okr", category: "business_objectives", title: "OKR", protocolVersion: "framework-guidance-v1", purpose: "HIDDEN GUIDANCE", enabled: true },
  { id: "kanban", category: "work_delivery_operations", title: "Kanban", protocolVersion: "framework-guidance-v1", purpose: "HIDDEN GUIDANCE", enabled: false }
] });
export const frameworkConfigFixture = () => ({ revision: 0, protocolVersion: "framework-guidance-v1", origin: "product_default", updatedAt: null, updatedBy: null, frameworks: [
  ["okr", "business_management", "OKR"], ["eos", "business_management", "EOS"],
  ["rice", "product_management", "RICE"], ["shape_up", "product_management", "Shape Up"],
  ["kanban", "project_management", "Kanban"], ["scrum", "project_management", "Scrum"], ["safe", "project_management", "SAFe"],
  ["cash_flow", "finance", "Cash flow"], ["unit_economics", "finance", "Unit economics"],
  ["stp", "marketing", "STP"], ["sostac", "marketing", "SOSTAC"], ["spin", "sales", "SPIN"], ["meddicc", "sales", "MEDDICC"]
].map(([id, category, title]) => ({ id, category, title, protocolVersion: "framework-guidance-v1", purpose: "HIDDEN GUIDANCE", fit: "HIDDEN FIT", guidance: ["HIDDEN DIRECTIONS"], enabled: id === "okr" })) });
export const pillarInstructionsFixture = () => Object.fromEntries(["business_management", "product_management", "project_management", "finance", "marketing", "sales"]
  .map(key => [key, `HIDDEN CUSTOM INSTRUCTION ${key}: `.padEnd(2000, "x")]));

export function frameworkSummaryFixture() {
  const { revision, protocolVersion, origin, updatedAt, updatedBy, frameworks } = frameworkConfigFixture();
  return { revision, protocolVersion, origin, updatedAt, updatedBy,
    enabledFrameworks: frameworks.filter(entry => entry.enabled).map(({ id, title, category, protocolVersion }) => ({ id, title, category, protocolVersion })), customPillars: [] as string[] };
}
