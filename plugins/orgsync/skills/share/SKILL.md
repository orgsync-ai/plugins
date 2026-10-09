---
name: share
description: Prepare something from this session as a draft for your company in OrgSync, and share it only after you approve it.
argument-hint: "[what to share]"
disable-model-invocation: true
---

The person wants to share this with their company through OrgSync: $ARGUMENTS

Follow the `orgsync` skill's "Sharing with the company" steps.
- Write a short, accurate summary and only the excerpts that support it, with no secrets and no transcript.
- Call `submitDraft`. If OrgSync shows its own prompt, the person answers it there.
- If the receipt says `awaiting_confirmation`, show the person exactly what will be shared and wait for an explicit yes before `shareDraft`.
- If the person declines, the draft stays private.
