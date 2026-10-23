---
name: today
description: Use when the person asks what needs them, what changed, what's on their plate, or wants to work through their OrgSync items - requests, approvals, drafts.
argument-hint: "[since, such as 'last Monday']"
---

Show the person their picture of the company, then help them act on what needs them. A time to look back from, if
given: $ARGUMENTS

1. Call `readPicture` and `readCollaboration` with `resource: "inbox"`. Both are free. Pass `since` only when the person named a time, as a full past date and time; otherwise OrgSync covers the last seven days.
2. Write the picture in this order, leaving out empty parts except the How we work note:
   - **Needs you:** collaboration that needs them, then each other item with why it is theirs ("you approve changes
     to it", "your draft is deleted on Friday if not shared", "Eva shared it as reported information; you can accept
     it as a company decision"). Keep a request's author, recipient, mode, acknowledgment and agreement separate.
   - **Waiting and blocked:** work they wait for and unresolved blockers.
   - **Changed for you:** newest first: what changed, who changed it and when.
   - **Decisions that shape your work:** with who accepted them and when.
   - **Your focus:** active goals from `yourFocus` with dates, owners, the company goal each supports (say if it
     changed or closed), and each nullable `latestCheckIn` as reported by its author. A missing check-in means no
     report yet.
   - **How we work:** adopted practices from `howWeWork`; absent means unavailable, a zero count means none. For
     references, use the picture's `frameworkSummary`: enabled reference titles, custom-pillar availability and, when
     present, the tag count and work-in-progress limit. On an older picture, use `frameworkConfig` if present. If both fields are absent, say reference guidance is unavailable in this picture, not disabled or empty.
   - **Your role:** their permission profile and work profile, in their words.
3. Above these, write a brief of two or three sentences, each stating only what an item below says and naming it.
4. Say what the picture leaves out: `window.sinceClamped` means OrgSync looked back only 30 days; a `truncated`
   section has more (its `count`), which `list` and `readCollaboration` return; a null `pendingDrafts` means this
   connection cannot list drafts.
5. **Act from here.** Offer to work through the items that need them, one at a time. For each, open it in full first,
   then offer only the actions it allows:
   - a request: answer, agree, decline, propose other terms, start, report a blocker, submit or review, as
     /orgsync:request describes;
   - a shared source, suggested fix or problem report (Owners and Decision approvers): accept, decide or look, as
     [managing sources](../orgsync/references/sources.md) describes;
   - their own private draft: share or discard, as [sharing](../orgsync/references/sharing.md) describes.
   Each change takes its own confirmation. Reading, opening the picture and polling acknowledge nothing and agree to
   nothing. Stop when they want.

Only when the person requests planning or a proposed contribution, choose the smallest relevant pillar set and call `readFrameworks` with `view: "guidance"` and those `pillars` before recommending the method of work. If current guidance is missing, unsupported or unavailable, say so and do not invent it or treat it as empty.
