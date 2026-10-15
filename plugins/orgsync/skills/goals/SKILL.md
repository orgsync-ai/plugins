---
name: goals
description: Set or revisit company and person objectives in OrgSync, with success criteria, a responsible person and a date.
argument-hint: "[goal or result to review]"
disable-model-invocation: true
---

Help the person set or revisit their objectives. Start with what they asked: $ARGUMENTS

1. Call `status`, `readPicture` and `list` with `what: "objectives"`. Reads are free. Use `view: "closed"` for completed or dropped objectives, and pass `nextCursor` as `cursor` for more. An absent `yourFocus` means unavailable, not zero objectives. Full `successCriteria` come from the list.
2. For a new goal, ask what result they want, what observable evidence would count as success, who is responsible, and the timeframe. Agree a specific `dueOn` calendar date and a `horizon` of `day`, `week` or `month`. Never invent criteria, a responsible person or a date. Work-profile `roleObjectives` is descriptive text, separate from these objectives.
3. Explain that every current company member and their connected AI clients can read objectives and their history. An Owner or Decision approver may change any objective and assign an active member. A Member may change only person objectives they own. Responsibility gives no permission. Company objectives may be unassigned; person objectives require an owner. Scope stays fixed. A revoked owner stays attributed as inactive until an approver reassigns them.
4. Call `setObjective` when the person wants to save. Use a fresh `idempotencyKey` for each intended change, repeated only to retry it. Creation uses `operation: "create"`, a fresh `objectiveId`, `expectedRevision: 0`, `scope` and the complete editable `objective`. Replacement uses `operation: "replace"`, the listed revision and every editable field. Supply the person's `reason`.
   - On a prompt connection, only the person answers OrgSync's form. You never answer it.
   - On a chat connection, the first call returns `awaiting_confirmation`. Summarize the server's `confirmation` in plain words: what changes, the company, visibility to every current company member, before and after titles, values, dates, owner names, reason and finality. Never show IDs, hashes or raw JSON. Ask for an explicit yes to those exact values. Only after that yes, repeat the exact arguments with `idempotencyKey` copied from `retry.idempotencyKey` and the returned `confirmationHash`. Keep that key across turns; never generate a new one for this yes. A no, ambiguity or silence changes nothing.
   - After `confirmation_changed` or `objective_revision_conflict`, read again, show the fresh confirmation and ask for another yes. Use a new key when intent changes. Never silently retry approval.
   - A decline or dismissal changes nothing. Ask again only if the person asks.
5. On return, read the nullable `latestCheckIn` and its `recordedAt` date as reported evidence against its `objectiveRevision`, including uncertainty. A check-in for an earlier revision does not establish the current goal's status. Offer /orgsync:review for a weekly check-in. A stop or done call never completes a goal. On return, compare the person's reported evidence with the stored criteria. Distinguish what happened from what is still unknown. Propose the next step. Complete or drop only when the person judges the result and confirms it through `setObjective`, with `operation: "complete"` or `drop`, the current revision and no replacement fields. Completion and dropping are final. A new goal gets a new objective.

Saving goals is free. It grants no external action. Report only the result OrgSync returned; a suggestion is not a saved commitment.
