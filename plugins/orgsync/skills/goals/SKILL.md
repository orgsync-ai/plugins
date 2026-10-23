---
name: goals
description: Use when the person wants to set, change, check or close a company or personal goal in OrgSync, with key results, an owner and a date.
argument-hint: "[goal or result to review]"
---

Help the person set or revisit goals. Start with what they asked: $ARGUMENTS

1. **Read**, all free: `status`, `readPicture`, `readFrameworks` with `view: "guidance"` and
   `pillars: ["business_management"]`, and `list` with `what: "objectives"` (`view: "closed"` for completed or dropped
   ones; follow `nextCursor`). Each goal carries server-computed `progress`: per key result the latest `value`,
   `recordedAt` and `percent`, and `staleDays` since the last check-in.
2. **A new goal.** Ask what result they want, what observable evidence counts as success, who is responsible, and by
   when; take every number, owner and date from the person. Agree a `dueOn` date and a `horizon` (`day`, `week`,
   `month`, `quarter` or `custom`); an optional `periodStartOn`; and an optional weekly `reviewCadence` (weekday Sunday
   zero to Saturday six, local time, time zone, start date and exceptions), shown in the confirmation.
3. **Key results and tags.** When OKR is enabled, propose up to three `keyResults`, each with a short stable lowercase
   `keyResultId`, a `label`, and a `unit`, `baseline` and `target` when measurable (a null `target` is qualitative).
   Offer up to five `tagIds` from the active `tags`. A replacement that omits `keyResults` or `tagIds` keeps them; an
   empty list clears them.
4. **A link.** A person goal may support one active company goal through `supports`: omit it to keep the link, null to
   remove it, or the company goal's ID to set it. On reads, `supportsContext` gives the target's current title,
   `revision` and `status`; a `linkedRevision` that differs means the company goal changed, and completed or dropped
   means it closed. Neither changes the person goal; ask the person.
5. **Who can change what.** Every member and their AI apps can read goals and their history. Owners and Decision
   approvers can change any goal and assign an active member; a Member changes only person goals they own. Being
   responsible for a goal grants no permission.
6. **Save** with `setObjective` and a fresh `idempotencyKey` per intended change, with the person's `reason`:
   - create: `operation: "create"`, a new `objectiveId`, `expectedRevision` 0, `scope` and the complete `objective`;
   - replace: `operation: "replace"`, the listed revision and every editable field (also for a link-only change);
   - complete or drop: the current revision and no other fields, only when the person judges the result. These are
     final; a new goal gets a new objective.
   Confirm as the ground rules describe, including before and after links. After `confirmation_changed` or
   `objective_revision_conflict`, read again and ask for a fresh yes. For `objective_support_unavailable` or
   `objective_support_not_allowed`, relay the message and ask which link they want.
7. **On return**, compare the person's evidence with the criteria and `progress`, separate what happened from what is
   unknown, and propose the next step. A check-in belongs in /orgsync:review; help from a teammate in
   /orgsync:request.

Saving goals is free and grants no outside action. Report only what OrgSync returned.
