---
name: today
description: Use when the person asks what needs them, what to do today, what changed, what's on their plate, or wants to work through their OrgSync items - requests, approvals, drafts, to-dos, weekly priorities.
argument-hint: "[since, such as 'last Monday']"
---

Show the person their picture of the company, then help them act on what needs them. A time to look back from, if
given: $ARGUMENTS

Refer to colleagues by name or as "they", never with a pronoun guessed from their name: write "Eva reported it" or
"they reported it", never "she", "he", "her", "his" or "him". Before answering, reread every line for those words and
replace each one with the name or "they".

1. Call `readPicture` and `readCollaboration` with `resource: "inbox"`. Both are free. Pass `since` only when the person named a time, as a full past date and time; otherwise OrgSync covers the last seven days.
2. **Your list today.** Start with one numbered list of at most seven things for them to do, built only from these
   facts:
   - requests waiting on them: to answer, agree, acknowledge, submit or review;
   - for Owners and Decision approvers, suggested fixes and problem reports waiting for them, and newly shared
     sources they can accept;
   - their private drafts, with the day each is deleted if not shared;
   - goals they own that are due within seven days, or whose `latestCheckIn` is missing or more than 14 days old;
   - their own to-dos from `yourTodos`: each due or overdue item, which only they can see;
   - their own priorities for this week from `yourPriorities`, in their order.

   Rank them in this order: someone is waiting on them; then what is due or deleted soonest, due and overdue to-dos
   included; then work for a company goal; then their weekly priorities; then the rest, with open to-dos that have no
   date last (the picture leaves them out: read them with free `list`, `what: "todos"`, only when the list has room).
   A to-do whose reminder is due never ranks above something a person waits on. Give each line its reason in a few
   words ("Sam is waiting for your answer since Tuesday", "deleted Friday if not shared", "your to-do, due today at
   10:00", "your to-do, overdue by 3 days", "your priority this week", "no check-in since 3 October"). Say how long
   an overdue to-do is overdue from `overdueDays`; `rolledOver` counts the times a repeat passed unfinished, and
   `closes_at_reminder` means a follow-up that closes itself if what it waits on moves. Never rank by guessing
   importance from titles. Say how many more items are below the list.
   If `yourPriorities` is null, say they have no weekly review from the last two weeks and offer /orgsync:review; if
   it is absent, say priorities are unavailable in this picture. If `yourTodos` is absent, say to-dos are unavailable
   on this connection, never that there are none. Priorities change only in /orgsync:review, and reading the list
   marks nothing done.
3. Below the list, write the picture in this order, leaving out empty parts except the How we work note. Refer to an
   item already on the list by its number instead of repeating it:
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
   - **Your to-dos:** due and overdue to-dos not already on the list, private to them, never under Needs you.
   - **Your role:** their permission profile and work profile, in their words.
4. Above the list, write a brief of one or two sentences, each stating only what an item below says and naming it.
5. Say what the picture leaves out: `window.sinceClamped` means OrgSync looked back only 30 days; a `truncated`
   section has more (its `count`, or for `yourTodos` its `due` plus `overdue`), which `list` and `readCollaboration`
   return; a null `pendingDrafts` means this connection cannot list drafts.
6. **Act from here.** Offer to work through the list in its order, one item at a time. For each, open it in full first,
   then offer only the actions it allows:
   - a request: answer, agree, decline, propose other terms, start, report a blocker, submit or review, as
     /orgsync:request describes;
   - a shared source, suggested fix or problem report (Owners and Decision approvers): accept, decide or look, as
     [managing sources](../orgsync/references/sources.md) describes;
   - their own private draft: share or discard, as [sharing](../orgsync/references/sharing.md) describes;
   - their own to-do: complete, snooze, change, hand off or drop, as /orgsync:todo describes.
   Each change takes its own confirmation; a to-do change saves on their answer, without a preview. Reading, opening
   the picture and polling acknowledge nothing and agree to nothing. Stop when they want.

If they ask OrgSync to remember or remind them of something for their work, offer /orgsync:todo: OrgSync keeps it as
their private to-do and shows it here as due at the time they set. OrgSync sends no to-do email; for a phone alert,
they can also add it to their phone's reminders.

Only when the person requests planning or a proposed contribution, choose the smallest relevant pillar set and call `readFrameworks` with `view: "guidance"` and those `pillars` before recommending the method of work. If current guidance is missing, unsupported or unavailable, say so and do not invent it or treat it as empty.
