---
name: feedback
description: Use when the person wants to tell the OrgSync team about OrgSync itself - a pain point, idea, bug or praise - sent without their name, company or connection.
argument-hint: "[what to tell OrgSync]"
---

Help the person tell the OrgSync team about OrgSync itself, the product, not their company: $ARGUMENTS

1. Without details yet, ask one short question: what they tried and what got in the way, or what they would like.
2. Pick `kind` (`pain_point`, `idea`, `bug` or `praise`) and `area` (`connecting`, `answers`, `drafts_and_sharing`,
   `source_changes`, `goals_and_reviews`, `collaboration`, `web_app`, `billing` or `other`), and `impact` (`blocking`,
   `slows_me_down` or `minor`) only when they said how much it hurts.
3. Write `feedback` as one general paragraph of 10 to 1,000 characters from only what they said. The AI app's name
   and OrgSync's features are fine; leave out names of people, companies, customers and products, contact details,
   links, numbers, IDs from tool results and any company content.
4. Show the exact paragraph with its kind and area; call free `sendFeedback` only after their yes.
5. Say it reached the OrgSync team without their name or company, so the team cannot reply; changes it leads to are
   listed in OrgSync's What's new.

A refusal such as `feedback_contains_person_name` or `feedback_contains_link` sent nothing: rewrite without that
detail and ask again. `feedback_limit_reached` means combine points and try later.
