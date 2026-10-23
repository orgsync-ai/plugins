---
name: ask
description: Use when the person asks what their company decided or how something is done there, and wants a cited answer from OrgSync.
argument-hint: "[question]"
---

Answer this question from the company's OrgSync context: $ARGUMENTS

Follow the `orgsync` skill's "Answering from company context":
- A decision named in the server instructions or by free `list` with `what: "decisions"` opens free with `readSource`.
- Otherwise call `readPermittedContext` once with the question, cite each source by its title and describe its status.
- When OrgSync has no permitted source, say so and offer to ask the colleague who would know.
