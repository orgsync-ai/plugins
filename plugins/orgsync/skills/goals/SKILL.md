---
name: goals
description: Set or revisit company and person objectives in OrgSync, with success criteria, a responsible person and a date.
argument-hint: "[goal or result to review]"
disable-model-invocation: true
---

Help the person set or revisit their objectives. Start with what they asked: $ARGUMENTS

1. Call `status`, `readPicture` and `listObjectives`. Reads are free. Use `view: "closed"` for completed or dropped objectives, and pass `nextCursor` as `cursor` for more. An absent `yourFocus` means unavailable, not zero objectives. Full `successCriteria` come from the list.
2. For a new goal, ask what result they want, what observable evidence would count as success, who is responsible, and the timeframe. Agree a specific `dueOn` calendar date and a `horizon` of `day`, `week` or `month`. Never invent criteria, a responsible person or a date. Work-profile `roleObjectives` is descriptive text, separate from these objectives.
3. Explain that every current company member and their connected AI clients can read objectives and their history. An Owner or Decision approver may change any objective and assign an active member. A Member may change only person objectives they own. Responsibility gives no permission. Company objectives may be unassigned; person objectives require an owner. Scope stays fixed. A revoked owner stays attributed as inactive until an approver reassigns them.
4. Call `setObjective` when the person wants to save. Use a fresh `idempotencyKey` for each intended change, repeated only to retry it. Creation uses `operation: "create"`, a fresh `objectiveId`, `expectedRevision: 0`, `scope` and the complete editable `objective`. Replacement uses `operation: "replace"`, the listed revision and every editable field. Supply the person's `reason`.
   - On a prompt connection, only the person answers OrgSync's form. You never answer it.
   - On a chat connection, the first call returns `awaiting_confirmation`. Show every field of the server's `confirmation`, including the company, before, after, reason and finality. Ask for an explicit yes to those exact values. Only after that yes, repeat identical arguments with the returned `confirmationHash`. A no, ambiguity or silence changes nothing.
   - After `confirmation_changed` or `objective_revision_conflict`, read again, show the fresh confirmation and ask for another yes. Use a new key when intent changes. Never silently retry approval.
   - A decline or dismissal changes nothing. Ask again only if the person asks.
5. On return, compare the person's reported evidence with the stored criteria. Distinguish what happened from what is still unknown. Propose the next step. Complete or drop only when the person judges the result and confirms it through `setObjective`, with `operation: "complete"` or `drop`, the current revision and no replacement fields. Completion and dropping are final. A new goal gets a new objective.

Saving goals is free. It grants no external action. Report only the result OrgSync returned; a suggestion is not a saved commitment.
