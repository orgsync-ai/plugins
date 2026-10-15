---
name: share
description: Prepare something from this session as a draft for your company in OrgSync, and share it only after you approve it.
argument-hint: "[what to share]"
disable-model-invocation: true
---

The person wants to share this with their company through OrgSync: $ARGUMENTS

Follow the `orgsync` skill's "Sharing with the company" steps.
- Write a short, accurate summary and only the excerpts that support it, with no secrets and no transcript.
- For a local or attached file, the origin is its file name and section, never its path on this computer.
- Call `submitDraft`. If OrgSync shows its own prompt, the person answers it there.
- If the receipt says `awaiting_confirmation`, summarize `confirmation` in plain words: what will be shared, the company, visibility to every current member under their name, the title, summary, excerpt previews and any values, dates or owner names. Never show IDs, hashes or raw JSON. Wait for an explicit yes, then call `shareDraft` with the receipt's exact `draftId`, `revision` and `payloadHash` and one fresh `idempotencyKey` for that share. Reuse the exact arguments and key on retries.
- If this instead updates an existing source through a repeated confirmation call, follow the `orgsync` skill: after the yes, repeat exact arguments with `retry.idempotencyKey` as the `idempotencyKey` and the returned `confirmationHash`.
- If the person declines, the draft stays private.
