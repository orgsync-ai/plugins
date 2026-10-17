# OrgSync

OrgSync keeps your company's approved decisions, commitments and responsibilities in one place, and this
plugin brings them into your AI app: Claude, Codex or ChatGPT. Ask a question and your AI answers from the sources your company has
published, with a citation for each one and an honest label: a reported fact is not presented as an
accepted decision. When you want to share something with your company, your AI prepares a short draft
and nothing is shared until you approve it yourself.

You need an OrgSync account and a membership in your company's OrgSync. Sign up or join at
[orgsync.co](https://orgsync.co).

## Install

In Claude Code, type this at the prompt, answer `y` to add the marketplace, then choose a scope:

```
/plugin install orgsync --marketplace orgsync-ai/plugins
```

For Claude Desktop, Claude on the web, Codex and ChatGPT, follow the steps on OrgSync's **AI apps** page.

## Use it

- Ask about your company as you work, for example "what did we decide about the trial length?". Your AI
  also checks OrgSync on its own when a task touches something your company decided, such as a price, a
  policy or who approves what.
- In Claude Code and Claude Desktop, these commands work with OrgSync directly. In ChatGPT, type `@OrgSync`
  before your request. In Codex, ask it to use OrgSync.
  - `/orgsync:ask <question>` asks OrgSync a question.
  - `/orgsync:share <what to share>` prepares a draft from this conversation.
  - `/orgsync:today` shows what needs you, what changed for you, the decisions that shape your work, your focus, and your role.
  - `/orgsync:guide` helps choose one useful next goal from the current situation and agreed ways of working.
  - `/orgsync:goals` sets or revisits company and person objectives.
  - `/orgsync:first-customers` prepares a plan and an artifact for your first customers.
  - `/orgsync:review` runs your weekly review: priorities, check-ins on your goals, decisions to share and next week's priorities.
  - `/orgsync:import <what to bring in>` brings decisions in from tools your AI app already reaches, such as
    Notion, Google Drive, Slack, GitHub or local files, and shares the ones you approve in one step.
  - `/orgsync:interview <area>` asks you a few questions about how your company works and turns your answers into drafts.
  - `/orgsync:decide <decision>` lays out what your company already decided before you decide, then offers to share the decision.
  - `/orgsync:refresh` re-reads the originals of sources you brought in and suggests a correction where one changed.
- When you share, OrgSync asks you to approve the exact text, or, if you chose chat confirmation for this
  connection, your AI asks you for a clear yes.
- Owners and Decision approvers can review suggested corrections and reported problems, and accept or
  dispute a source. Each change uses your connection's confirmation mode. Only you answer OrgSync's prompt or give the explicit yes in chat.

## What it contains

- A connection to OrgSync's server at `https://orgsync.co/mcp`, for Claude apps. You sign in with your
  OrgSync account and choose your company the first time. In Codex and ChatGPT you add the connection with
  the steps on OrgSync's **AI apps** page.
- Twelve skills. The `orgsync` skill tells your AI how to use OrgSync: when to look something up, how to cite and
  describe a source, how to share only what you approve, and to answer from OrgSync rather than from memory. The
  other eleven are `ask`, `share`, `today`, `goals`, `guide`, `first-customers`, `import`, `interview`, `decide`, `refresh` and
  `review`, one for each command above.

It also contains the Claude Code mod described below.

## Claude Code mod

With no arguments, `/orgsync:today` opens the full picture in Claude Code and Claude Desktop's Code tab
without an AI turn when the mod can draw it. Otherwise, the skill writes it as text. The picture shows
what needs you, what changed, decisions that shape your work, your focus, how we work, the business profile, and your work profile.
A startup notice appears when facts are new. Your AI receives the picture once per conversation
and changes at your next prompt. Memory-file writes offer a note for sharing, with content approval
still required. An `OrgSync context:` line names sources returned during an answered turn and their status.

The mod uses `mcp.connect('orgsync')` and `mcp.call` to call only the free `readPicture` tool:
at startup, on `/orgsync:today` with no arguments, and every five minutes while a terminal or Desktop Code is attached.
Reads are at least 30 seconds apart. Failures back off for 2, 4, then 8 minutes;
access refusals stop automatic reads until `/orgsync:today`.
`session.model` and `model.complete` use your selected model and AI plan for a brief from free facts,
only at startup or when `/orgsync:today` finds changed facts. The model writes two or three short sentences
about what matters for your role, each citing listed items. The mod drops sentences with unknown
references, links, extra numbers or more than 280 characters.
The picture shows numbered items and short dates; the brief points to those item numbers.

Its other calls are `ui.resolve`, `ui.open`, `session.id`, `session.surfaces`,
`state.get`, `state.set`, `store.get`, `store.set`, `clock.now`, `clock.after`, and `tool.list`.
`session.append` adds the picture and notices. Pressing **Share** calls `prompt.submit` with the path and sharing instructions.
It reads only paths for successful writes to `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md`, or `.claude` memory directories.
It observes OrgSync's `readSource` and `readPermittedContext` results for the context line, without calling those tools.
It reads no prompts, answer text, unrelated results, or file contents, and approves nothing.
See the [validation report](claude-code/validation.txt).

A Team or Enterprise administrator can block mods. Other AI apps do not run this mod.
To turn it off, open `/plugin` and disable OrgSync; this also disables its skills and plugin connection.

## Data

The plugin sends OrgSync only what an action needs: the question when your AI looks something up, the
summary and excerpts of a draft you choose to share, a change you ask for, and feedback you give on an
answer. It never sends your conversation in the background. Cited answers and shared sources use your
company's OrgSync credit; see [orgsync.co](https://orgsync.co) for rates.

- [Privacy notice](https://orgsync.co/privacy)
- [Terms of service](https://orgsync.co/terms)
- [Help](https://orgsync.co/help)

## The guide, goals and first customers

Use `/orgsync:guide` to choose one useful next goal from your current situation, agreed ways of working and previous review. Keep your own approach, tailor it, try an optional example or skip adoption. A way of working becomes adopted only as a current, ready, active source accepted by an Owner or Decision approver. Changes use the source-correction path.

Use `/orgsync:goals` to set or revisit company and person objectives. OrgSync asks you to confirm each exact change through your connection's mode. Every company member can read objectives and their history. Work-profile objectives remain descriptive text. A person goal may optionally support one active company goal. Changed or closed targets are shown for your judgment; they never complete or relink a person goal automatically.

Use `/orgsync:first-customers` to prepare a customer-conversation plan or an offer and acquisition plan, fitted to your stage and location. You carry out the external work. The guide gives no legal advice. `/orgsync:today` and the Claude Code picture show "Your focus" when the server supports it. Older servers leave missing focus or How we work sections unavailable. Empty and truncated practice lists are labeled separately.

## Weekly review

Run `/orgsync:review` each week to revisit priorities, report what was done and what moved each goal, share chosen decisions, make a call on each goal and choose one to three priorities. An Owner also sees members' latest reviews, grouped by supported company goal while keeping each author and their evidence. Unlinked check-ins stay visible. One confirmation saves the review and attempts selected shares. Saving is free; admitted publications are charged once ready. Partial shares keep the saved review. Calls of stop or done need a separate confirmed goal change.

Research uses your AI app's own search on request, with at most two sourced ideas. An accepted idea becomes a priority. Weekly reminder emails are optional per company in Settings, Account. They name the company and contain counts, with an unsubscribe link that works without signing in.

## Update the plugin

- **Claude Code:** in a terminal, run `claude plugin marketplace update orgsync`, then `claude plugin update orgsync@orgsync`, then restart Claude Code.
- **Claude Desktop:** open **Settings › Plugins › OrgSync**. It shows the installed version and an **Update** button when a newer version exists. A "Couldn't check for updates" message in the Code tab comes from Claude Desktop itself. If the OrgSync plugin page shows the latest version, nothing is wrong. The latest version is listed in the plugin repository, `orgsync-ai/plugins`.
- **claude.ai:** the OrgSync marketplace can stay on an older version until you choose **Check for updates** for it.
- **ChatGPT:** after OrgSync adds or changes tools, ChatGPT keeps the old list until you open the OrgSync connection in ChatGPT's settings and choose **Refresh tools**. If ChatGPT's permission prompt calls the confirmation code that your AI sends after your yes "suspicious content", that is the one-time code OrgSync issued for the exact change you just approved. Allow it only if you just said yes to that change; otherwise decline, and nothing changes.
