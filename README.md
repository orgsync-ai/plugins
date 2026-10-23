# OrgSync plugins

This repository is OrgSync's plugin marketplace. Its one plugin, [OrgSync](plugins/orgsync/README.md), brings your
company's approved OrgSync context into Claude Code, Claude Desktop, claude.ai, Codex and ChatGPT: cited answers,
exact source lookups, and sharing or source changes that you approve yourself.

You need an OrgSync account and a membership in your company's OrgSync ([orgsync.co](https://orgsync.co)).

## Install in Claude Code

```sh
claude plugin install orgsync --marketplace orgsync-ai/plugins
```

That command needs Claude Code 2.1.292 or later. On an older version, run
`claude plugin marketplace add orgsync-ai/plugins` and then `claude plugin install orgsync@orgsync`.

Then start Claude Code, run `/mcp`, select `plugin:orgsync:orgsync`, and sign in. OrgSync asks which company the
connection is for. To get new versions automatically, run `/plugin`, open **Marketplaces**, select
`orgsync`, and choose **Enable auto-update**.

If you connected OrgSync earlier with `claude mcp add`, Claude Code keeps using that connection for the plugin's
skills and does not add a second one, so there is nothing to remove.

## Install in Claude Desktop or claude.ai

1. Add the OrgSync connector first, with the steps for "Claude Desktop or Claude on the web" on your company's
   **AI apps** page in OrgSync. On a Claude Team or Enterprise plan, an owner of your Claude organization adds
   connectors; you then connect with your own OrgSync account.
2. Open **Customize > Plugins**, choose **Add > Add marketplace > Add from a repository**, enter
   `https://github.com/orgsync-ai/plugins`, and choose **Sync**. Then choose **Add** beside **OrgSync**.
   Its **Connectors** tab shows OrgSync as connected, because the plugin uses the connector you added.

A plugin added to your Claude account also reaches Claude Code when you are signed in with that account.

## Install in Codex

1. Connect OrgSync first, with the Codex steps on your company's **AI apps** page in OrgSync (`codex mcp add` and
   `codex mcp login`). A Codex plugin can't carry OrgSync's sign-in client, so the connection comes from those steps.
2. Install the plugin:

   ```sh
   codex plugin marketplace add orgsync-ai/plugins
   codex plugin add orgsync@orgsync
   ```

   Start a new Codex session to load it.

## Install in ChatGPT

