---
name: feedback
description: Send the OrgSync team feedback about OrgSync itself (a pain point, idea, bug or praise), stored without your name, company or connection.
argument-hint: "[what to tell OrgSync]"
disable-model-invocation: true
---

Help the person tell the OrgSync team about OrgSync itself: $ARGUMENTS

Follow the `orgsync` skill's "Feedback to OrgSync" steps:
- If they gave no details yet, ask one short question: what they were trying to do and what got in the way, or what they would like.
- Choose `kind`, `area` and, only if they said how much it hurts, `impact`.
- Write `feedback` as one general paragraph from only what they said, adding nothing, with no names of people, companies, customers or products, no emails, links, handles or long numbers, and no company content.
- Show them the exact paragraph with its kind and area. Call `sendFeedback` only after their yes. Sending the same words again the same day keeps one copy.
- Tell them it reached the OrgSync team without their name or company, so OrgSync cannot reply to it.
