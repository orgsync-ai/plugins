# Managing sources

Act only when the person asks. Find the source free with `readPicture` (its review section lists recently shared
sources) and `list` with `what: "decisions"` (`view: "mine"` for their own), then call `readSource` for its current
`revision` and `knowledgeStatus`. A source's web page is read-only; these tools are the only way to change it.

- **Something is wrong.** `reportProblem` with the source, its revision, one `issueType` (`incorrect`, `outdated`,
  `missing_context` or `other`) and the person's note as `detail`. It changes nothing and needs no confirmation.
- **Better text.** Show the exact replacement summary, excerpts and reason, say that Owners and Decision approvers will
  see it under the person's name, and ask for a yes. Then `proposeCorrection` with `baseRevision` set to the revision
  you read. Keep `area` and `classification` unless the person deliberately changes them, and show any change. Omit
  `tagIds` to keep the source's `tags`, which `readSource` shows; to change them, pass the whole new list from the
  active tags (`[]` clears them) and show the change by label. To tag an existing decision, suggest a fix that keeps
  its text and changes only `tagIds`. Nothing changes until an approver accepts it.
- **Take back a suggestion.** Find it with `list`, `what: "proposals"`, `view: "mine"`, then `withdrawProposal` with
  its `proposalId` and `revision`. It works until someone decides it.
- **Accept, question or withdraw** (Owners and Decision approvers). `setKnowledgeStatus` with the expected and target
  status, the person's reason and, for a decision, `effectiveAt` only if they gave a date. To change only an accepted
  decision's date, pass `accepted_decision` as both statuses with the new `effectiveAt`.
- **Correct directly** (Owners and Decision approvers). `proposeCorrection` with their text, then `decideProposal` to
  accept it: two separate confirmations.
- **Delete.** An Owner or Decision approver can delete any current source; a member can delete their own while it is
  reported information. `deleteSource` always needs the person's answer in OrgSync's own prompt; chat confirmation
  never covers it. Where the app cannot show that prompt (ChatGPT, Claude web), say so instead of calling it: the
  person deletes from an app that can, such as Claude Code, or an approver withdraws or questions the source meanwhile.
  On a refusal: `approval_mode_prompt` means repeat without `confirmationHash`; `approval_mode_chat` means the person
  switches this connection to the prompt on its AI apps page; `prompt_unsupported` means this app cannot show it;
  `declined_in_prompt` or `dismissed_in_prompt` means nothing changed.

## Reviewing suggestions and problem reports

Owners and Decision approvers, when they ask.

- **Waiting for a decision.** `list` with `what: "proposals"` and `view: "awaiting_decision"`: the source, the revision
  it would replace, the suggested text, the proposer's reason and name. A proposal whose `baseRevision` is no longer
  the source's `currentRevision` can no longer be decided.
- **Accept or reject.** Show the proposal first, then `decideProposal` with its `proposalId`, `revision` and
  `decision` (`accept` or `reject`). A rejection needs the person's reason; an acceptance takes their own reason only
  if they give one, never the proposer's. When the confirmation's `baseTags` and `tags` differ, show that change by
  label. Accepting makes the text the source's new current revision, an accepted decision under the person's name,
  charged as one publication; pass `effectiveAt` only if they gave a date.
- **Problem reports.** `list` with `what: "problem_reports"`, then `readSource` to look, and act only if the person
  decides to.
- **Accepting a shared source.** A colleague's newly shared source is reported information until an approver accepts
  it with `setKnowledgeStatus`.
