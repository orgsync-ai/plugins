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
- When it returns `unknown`, first check free `list` with `what: "decisions"` (and `what: "ways_of_working"` for how
  something is done). If a title clearly covers the question, open it with free `readSource` and answer from its
  content, citing the title and status. Only when no title fits, or the source does not answer it, say the company has
  no permitted source for it. Then, unless this chat already shows the person's name and role, call free `status`. Then offer once to ask a colleague that `companyWorkProfiles` lists
  other than the person; or, when none is listed and the person is an Owner or Decision approver, offer to decide it
  and record it for the company (/orgsync:decide). `responsibility` is the person's own profile, never someone to ask.
