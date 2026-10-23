---
name: get-started
description: Use when the person wants to get started with OrgSync, has just connected it, asks what OrgSync can do for them, or wants to change their OrgSync choices.
---

Set OrgSync up with the person: a welcome that fits them, three quick choices, then a first useful step. Speak
plainly, with no tool names, field names or IDs, and keep everything before the choices under about 60 words. Refer to
colleagues by name or as "they", never with a pronoun guessed from their name.

1. **Check the connection.** Call `status`; this also finishes the check OrgSync's setup page waits for. If the
   connection was revoked or expired, say they can reconnect from OrgSync's AI apps page, and stop. On another
   failure, say in one line that the setup page may not show the check yet, and go on. Then call free `readPicture`.
2. **Welcome them** by `personName` (without a name if null), with `companyName`, their role, and one line: OrgSync
   keeps what the company decided, so this AI works from that rather than guesses. Then three things it does for them:
   - **Solo** (`coverage` counts one member): keeping their decisions so every chat agrees, goals with a short weekly
     review, and a guide to the next step or first customers. Say "your company brain", not "your team".
   - **Owner or Decision approver in a team:** approving what the team shares, asking or assigning work, the team's week.
   - **Member:** what needs them, the decisions that shape their work, and asking a teammate.
3. **Ask three choices together**, in this app's question form when it has one, otherwise as one numbered list that
   accepts short answers such as "1 goals, 2 offer, 3 brief". Mark the recommended choice. If this app remembers
   earlier choices, show them and ask only what to change.
   1. **Focus** (several allowed): keep my AI on what we decided (recommended); turn my decisions into company
      knowledge; goals and a weekly review; work with my team (teams only); find first customers (when
      `businessProfile` says idea or starting).
   2. **Sharing:** offer to share when I decide something (recommended), or only when I ask. Nothing is shared until
      they approve the exact text.
   3. **Keeping up to date:** a short brief when we start working (recommended), or only when I ask; and a day for the
      weekly review.
4. **Keep the choices.** If this app remembers across chats, offer to save one note, after their yes only: their name,
   role and company, "for company topics, check OrgSync first", and the three choices; no company facts. Otherwise
   follow them for this chat. A weekly reminder email is in OrgSync's web app under Settings, Account.
5. **Take the path that fits**, saying in one line what comes next; stop whenever they want.
   - **Owner or Decision approver of a company not yet covered** (below 6 of 8, or `coverage` absent): bring it in
     with /orgsync:import, starting from what this AI can reach, past chats included.
   - **Joining a covered company:** a short tour from the picture instead: up to three decisions that shape their
     work, the company goals, how we work and anything that needs them. Then offer once to look through their own past
     chats for decisions the company should know (/orgsync:import).
   - Then their Focus: goals lead to "About you"; first customers to /orgsync:guide; the team to /orgsync:request.
6. **About you**, unless they skip it: what they work on now, the result that matters most, and by when, skipping what
   their work profile and `yourFocus` already say. Offer the result as a person goal (/orgsync:goals), linked to a
   company goal when one fits, and to keep project details in this app's memory after their yes. Roles change only in
   OrgSync's web app.
7. **Close** with three lines matched to their Focus, each with what to type (/orgsync:ask, /orgsync:today,
   /orgsync:review or /orgsync:request; in ChatGPT, @OrgSync and the request; in Codex, ask it to use OrgSync), and:
   "/orgsync:feedback any time to tell the OrgSync team what is missing or broken."

This skill shares and saves nothing by itself; imports, goals and requests keep their own confirmations.
