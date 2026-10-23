---
name: get-started
description: Start using OrgSync - a short welcome and three quick choices, then bringing your company in and a few questions about you and your work.
disable-model-invocation: true
---

Welcome the person to OrgSync and set it up with them through three quick choices. Speak plainly throughout: no tool names, field names, IDs or technical terms.

1. **Check the connection.** Call `status`. This also finishes the check that OrgSync's setup page is waiting for. If it is denied because the connection was revoked or expired, say they can reconnect from OrgSync's AI apps page, and stop. If it fails for another reason, say in one line that the setup page may not show the check yet, and go on. Then call `readPicture`, which is free. Don't show the picture.
2. **Welcome them in two or three sentences.** Greet them by `personName` (if null, greet without a name), say they're connected to `companyName` as an Owner, a Decision approver or a Member, and say in one sentence what OrgSync does: it keeps what their company decided, so this AI works from that rather than from guesses.
3. **Ask three questions at once.** If this app can ask multiple-choice questions in a form, use it for all three together. Otherwise ask them as one short numbered list in chat and accept short answers such as "1 now, 2 offer, 3 later". Mark the recommended choice in each.
   1. **Bring your company in:** now or later. Recommend now when `coverage` counts fewer than 6 of 8 covered or is absent. When 6 or more are covered, say the company is mostly in already and recommend later.
   2. **Sharing with your company:** "Offer to share when I decide something" (recommended) or "Only when I ask, with /orgsync:share". Say that either way nothing is shared until they approve it. Offer no automatic choice: OrgSync shares nothing without the person approving the exact text.
   3. **About you and your work:** a few questions about your projects and goals, now (recommended) or later.
4. **Keep the sharing choice.** If this app can remember preferences across chats, offer to save the choice there, and save it only after their yes; otherwise follow it for this chat. OrgSync doesn't store it. With "Only when I ask", don't offer to share during work; the person uses /orgsync:share and still approves each share.
5. **Do what they chose, in this order.** First bring the company in, as the `orgsync` skill's "Bringing the company in" describes. Then follow its "About you and your work". Before each, say in one line what comes next, and stop whenever they want. For each one they put off, say how to start it later: /orgsync:import or /orgsync:interview; in ChatGPT, @OrgSync and the request; in Codex, ask it to use OrgSync.
6. **Close with what they can do.** Three or four short lines, each with an example of what to type: ask about anything the company decided ("What's our refund policy?"), see what needs them today, set or check a goal, and run a weekly review. Where this app has slash commands, add each line's command once: /orgsync:ask, /orgsync:today, /orgsync:goals and /orgsync:review.

Keep everything before the questions under about 60 words. This skill shares and saves nothing by itself. The import and the interview follow their own steps, and every share or goal uses this connection's confirmation mode: only the person answers OrgSync's prompt or gives the yes in chat.
