# Sharing with the company

Share only when the person asks, or says yes when you offer. A shared source is readable by every current company
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
- **Way of working.** Set `classification: "way_of_working"` only when the person deliberately agrees the draft is how
  the team works; an area, title or folder alone never makes a practice.
- **Private-looking material.** Set `privacyConcern` to `private_page`, `direct_message`, `personal_information` or
  `other_private_material` when it fits; otherwise `not_flagged`, which never means checked as safe.

## Check for a decision it replaces

Call `list` with `what: "decisions"`, and again with `view: "mine"`, and look for one on the same topic. Open a likely
match with `readSource`. If the new text changes it, ask: "This replaces Refund approvals. Update that instead?" On a
yes, suggest the new text as a correction ([managing sources](sources.md)) rather than a new draft.

## Share one or several

1. Call `submitDraft` for each draft. Each saves privately and asks nothing; keep its `draftId`, `revision` and
   `payloadHash`.
2. Show the person every draft's title, summary, origin, area, classification and privacy mark, and let them drop or
   edit any.
3. Call `shareDrafts` once with up to 20 entries in `drafts`, then confirm as the ground rules describe, repeating the
   same drafts with the returned `idempotencyKey` after the yes.
4. Report each entry from `results`: shared, or not shared and why. A decline leaves them all private; never try
   another route to share that revision. A publication is ready only when `status` with its `operationId` says so.

`list` with `what: "drafts"` finds the person's pending private drafts; `discardDraft` erases one at their request.
