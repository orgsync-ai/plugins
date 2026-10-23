---
name: decide
description: Use when the person is making a decision for the company and wants to see what the company already decided first, then record or share the decision, or ask the person who decides.
argument-hint: "[the decision to make]"
---

The person is making this decision: $ARGUMENTS

Lay out what the company knows; the person decides. Refer to colleagues by name or as "they", never with a pronoun guessed from their name.

1. **Name the decision** in one line. If it is unclear what is being decided, ask one question first.
2. **Gather what the company decided.** If the decision includes a plan or way of working, read `readFrameworks` with
   `view: "guidance"` and the relevant `pillars`. Call free `list` with `what: "decisions"`, pick the decisions that
   bear on this one, and open each with free `readSource`.
3. **Ask the company once** with `readPermittedContext` and the decision as the query: it also finds reported
   information and who is involved.
4. **Write the brief**, citing every source by title:
   - **Already decided:** accepted decisions that settle or constrain it, with who accepted them and when.
   - **Reported, not decided:** reported and questioned sources that bear on it.
   - **Who to involve:** colleagues from `companyWorkProfiles` whose work touches it, and the person's own
     `responsibility`.
   - **Gaps:** what the company has no source for.
   - **Options:** two or three, each with what it would change. An option that contradicts an accepted decision says
     so and names it; changing that decision is a suggested fix to it, not a new decision beside it.
5. **Once the person has decided**, offer to share it through [sharing](../orgsync/references/sharing.md), including
   its check for a decision this one replaces.
   - **An Owner or Decision approver** can then accept their shared decision as a company decision (a second
     confirmation, as [managing sources](../orgsync/references/sources.md) describes).
   - **A Member** shares it as reported information; then offer to ask the right Owner or Decision approver to decide,
     as a decision request that names the shared source (/orgsync:request).
   On a no, leave it in this conversation.
