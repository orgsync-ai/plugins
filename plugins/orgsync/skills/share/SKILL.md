---
name: share
description: Use when the person wants to share something from this conversation with their company through OrgSync, such as a decision, rule, price or owner.
argument-hint: "[what to share]"
---

The person wants to share this with their company through OrgSync: $ARGUMENTS

Follow [sharing with the company](../orgsync/references/sharing.md): check for a decision it replaces, write the draft,
save it privately with `submitDraft`, show it, then share it with `shareDrafts` and confirm. If it updates an existing
source, suggest the text as a fix to that source instead. A decline keeps the draft private.
