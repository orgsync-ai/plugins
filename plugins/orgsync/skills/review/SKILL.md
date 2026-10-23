---
name: review
description: Use when the person wants their weekly review - last week's priorities, goal check-ins and key-result numbers, decisions to share, and next week's priorities.
---

Run the weekly review in this AI app. Record the person's own account, uncertainty included: work done does not prove
a result moved. Keep it to evidence, without scores or rankings. Refer to colleagues by name or as "they", never with a pronoun guessed from their name.

1. **Read**, all free: `status`, `readPicture`, `readCollaboration` with `resource: "inbox"`, `readFrameworks` with
   `view: "guidance"` and the pillars of the goals under review, `list` with `what: "objectives"` and `view: "active"`
   (follow every `nextCursor`), and `list` with `what: "reviews"` and `view: "mine"` for their previous review. When
   Kanban is enabled, also `readCollaboration` with `resource: "flow"` and their `personId`. For an Owner, also page
   `list` with `what: "reviews"` and `view: "team"`, grouping members' check-ins by each check-in's own `supports` and
   `supportsContext`, with an unlinked group, each under its author.
2. **Previous priorities**, with the previous review's date; after a gap, call them the previous review's priorities.
   With no goals, offer a priorities-only review or /orgsync:goals.
3. **Contributions.** Open selected requests and their exact submission before weighing them, and keep the
   contributor, criteria, evidence, limitations and reviewer. Select up to 20 as `contributions` by
   `collaborationId`, `revision` and optional `submissionRevision`. Accepted work does not prove a goal moved.
4. **Check-ins**, up to 20, on goals assigned to this person (Owners and Decision approvers may also check in on
   unassigned company goals; never on someone else's goal). For each: on track, at risk or off track; what was done;
   and what moved the result, each within 500 characters, agreed with the person rather than cut. Use the current
   `objectiveRevision`. Flag a goal whose `staleDays` is 7 or more. For each measurable key result, ask for its current
   number and record it in `keyResultValues` by `keyResultId` and `value`, naming the evidence; an unknown number stays
   unrecorded. Include goal updates noted from meetings this week.
5. **Decisions to share.** Ask which of this week's decisions to include, check for ones they replace, and save each
   with save-only `submitDraft` as [sharing](../orgsync/references/sharing.md) describes. Share none before the review's
   confirmation. A changed practice is a suggested fix to its source instead.
6. **A call on each goal:** keep going, change approach, stop or done, recorded apart from its status. A stop or done
   call does not close the goal.
7. **Next week's one to three priorities**, each within 200 characters. When `overLimit` is true, say the person's
   active work exceeds the company's limit; it never blocks a priority. Before they choose, offer research on the top
   goal with this app's own web search, on request only: at most two ideas, with sources.
8. **Save** with one `saveReview`: `checkIns`, `nextWeekPriorities`, the selected `drafts` and `contributions` (empty
   lists when none) and a fresh `idempotencyKey`. Saving is free; each shared draft is charged once ready. In the
   confirmation, say that every member and their AI apps can read the saved review, its priorities and check-ins.
   Where the app cannot show OrgSync's prompt and the connection uses it, save nothing.
9. **Report** whether the review saved and each share's result. A partial share still saved the review, and retrying
   its key does not retry failed drafts. After an unavailable result, retry the identical key.
10. **After saving**, offer a separate `setObjective` change for any stop or done call, only on the person's judgment.
    The weekly reminder is optional, in OrgSync's web app under Settings, Account.
