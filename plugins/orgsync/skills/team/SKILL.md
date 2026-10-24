---
name: team
description: Use when the person asks how the team or company is doing - goals at risk, blockers, overdue or waiting work, who has not checked in, what waits for approval - or wants to prepare a one-on-one with someone.
argument-hint: "[a team, a person for a one-on-one, or blank for the company]"
---

Show how the team is doing from OrgSync's records, for an Owner, a Decision approver or a manager. These records are
company-readable, so any member may ask. Scope, if given: $ARGUMENTS

Refer to colleagues by name or as "they", never with a pronoun guessed from their name: write "Eva reported it" or
"they reported it", never "she", "he", "her", "his" or "him". Before answering, reread every line for those words and
replace each one with the name or "they".

1. **Read**, all free, narrowed to the team's `tagId` or the person's `personId` when given, following `nextCursor` up
   to three pages and saying when more remain:
   - `list` with `what: "objectives"`: active goals with `progress`, key-result values and `staleDays`;
   - `list` with `what: "reviews"` and `view: "team"`: latest reviews, and who has none; AI employees come after the
     people, labelled "(AI employee)";
   - `list` with `what: "employees"` and `view: "company"`: the AI employees, each with its `state`, `responsible`
     human and `lastSeenAt`;
   - `readCollaboration` with `resource: "requests"`, and `resource: "flow"` when Kanban is enabled;
   - `readPicture`: `coverage` and, for approvers, what waits for them.
2. **Write the view**, facts only:
   - **Goals:** at risk or off track by the latest check-in, unreported for a week or more, and key-result progress.
   - **Work:** blocked, overdue, waiting for agreement, and anyone over the work-in-progress limit.
   - **Check-ins:** which people reviewed this week and which have not.
   - **Waiting for approval:** suggested fixes, problem reports and newly shared sources.
   - **AI employees**, in their own section after the people: each one's state, responsible human and when it was last
     seen, and its latest weekly check-in as its own report, judged or "not judged yet" from `judgment`. Leave them
     out of the people's check-ins and counts. Say "none" only when the list came back empty.
   - **Company Brain** (Owners): "N of 8 covered" and what is missing.
   Name each person's own report as theirs. These are records, not ratings: no scores or rankings of people.
3. **One-on-one**, when a person is named: their goals and latest check-ins, requests in both directions, blockers and
   last week's priorities, then three or four talking points drawn from them. For an AI employee, the same records
   labelled as its own report, with its state and responsible human.
4. **Offer next steps** only for what the view shows: ask someone with /orgsync:request, act on approvals as
   [managing sources](../orgsync/references/sources.md) describes, or bring the company in with /orgsync:import. When
   the person is an AI employee's responsible human, offer to judge its unjudged check-in, or to pause it, as
   [AI employees](../orgsync/references/ai-employees.md) describes. Act only when the person asks.
