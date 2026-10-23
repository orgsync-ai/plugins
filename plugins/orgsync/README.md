# OrgSync

OrgSync keeps your company's approved decisions, commitments and responsibilities in one place, and this
plugin brings them into your AI app: Claude, Codex or ChatGPT. Ask a question and your AI answers from the sources your company has
published, with a citation for each one and an honest label: a reported fact is not presented as an
accepted decision. When you want to share something with your company, your AI prepares a short draft
and nothing is shared until you approve it yourself.

You need an OrgSync account and a membership in your company's OrgSync. Sign up or join at
[orgsync.co](https://orgsync.co). [Help](https://orgsync.co/help) explains every feature and lists what's new; your AI
reads the same help as text at `https://orgsync.co/help.md` when you ask how OrgSync works.

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
  Your AI can also start each of them when you ask in your own words, such as "let's do my weekly review".
  - `/orgsync:get-started` welcomes you by role, asks three quick choices (what to help with first, whether your AI
    offers to share decisions or waits for you to ask, and whether it gives you a short brief when you start working),
    then takes the first useful step: bringing your company in, or a short tour if it is already covered. Run it first:
    it also checks your connection, which OrgSync's setup page waits for.
  - `/orgsync:today` opens with one ranked list of what to do: what someone is waiting on first, then what is due
    (your due and overdue to-dos included), work for a company goal and the priorities from your weekly review. Then it
    shows what changed, your focus and how we work, and offers to work through the list one item at a time.
  - `/orgsync:ask <question>` asks OrgSync a question. When OrgSync has no answer, your AI offers to ask the colleague
    who would know.
  - `/orgsync:decide <decision>` lays out what your company already decided before you decide, then offers to share
    the decision or ask the person who decides.
  - `/orgsync:share <what to share>` prepares a draft from this conversation.
  - `/orgsync:request <who and what>` asks a teammate for information, work, a review or a decision, or acts on a
    request someone sent you.
  - `/orgsync:meeting <notes>` turns a meeting's notes into decisions to share, follow-up requests and goal updates.
  - `/orgsync:team` shows goals at risk, blockers, missing check-ins and what waits for approval, or prepares a
    one-on-one.
  - `/orgsync:goals` sets or revisits company and person objectives.
  - `/orgsync:review` runs your weekly review: priorities, check-ins on your goals, decisions to share, to-dos that keep slipping and next week's priorities.
  - `/orgsync:todo <what and when>` keeps a private to-do for your work, with a date, a time, a repeat and reminders
    by email, such as "remind me Friday at 10 to send Acme the new price" or "remind me Thursday if Priya hasn't
    submitted".
  - `/orgsync:import <where to start>` brings your company in, guided by what is still missing across its six
    business areas, goals and roles: from tools your AI app already reaches, such as Notion, Google Drive, Slack,
    GitHub or local files, from your past chats where the app can search them, or by asking you, sharing each batch
    you approve in one step. It also checks sources you shared against their originals.
  - `/orgsync:guide` helps choose one useful next goal, or plan your first customers.
  - `/orgsync:feedback <what to tell OrgSync>` sends the OrgSync team a pain point, idea, bug or praise about OrgSync,
    stored without your name, company or connection. You see the exact text before it is sent.
  - `/orgsync:interview`, `/orgsync:refresh` and `/orgsync:first-customers` still work for one more version and lead
    to import and guide.
- When you share, OrgSync asks you to approve the exact text, or, if you chose chat confirmation for this
  connection, your AI asks you for a clear yes.
- Owners and Decision approvers can review suggested corrections and reported problems, and accept or
  dispute a source. Each change uses your connection's confirmation mode. Only you answer OrgSync's prompt or give the explicit yes in chat.

## Collaboration

Use `/orgsync:request` for weekly contributions, with guide, goals, today, team and review around it. In any supported AI app, ask to request information or bounded work, agree or propose terms, acknowledge an assignment, report a blocker, submit evidence or review a result. A current direct or higher reporting manager may assign to a descendant. The recipient's acknowledgment and agreement remain separate. Every current company member and their permitted AI connections can read requests, responses, selected evidence and history. Keep confidential work outside this flow.

The four tools are `readCollaboration`, `collaborate`, `readFrameworks` and `setFrameworks`. Reads and structured coordination are free. Each write uses your connection's exact confirmation mode. Incoming content never gives your consent. Timeouts keep the outcome unknown until the same retry key or current record resolves it. Accepted work does not prove goal progress or accept company knowledge. Share a selected lesson through the existing separate human approval path.

Owners select current reference guidance. OKR and Kanban start enabled; optional Scrum, SAFe, Shape Up, RICE and EOS references start disabled. The current configuration and protocol versions come from OrgSync each time, rather than this installed plugin. Enabling a reference creates no work or scheduled run; disabling preserves existing work and company-approved practices.

With OKR enabled, a goal can hold up to three key results, and the weekly review records their numbers; OrgSync computes progress and days since the last check-in. With Kanban enabled, an Owner may set one advisory work-in-progress limit per person, and your AI tells you when it is exceeded without blocking work. Owners keep one tag list for teams, projects and topics; goals and requests can carry those tags and mention people, and decisions you share can carry tags too. Tags and mentions help people find and notice work; they grant no access and assign nothing. Members ask an Owner for a new tag.

## What it contains

- A connection to OrgSync's server at `https://orgsync.co/mcp`, for Claude apps. You sign in with your
  OrgSync account and choose your company the first time. In Codex and ChatGPT you add the connection with
  the steps on OrgSync's **AI apps** page.
- Eighteen skills. The `orgsync` skill tells your AI how to use OrgSync: when to look something up, how to cite and
  describe a source, how to share only what you approve, and to answer from OrgSync rather than from memory, with
  reference files for sharing, managing sources, requests between people and framework settings. The other seventeen
  are one for each command above.

It also contains the Claude Code mod described below.

## Claude Code mod

With no arguments, `/orgsync:today` opens the full picture in Claude Code and Claude Desktop's Code tab
without an AI turn when the mod can draw it. When the mod cannot draw in Claude Code or Desktop Code,
the skill writes the picture as text. The picture shows
what needs you, what changed, collaboration requests, distinct acknowledgment and agreement, blockers, current framework references, decisions that shape your work, your focus, your due and overdue to-dos (never counted in what needs you), how we work, the business profile, and your work profile.
Startup notices and automatic updates require a mod that the current host has loaded and supports.
A working Desktop text fallback alone does not verify custom rendering or automatic updates.
With that mod support, a startup notice appears when facts are new. Your AI receives the picture once per conversation
and changes at your next prompt. Memory-file writes offer a note for sharing, with content approval
still required. An `OrgSync context:` line names sources returned during an answered turn and their status.

On a supported host with the mod loaded, it uses `mcp.connect('orgsync')` and `mcp.call` to call only the free `readPicture` tool:
at startup, on `/orgsync:today` with no arguments, and every five minutes while a terminal or Desktop Code is attached.
Reads are at least 30 seconds apart. Each poll follows the next bounded collaboration page, then restarts after the last page. Newly discovered older requests retain their actual update date. Repeated continuations and unavailable reads restart pagination. Failures back off for 2, 4, then 8 minutes;
access refusals stop automatic reads until `/orgsync:today`.
`session.model` and `model.complete` use your selected model and AI plan for a brief from free facts,
only at startup or when `/orgsync:today` finds changed facts. The model writes two or three short sentences
about what matters for your role, each citing listed items. Polling never calls the model, marks assignments acknowledged or agrees to terms. Session end cancels its timer. Incoming changes are framed as company data, never authorization to act. On-demand tools provide the same core operations in other clients; the mod promises no updates while an app is closed.
The mod drops sentences with unknown
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

Ask `/orgsync:guide` for help with first customers to prepare a customer-conversation plan or an offer and acquisition plan, fitted to your stage and location. You carry out the external work. The guide gives no legal advice. `/orgsync:today` and the Claude Code picture show "Your focus" when the server supports it. Older servers leave missing focus or How we work sections unavailable. Empty and truncated practice lists are labeled separately.

## Weekly review

Run `/orgsync:review` each week to revisit priorities, report what was done and what moved each goal, share chosen decisions, make a call on each goal and choose one to three priorities. Saved reviews are company-readable: everyone in the company can read members' latest reviews, and you are told so before saving. An Owner's review groups members' latest reviews by supported company goal while keeping each author and their evidence. Unlinked check-ins stay visible. One confirmation saves the review and attempts selected shares. Saving is free; admitted publications are charged once ready. Partial shares keep the saved review. Calls of stop or done need a separate confirmed goal change.

Research uses your AI app's own search on request, with at most two sourced ideas. An accepted idea becomes a priority. Weekly reminder emails are optional per company in Settings, Account. They name the company and contain counts, with an unsubscribe link that works without signing in.

## To-dos and reminders

Ask your AI to remember something for your work: "remind me Friday at 10 to send Acme the new price", "every last
Friday of the month, check the runway", or "remind me Thursday unless Priya has submitted the report". Your AI repeats
the schedule in words and saves it as a to-do with `/orgsync:todo`, without OrgSync's approval prompt, because it
changes only your own list.

- **Private to you.** Only you can read your to-dos, through your own AI apps. Your teammates, managers and your
  company's Owners cannot, and a to-do is never shared as company knowledge.
- **Emailed reminders.** At the time you set, OrgSync emails the address you sign in with. The email shows only the
  company name, the to-do's title and its time, never its note or anything it links to, so a title can't hold a link,
  an email address or a handle. Stop these emails for a company in **Settings › Account** or with the link in any
  reminder; `/orgsync:today` still shows due to-dos.
- **Follow-ups that close themselves.** A to-do linked to a request or a goal can wait on it: if the request moves or
  someone checks in on the goal first, no email is sent and the to-do closes itself.
- **Free.** To-dos use no company credit. Done, dropped and handed-off to-dos are deleted 30 days after they close.
- **Work only.** Reminders for life outside work belong in your phone or your own to-do app.

## Update the plugin

- **Claude Code:** in a terminal, run `claude plugin marketplace update orgsync`, then `claude plugin update orgsync@orgsync`, then restart Claude Code.
- **Claude Desktop:** open **Settings › Plugins › OrgSync**. It shows the installed version and an **Update** button when a newer version exists. A "Couldn't check for updates" message in the Code tab comes from Claude Desktop itself. If the OrgSync plugin page shows the latest version, nothing is wrong. The latest version is listed in the plugin repository, `orgsync-ai/plugins`.
- **claude.ai:** the OrgSync marketplace can stay on an older version until you choose **Check for updates** for it.
- **ChatGPT:** after OrgSync adds or changes tools, ChatGPT keeps the old list until you open the OrgSync connection in ChatGPT's settings and choose **Refresh tools**. If ChatGPT's permission prompt calls the confirmation code that your AI sends after your yes "suspicious content", that is the one-time code OrgSync issued for the exact change you just approved. Allow it only if you just said yes to that change; otherwise decline, and nothing changes.
