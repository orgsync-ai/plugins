---
name: request
description: Use when the person wants to ask a teammate something, hand off or assign work (one of their to-dos included), ask someone to review or decide, or answer, agree to, update or review a request someone sent them.
argument-hint: "[who and what, such as 'ask Priya for this week's refund numbers']"
---

Help the person ask or assign a colleague, or act on a request, through OrgSync. What they asked: $ARGUMENTS

Refer to colleagues by name or as "they", never with a pronoun guessed from their name.

Follow [requests between people](../orgsync/references/collaboration.md) for the record's rules and the ground rules'
confirmation for every write.

**New request**

1. Read free: `status`, `readCollaboration` with `resource: "inbox"`, and `readFrameworks` with `view: "guidance"`
   and `pillars: ["project_management"]` for Kanban and the active tags. Find the recipient and a reviewer by
   `personId` as the reference describes; ask when a name is unclear.
2. Agree the request in a few plain questions, only for what is missing: what kind (a question, a piece of work, a
   review, a decision), what a good answer or result looks like, by when, who reviews it, and whether it moves a goal
   (`list` with `what: "objectives"`) or concerns a source.
3. When Kanban is enabled, check the recipient's load with `resource: "flow"` and their `personId`, and say if
   `overLimit` is true. The person decides.
4. Once the terms are clear, call `collaborate` with `operation: "create"` and present the server's confirmation in
   plain words, adding that nothing is sent by email or chat: the recipient sees it at their next OrgSync check-in.
   The person's yes goes to that confirmation, so ask any open question before the call rather than after it.
5. Report what OrgSync returned. If it matters soon, suggest the person also tell the recipient directly.
6. Once the request is created, offer the person one follow-up, such as "Want a reminder on Thursday if Priya hasn't
   submitted?". On a yes, save it as their private to-do linked to the request, with `unless` set to `request_moved`,
   as /orgsync:todo describes. It shows as due in /orgsync:today at that time, or closes itself if the request moves
   first; OrgSync sends no to-do email.

**Acting on a request**

1. Open it with `readCollaboration`, `resource: "request"` and its `collaborationId`, and show the author, recipient,
   reviewer, terms, dates, acknowledgment, agreement, blockers and any submission.
2. Offer only the actions the person's place in it allows (recipient, author, reviewer or manager), as the reference
   lists, and confirm each one.
3. When the person answers an information request, offer once to share the answer with the company as well.
4. When the person agrees to a request, offer their own follow-ups as private to-dos (/orgsync:todo), such as a date to
   start or a check before it is due. They pick which; nothing is saved without their answer.

**Handing off a to-do**

When the person wants a teammate to do one of their to-dos instead:

1. Read it with free `list`, `what: "todos"` and its `todoId`, then agree the request as in New request, from the
   to-do's title and note.
2. Call `collaborate` with `operation: "create"`, a new `collaborationId` and a fresh `idempotencyKey`, never built
   from the to-do: the company can see both, and the to-do is private. The request takes its own confirmation, as
   above. Keep both; after a failure or timeout, retry the identical call with the same key or read the request with
   `readCollaboration`, and never create a second one.
3. Only after OrgSync returns the created request, call `setTodo` with `operation: "hand_off"`, the to-do's `todoId`
   and `revision` as `expectedRevision`, the request's `collaborationId` and a fresh `idempotencyKey`. The to-do closes
   as handed off, linked to the request. Without their yes to the request, nothing changes and the to-do stays open.
