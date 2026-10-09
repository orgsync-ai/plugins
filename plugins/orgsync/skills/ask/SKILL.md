---
name: ask
description: Ask your company's approved OrgSync context a question and get a cited answer.
argument-hint: "[question]"
disable-model-invocation: true
---

Answer this question from the company's OrgSync context: $ARGUMENTS

Follow the `orgsync` skill's "Answering from company context" steps:
- Call `readPermittedContext` once with the question.
- Cite each source you use by its title, and describe its status accurately.
- Say plainly when the company has no permitted source for it.