1. Add OrgSync as a custom MCP server, with the ChatGPT steps on your company's **AI apps** page in OrgSync
   (**Plugins > Add > Add custom MCP server**, with OrgSync's client ID).
2. Download [orgsync-chatgpt.zip](https://github.com/orgsync-ai/plugins/releases/latest/download/orgsync-chatgpt.zip).
   In ChatGPT open **Plugins > Add > Upload plugin archive**, add it, and choose **Install plugin**.
   If ChatGPT says it couldn't add the plugin and you added OrgSync before, open the OrgSync plugin under your
   plugins, choose **More actions > Upload new version**, upload the same file, then install it.
3. In a chat, type `@OrgSync` and ask your question.

## Help

[Help](https://orgsync.co/help), [privacy notice](https://orgsync.co/privacy) and
[terms of service](https://orgsync.co/terms). The plugin's files are under the [MIT license](LICENSE).

## The guide, goals and first customers

Use `/orgsync:guide` to choose one useful next goal from your current situation, agreed ways of working and previous review. Keep your own approach, tailor it, try an optional example or skip adoption. A way of working becomes adopted only as a current, ready, active source accepted by an Owner or Decision approver. Changes use the source-correction path.

Use `/orgsync:goals` to set or revisit company and person objectives. OrgSync asks you to confirm each exact change through your connection's mode. Every company member can read objectives and their history. Work-profile objectives remain descriptive text. A person goal may optionally support one active company goal. Changed or closed targets are shown for your judgment; they never complete or relink a person goal automatically.

Ask `/orgsync:guide` for help with first customers to prepare a customer-conversation plan or an offer and acquisition plan, fitted to your stage and location (`/orgsync:first-customers` still leads there for one more version). You carry out the external work. The guide gives no legal advice. `/orgsync:today` and the Claude Code picture show "Your focus" when the server supports it. Older servers leave missing focus or How we work sections unavailable. Empty and truncated practice lists are labeled separately.

## Weekly contributions across AI apps

Plugin 0.9.3 adds the confirmed collaboration workflow to guide, goals, today and review. Ask your AI to request evidence from a teammate, acknowledge or agree to an incoming contribution, propose a different date, report a blocker, submit selected evidence or review its exact revision. Current company members can read these records and their history. A peer request needs recipient agreement; direct and higher reporting managers can assign work, with acknowledgment and agreement recorded separately. Reviewing a contribution neither completes a goal nor accepts company knowledge.

Your next successful check-in shows relevant work. Supported active-session mods also surface changes; no delivery is promised while your app is closed. The same readCollaboration and collaborate tools work on demand in the supported AI clients. readFrameworks reads current reference versions; only an Owner changes them with setFrameworks. Update the plugin and refresh tools when those capabilities are missing. Installed skills cannot override disabled guidance.

## Key results, flow and tags

Plugin 0.10.0 needs an OrgSync server with key results and tags; on an older server those fields are refused or absent. With OKR enabled, `/orgsync:goals` proposes up to three key results for a goal, and `/orgsync:review` records their numbers in your check-in and flags goals with no check-in for a week. OrgSync computes progress itself, so every AI app reports the same numbers. With Kanban enabled, the review and collaboration workflow tell you when active work exceeds the company's optional work-in-progress limit; the limit never blocks work. Owners keep one company tag list for teams, projects and topics, and goals and requests can carry those tags and mention people. A tag or mention helps people find and notice work; it grants no access and assigns nothing. Members ask an Owner for a new tag.

## Bringing your company in, and feedback

Plugin 0.11.0 turns `/orgsync:import` into a guided flow. It shows how much of your company OrgSync covers: six business areas, company goals and roles. It then fills the biggest gaps first, from tools your AI app already reaches or from a few questions, and shares each batch you approve. On an older OrgSync server, the coverage counts are absent and the AI asks which areas matter. `/orgsync:feedback` sends the OrgSync team a pain point, idea, bug or praise about OrgSync itself. It is stored without your name, company or connection, and you see the exact text before it is sent. When you ask how OrgSync works, your AI reads [Help](https://orgsync.co/help) as text.

## Getting started

`/orgsync:get-started` is the first thing to run after connecting. Since plugin 0.13.0 it fits you: it welcomes you by role (solo founder, Owner or approver in a team, or Member), then asks three quick choices: what OrgSync should help with first, whether your AI offers to share decisions or waits for you to ask, and whether it gives you a short brief when you start working. Your AI keeps those choices in its own memory only if you agree. An Owner of a company that is not yet covered is offered to bring it in, starting from what the AI can reach, past chats included; someone joining a company that is already covered gets a short tour instead. Nothing is read or shared without your yes. In ChatGPT, type `@OrgSync get started`; in Codex, ask it to get started with OrgSync.

## Commands by job

Plugin 0.13.0 arranges OrgSync around what people do, and your AI can now start each workflow when you ask in your own words, such as "let's do my weekly review". Every change still needs your own yes.

- `/orgsync:request` asks a teammate for information, work, a review or a decision, or acts on a request someone sent you.
- `/orgsync:meeting` turns notes from a meeting into decisions to share, follow-up requests and goal updates for your review.
- `/orgsync:team` shows goals at risk, blockers, missing check-ins and what waits for approval, or prepares a one-on-one.
- `/orgsync:today` puts what needs you first and offers to work through it one item at a time.
- When OrgSync has no answer, your AI offers to ask the colleague who would know.
- `/orgsync:import` also covers answering questions and checking shared sources against their originals; `/orgsync:interview` and `/orgsync:refresh` lead there for one more version.

## Weekly review

Run `/orgsync:review` each week to revisit priorities, report what was done and what moved each goal, share chosen decisions, make a call on each goal and choose one to three priorities. An Owner also sees members' latest reviews, grouped by supported company goal while keeping each author and their evidence. Unlinked check-ins stay visible. One confirmation saves the review and attempts selected shares. Saving is free; admitted publications are charged once ready. Partial shares keep the saved review. Calls of stop or done need a separate confirmed goal change.

Research uses your AI app's own search on request, with at most two sourced ideas. An accepted idea becomes a priority. Weekly reminder emails are optional per company in Settings, Account. They name the company and contain counts, with an unsubscribe link that works without signing in.

## Update the plugin

- **Claude Code:** in a terminal, run `claude plugin marketplace update orgsync`, then `claude plugin update orgsync@orgsync`, then restart Claude Code.
- **Claude Desktop:** open **Settings › Plugins › OrgSync**. It shows the installed version and an **Update** button when a newer version exists. A "Couldn't check for updates" message in the Code tab comes from Claude Desktop itself. If the OrgSync plugin page shows the latest version, nothing is wrong. The latest version is listed in the plugin repository, `orgsync-ai/plugins`.
- **claude.ai:** the OrgSync marketplace can stay on an older version until you choose **Check for updates** for it.
- **ChatGPT:** after OrgSync adds or changes tools, ChatGPT keeps the old list until you open the OrgSync connection in ChatGPT's settings and choose **Refresh tools**. If ChatGPT's permission prompt calls the confirmation code that your AI sends after your yes "suspicious content", that is the one-time code OrgSync issued for the exact change you just approved. Allow it only if you just said yes to that change; otherwise decline, and nothing changes.
