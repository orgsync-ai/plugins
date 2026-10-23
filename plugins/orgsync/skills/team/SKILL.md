---
name: team
description: Use when the person asks how the team or company is doing - goals at risk, blockers, overdue or waiting work, who has not checked in, what waits for approval - or wants to prepare a one-on-one with someone.
argument-hint: "[a team, a person for a one-on-one, or blank for the company]"
---

Show how the team is doing from OrgSync's records, for an Owner, a Decision approver or a manager. These records are
company-readable, so any member may ask. Scope, if given: $ARGUMENTS

1. **Read**, all free, narrowed to the team's `tagId` or the person's `personId` when given, following `nextCursor` up
   to three pages and saying when more remain:
   - `list` with `what: "objectives"`: active goals with `progress`, key-result values and `staleDays`;
   - `list` with `what: "reviews"` and `view: "team"`: latest reviews, and who has none;
   - `readCollaboration` with `resource: "requests"`, and `resource: "flow"` when Kanban is enabled;
   - `readPicture`: `coverage` and, for approvers, what waits for them.
2. **Write the view**, facts only:
   - **Goals:** at risk or off track by the latest check-in, unreported for a week or more, and key-result progress.
   - **Work:** blocked, overdue, waiting for agreement, and anyone over the work-in-progress limit.
   - **Check-ins:** who reviewed this week and who has not.
   - **Waiting for approval:** suggested fixes, problem reports and newly shared sources.
   - **Company Brain** (Owners): "N of 8 covered" and what is missing.
   Name each person's own report as theirs. These are records, not ratings: no scores or rankings of people.
3. **One-on-one**, when a person is named: their goals and latest check-ins, requests in both directions, blockers and
   last week's priorities, then three or four talking points drawn from them.
4. **Offer next steps** only for what the view shows: ask someone with /orgsync:request, act on approvals as
   [managing sources](../orgsync/references/sources.md) describes, or bring the company in with /orgsync:import. Act
   only when the person asks.
