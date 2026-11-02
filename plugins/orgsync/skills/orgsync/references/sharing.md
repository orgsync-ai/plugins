# Sharing with the company

Share only when the person asks, or says yes when you offer; a captured item ([below](#captured-items)) is saved
privately, never shared, until they do. A shared source is readable by every current company
member and their AI apps, under the person's name, and starts as reported information; only an Owner or Decision
approver makes it an accepted decision. Each publication uses company credit once it is ready.

## Write each draft

- **One draft per decision**, rule, commitment or owner: a title that names it, a short accurate summary, and only
  the excerpts that support it. Never a whole document, a transcript, secrets or credentials.
- **Origin.** Put a link to the original in `sourceOrigin` when there is one. For a local or attached file, use its
  file name and section, such as "handbook.md#tune-up-prices", never its path on this computer. For a past chat, use
  the app and date, such as "Claude chat, 14 Sep 2026", never a chat link. For answers the person gave here, use
  "OrgSync interview".
- **Area.** Suggest one `area` (`sales_marketing`, `finance`, `legal`, `product`, `hiring_people` or `operations`)
  and show it, so the person's yes to the sharing confirmation is their agreement. Leave it out when none fits.
- **Tags.** Suggest up to five company tags that fit, such as the team or project the decision concerns, and show each
  by its label, so the person's yes covers them too. Take them only from the `tags` that free `list` with `what: "frameworks"`
  returns with `status: "active"` and pass their IDs as `tagIds`; never make one up. Leave tags out when none fit. Tags help
  people notice a decision; they grant no access. A member who needs a new tag asks an Owner (/orgsync:request).
- **Way of working.** Set `classification: "way_of_working"` only when the person deliberately agrees the draft is how
  the team works; an area, title or folder alone never makes a practice.
- **Private-looking material.** Set `privacyConcern` to `private_page`, `direct_message`, `personal_information` or
  `other_private_material` when it fits; otherwise `not_flagged`, which never means checked as safe.

## Check for a decision it replaces

Call `list` with `what: "decisions"`, and again with `view: "mine"`, and look for one on the same topic. Open a likely
match with `readSource`. If the new text changes it, ask: "This replaces Refund approvals. Update that instead?" On a
yes, suggest the new text as a correction ([managing sources](sources.md)) rather than a new draft. If it extends or
relates to an accepted decision without changing it, keep the new draft and name that decision in its preview line, in
a few words: "(extends 'Refund approvals over $500 need a lead's sign-off')". When the new draft supersedes other
sources instead, name them in that entry's `replaces` (their `sourceId` and current `revision`, up to 5, each source
once per batch). An Owner or Decision approver may also set `accept` to share, accept and replace under the same yes.
The confirmation numbers the replacements in `offeredReplacements`: list each by `n` and title, ask which to keep, and
repeat with the key and the kept numbers as `replaceSelection` (`[]` for none). Anyone else's `replaces` is a
suggestion an approver applies.

## Share one or several

1. Call `submitDraft` for each draft. Each saves privately and asks nothing; keep its `draftId`, `revision` and
   `payloadHash`. When the draft serves one of the company's active goals or the person's own, add `goal` with its
   `objectiveId` (and `keyResultId`, or null); it sits beside the draft, outside its revision, and the source keeps it.
2. Call `shareDrafts` once with up to 20 entries in `drafts` straight away, without asking first. In the one message
   that asks for the yes, show each draft as one numbered line, as [In conversation](../SKILL.md#in-conversation)
   limits it: its title and summary, then area, way-of-working mark, tags by label, any privacy mark and the decision
   it extends in a few words, with who sees it (everyone at the company) said once. End with one question ("Share
   all, or drop which numbers?"). On a yes, repeat the same drafts with the returned `idempotencyKey`, as the ground
   rules describe. A drop or change makes a new preview for what remains: edit the draft with `submitDraft` and call
   `shareDrafts` again.
3. When the person said yes to your offer to share, that yes was to the offer, not the text: go straight to the
   preview message, which asks for one more yes, and ask nothing in between.
4. Report `results` in one line ("Shared 3; 1 stayed private: too long"). A decline leaves them all private; never try
   another route to share that revision. A publication is ready only when `status` with its `operationId` says so.

`list` with `what: "drafts"` finds the person's pending private drafts; `discard` with its `draftId` and `revision`
erases one at their request.

## Captured items

When capture is on, the person's AI saves decisions from their sessions as captured items: private drafts in their
own queue, deleted 7 days after they were saved unless shared. Only they see them. The picture's `capture` counts
them (`queued`, and `expiringSoon` for those deleted soon); in `list` with `what: "drafts"` and in the picture's
pending drafts a captured item carries `capturedFrom`, the app it came from.

- **Share from the queue in one batch.** "Share all", numbers they pick, or skip: call `shareDrafts` with the chosen
  items as entries, exactly as [Share one or several](#share-one-or-several) describes, one preview and one yes for
  the batch. Check each for a decision it replaces first. Saying "share all" was a yes to the offer, not to the text.
- **Editing an item.** Save the edited text with `submitDraft` as a new captured item, with the same `capture` and its
  `session`, then `discard` the original with its `draftId` and `revision`, so forgetting the session still covers it.
  Then preview the new one.
- **Skip** leaves them to expire; `discard` erases one now. Forgetting a whole session is /orgsync:capture.
- A captured item is only a suggestion the person's AI made: show it as theirs to check, never as decided.
