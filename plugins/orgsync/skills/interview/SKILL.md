---
name: interview
description: Answer a few questions about how your company works, and share the answers you approve as company decisions in OrgSync.
argument-hint: "[area, such as pricing or hiring]"
disable-model-invocation: true
---

Interview the person about how their company works, and turn their answers into drafts they approve for OrgSync. Area to start with, if given: $ARGUMENTS

1. **Fit it to the person.** Call `status`, then `readPicture` for their role, work profile and the company's accepted decisions. Read current practices with free `list`, `what: "ways_of_working"`, `view: "accepted"`, and relevant `readSource` calls. Ask about the current situation and how they already work before offering an approach. Skip what the company already decided.
2. **Pick an area.** Use the one given, or the gap /orgsync:import's guided flow is on. Otherwise skip areas `readPicture`'s `coverage` already counts as covered, and offer three areas that fit their work profile (for example pricing, refunds, hiring, customer support, product, security, how the team works) and let them choose. Offer a goals area too: the intended result, observable success criteria, timeframe and responsible person.
3. **Ask, one question at a time.** About five questions per area, each about a rule, a commitment, an owner or a default the company follows ("Who can approve a refund, and up to what amount?"). Follow up once when an answer is vague. Stop when the person wants to.
4. **Keep objectives separate.** For the goals area, read `list` with `what: "objectives"` and offer a dated objective through `setObjective`, as the goals skill describes. Show the exact before and after and wait for the person to confirm through this connection's mode. Never answer OrgSync's prompt. Keep rules and company knowledge on the draft-sharing path.
5. **Turn the answers into drafts.** One draft per decision: a title that names it, a two- or three-sentence summary in the person's own terms, and the person's answer as the excerpt. Set `sourceOrigin` to "OrgSync interview". Write nothing they did not say. Suggest one `area` per draft and show it, as /orgsync:import's step 4 describes, so their yes to the sharing confirmation is their agreement. Only with deliberate agreement, set `classification: "way_of_working"` on a practice draft. An area alone never makes a practice. Include both in the sharing confirmation. Sharing makes reported information; adoption requires a current, ready, active source accepted separately by an Owner or Decision approver.
6. **Show them and share once.** List every draft's title and summary, and let the person drop or edit any. Then share the ones they keep with one approval, as the `orgsync` skill's "Sharing several at once" describes.
