---
name: guide
description: Use when the person asks what to do next for the business, wants help choosing one useful goal, or wants to find and win first customers.
argument-hint: "[problem or next step]"
---

Help the person choose one useful next step. Start with their question: $ARGUMENTS

1. **Read the situation**, all free: `status`, `readPicture` (its `businessProfile` gives stage, location and help
   areas), `list` with `what: "objectives"`, `list` with `what: "reviews"` and `view: "mine"`, `readCollaboration` with
   `resource: "inbox"`, relevant decisions with `list` and `readSource`, and current practices with `list`,
   `what: "ways_of_working"`, `view: "accepted"`. Read `readFrameworks` guidance for only the pillars the task needs.
   Use paid `readPermittedContext` only for a real question the free reads leave open.
2. **Fill gaps.** Ask only what is missing or changed; missing context stays unknown. Offer /orgsync:import when
   company knowledge is missing; continuing without it is fine.
3. **Choose the route and count it once.** When the problem is finding and winning first customers, take the route
   below. Otherwise this is the business guide. After the person's first substantive answer (or when they gave the
   situation up front), call `reportGuideUse` once with `guide: "first_customers"` or `guide: "business_guide"`, never
   both, with one fresh `idempotencyKey` for this run and no answers or company content in it.
4. **Start from how they work now.** Use the current accepted practice when one fits, comparing candidates when
   `acceptedInAreaCount` is above one. Offer once, when useful, to keep, tailor or write their own way of working, or
   try an example from [ways-of-working examples](references/ways-of-working-examples.md); skipping is complete.
   Examples become company knowledge only when deliberately shared and accepted.
5. **Agree one next goal:** a result, observable success criteria, a responsible person and a date, fitted to the
   evidence and effort available, saved only if they want through /orgsync:goals. A person goal may support one active
   company goal.
6. **Practices by agreement only.** A practice draft needs `classification: "way_of_working"` and an `area` the person
   agreed, shared as [sharing](../orgsync/references/sharing.md) describes; an existing practice changes through a
   suggested fix.
7. **Bring in help.** When a teammate can help, offer /orgsync:request, linked to the goal. A solo founder continues
   without one. Offer /orgsync:review to revisit the evidence next week.

## First customers

1. Confirm what the business sells, its business type, target customers and their location, target market, available
   effort and budget. A missing `businessProfile` is unknown, not an assumed stage or location. Read `readFrameworks`
   guidance for `sales`, adding `marketing` for audience or channel work and `finance` for pricing or spending.
2. Fit one small plan to the stage. Idea: one customer problem and a short customer-conversation plan. Starting: one
   offer, one customer segment and one acquisition channel. Running or growing: first check that a first-customer plan
   fits the need. Propose one dated goal with observable criteria and a responsible person.
3. Prepare the next useful artifact within their effort and budget: interview questions, an offer, outreach copy or a
   sales-conversation outline. Location changes the questions and wording; flag marketing, privacy, consent, tax or
   registration questions for current official guidance or a qualified adviser. Give no legal advice.
4. On return, compare the reported evidence with the goal's criteria, separating observations, unknowns and
   suggestions.

The guide sends no messages, contacts no prospects, buys nothing and takes no outside action; the person does that
work.
