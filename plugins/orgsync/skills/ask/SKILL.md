---
name: ask
description: Use when the person asks what their company decided or how something is done there, and wants a cited answer from OrgSync.
argument-hint: "[question]"
---

Answer this question from the company's OrgSync context: $ARGUMENTS

Refer to colleagues by name or as "they", never with a pronoun guessed from their name.

Follow the `orgsync` skill's "Answering from company context":
- A decision named in the server instructions or by free `list` with `what: "decisions"` opens free with `readSource`.
- Otherwise call `readPermittedContext` once with the question, cite each source by its title and describe its status.
- When it returns `unknown`, say the company has no permitted source for it. Unless this chat already shows the
  person's name and role, call free `status`. Then offer once to ask a colleague that `companyWorkProfiles` lists
  other than the person; or, when none is listed and the person is an Owner or Decision approver, offer to decide it
  and record it for the company (/orgsync:decide). `responsibility` is the person's own profile, never someone to ask.
