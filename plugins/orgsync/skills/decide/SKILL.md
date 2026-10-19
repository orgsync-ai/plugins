---
name: decide
description: Think through a decision with what your company already knows in OrgSync, then offer to share the decision.
argument-hint: "[the decision to make]"
disable-model-invocation: true
---

The person is making this decision: $ARGUMENTS

Build a decision brief from the company's OrgSync context, then help the person decide. The person decides; you lay out what the company knows.

1. **Name the decision.** Restate it in one line. If it is unclear what is being decided, ask one question first.
2. **Gather what the company already decided.** If the decision includes a plan or way of working, read `readFrameworks` with `view: "guidance"` and the relevant `pillars`. This free method guidance does not establish company facts or override approved practices. Call `list` with `what: "decisions"`, which is free, and pick the decisions whose titles bear on this one. Open each with `readSource`, which is free, to read its current text, status and date.
3. **Ask the company once.** Always call `readPermittedContext` once with the decision as the query, even when step 2 found the relevant decisions: it also finds reported information and who is involved, which the decision list does not show. It is one cited retrieval and uses company credit, so call it once, not per option.
4. **Write the brief**, citing every source by title:
   - **Already decided:** accepted decisions that settle or constrain this one, with who accepted them and when.
   - **Reported, not decided:** reported information and disputed sources that bear on it, labelled as such.
   - **Who to involve:** colleagues from `companyWorkProfiles` whose role touches it, and the person's own `responsibility`.
   - **Gaps:** what the company has no source for.
   - **Options:** two or three, each with what it would change in the decisions above.
   Use only what OrgSync returned and what the person said. Follow the `orgsync` skill's rules for statuses, `unknown`, `conflict` and `denied`.
5. **Conflicts first.** If an option contradicts an accepted decision, say so plainly and name the decision. Changing it is a correction to that source, not a new decision beside it.
6. **Offer to share.** Once the person has decided, offer to share the decision with the company. On a yes, follow the `orgsync` skill's "Sharing with the company" steps, including its check for a decision this one replaces. On a no, leave it in this conversation.
