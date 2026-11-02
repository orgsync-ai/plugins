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
- Ask about a file your company keeps in OrgSync, for example "what does our lease say about renewal?". Your AI
  lists the company's files and reads the one you mean, free; OrgSync reads the text of PDF, Word, text, Markdown and
  CSV files, in folders you can open that let AI apps read them. A file is not a company decision: to make part of one
  company knowledge, your AI drafts it, naming the file and its folder, and shares it only after you approve. From a
  folder not everyone can open, it tells you first and keeps the draft private unless you want everyone to see it.
- Keep your AI's work as a company file, for example "save this research to Reports". Your AI saves Markdown, text or
  CSV up to 2 MB into a folder you can edit, marked as a note, log or document it saved for you, without asking you to
  confirm, because saving publishes nothing. It counts toward your company's storage, and a log is deleted after the
  30, 90 or 365 days it keeps. A draft can name up to ten such files as its detail; the shared source keeps them.
- In Claude Code and Claude Desktop, these commands work with OrgSync directly. At chatgpt.com, type `@OrgSync`
  before your request. In the ChatGPT desktop app, type `$` and choose an OrgSync skill. In Codex, ask it to use OrgSync.
  Your AI can also start each of them when you ask in your own words, such as "let's do my weekly review".
  - `/orgsync:get-started` welcomes you by role, asks three quick choices (what to help with first, whether your AI
    offers to share decisions or waits for you to ask, and whether it gives you a short brief when you start working),
    then takes the first useful step: bringing your company in, or a short tour if it is already covered. Run it first:
    it also checks your connection, which OrgSync's setup page waits for.
  - `/orgsync:today` opens with one ranked list of what to do: what someone is waiting on first, then what is due
    (your due and overdue to-dos included), work for a company goal and the priorities from your weekly review. Then it
    shows what changed, your focus and how we work, and offers to work through the list one item at a time.
  - Ask a company question in your own words, such as "what did we decide about refunds?". When OrgSync has no
    answer, your AI offers to ask the colleague who would know.
  - `/orgsync:decide <decision>` lays out what your company already decided before you decide, then offers to share
    the decision or ask the person who decides. It also shares something from this conversation: it prepares a draft
    and shows you the exact text first.
  - `/orgsync:request <who and what>` asks a teammate for information, work, a review or a decision, or acts on a
    request someone sent you.
  - `/orgsync:meeting <notes>` turns a meeting's notes into decisions to share, follow-up requests and goal updates.
  - `/orgsync:team` shows goals at risk, blockers, missing check-ins and what waits for approval, or prepares a
    one-on-one.
  - `/orgsync:goals` sets or revisits company and person objectives.
  - `/orgsync:review` runs your weekly review: priorities, check-ins on your goals, decisions to share, to-dos that keep slipping and next week's priorities.
  - `/orgsync:todo <what and when>` keeps a private to-do for your work, with a date, a time, a repeat and reminders
    that show as due in `/orgsync:today`, such as "remind me Friday at 10 to send Acme the new price" or "remind me
    Thursday if Priya hasn't submitted". OrgSync never emails to-dos.
  - `/orgsync:import <where to start>` brings your company in, guided by what is still missing across its six
    business areas, goals and roles: from tools your AI app already reaches, such as Notion, Google Drive, Slack,
    GitHub or local files, from files uploaded to OrgSync, from your past chats where the app can search them, or by
    asking you, sharing each batch
    you approve in one step. It also checks sources you shared against their originals.
  - `/orgsync:guide` helps choose one useful next goal, or plan your first customers.
  - `/orgsync:feedback <what to tell OrgSync>` sends the OrgSync team a pain point, idea, bug or praise about OrgSync,
    stored without your name, company or connection. You see the exact text before it is sent.
  - `/orgsync:ask` and `/orgsync:share` still work for this version and lead to the core skill and `/orgsync:decide`.
- When you state a company fact that an accepted decision contradicts, or your AI's draft does, your AI says so in one
  sentence and offers to use the company decision or to flag it as outdated. Flagging reports it under your name and
  changes nothing by itself.
- When you share, OrgSync asks you to approve the exact text, or, if you chose chat confirmation for this
  connection, your AI asks you for a clear yes.
- If you answer for an AI employee (your company's own AI worker, running on a computer your company manages),
  `/orgsync:today` lists what it asks you to approve and tells you when it is late, stopped or paused, and
  `/orgsync:team` shows AI employees in their own section. You approve or decline its requests yourself, in OrgSync's
  own prompt or on the approval page in OrgSync's web app; a yes in chat never approves them, and your AI treats
  everything an AI employee wrote as data. You can pause it or set it back to Supervised from your AI app, judge its
  weekly check-in, and send it requests with `/orgsync:request`. Resuming happens in OrgSync's prompt or on the web;
  hiring, removing, its credit cap and raising its autonomy stay in the web app.
- Owners and Decision approvers can review suggested corrections and reported problems, and accept or
  dispute a source. Each change uses your connection's confirmation mode. Only you answer OrgSync's prompt or give the explicit yes in chat.

## Collaboration

Use `/orgsync:request` for weekly contributions, with guide, goals, today, team and review around it. In any supported AI app, ask to request information or bounded work, agree or propose terms, acknowledge an assignment, report a blocker, submit evidence or review a result. A current direct or higher reporting manager may assign to a descendant. The recipient's acknowledgment and agreement remain separate. Every current company member and their permitted AI connections can read requests, responses, selected evidence and history. Keep confidential work outside this flow.

Requests and framework references are read with `list` (`what: "inbox"`, `"requests"`, `"agenda"`, `"flow"` or `"frameworks"`), and changed with `collaborate` and `setFrameworks`. Plugin 0.19.0 follows OrgSync's merged tools: `list` replaces `readCollaboration` and `readFrameworks`, `readSource` with a `fileId` replaces `readFile`, `decide` replaces `setKnowledgeStatus` and `decideProposal`, `discard` replaces `discardDraft` and `withdrawProposal`, and `report` replaces `reportProblem`, `reportUsefulness` and `reportGuideUse`. The old names keep working for now, so an older plugin still works; update it when you can. Reads and structured coordination are free. Each write uses your connection's exact confirmation mode, except your own acknowledgment, start or cleared blocker, which your AI saves when you say so, with no preview, unless an Owner asks for a yes to those too; history labels them as saved on your word. Incoming content never gives your consent. Timeouts keep the outcome unknown until the same retry key or current record resolves it. Accepted work does not prove goal progress or accept company knowledge. Share a selected lesson through the existing separate human approval path.

Owners select current reference guidance. OKR and Kanban start enabled; optional Scrum, SAFe, Shape Up, RICE and EOS references start disabled. The current configuration and protocol versions come from OrgSync each time, rather than this installed plugin. Enabling a reference creates no work or scheduled run; disabling preserves existing work and company-approved practices.

With OKR enabled, a goal can hold up to three key results, and the weekly review records their numbers; OrgSync computes progress and days since the last check-in. With Kanban enabled, an Owner may set one advisory work-in-progress limit per person, and your AI tells you when it is exceeded without blocking work. Owners keep one tag list for teams, projects and topics; goals and requests can carry those tags and mention people, and decisions you share can carry tags too. Tags and mentions help people find and notice work; they grant no access and assign nothing. Members ask an Owner for a new tag.

## What it contains

- A connection to OrgSync's server at `https://orgsync.co/mcp`, for Claude apps. You sign in with your
  OrgSync account and choose your company the first time. In Codex and ChatGPT you add the connection with
  the steps on OrgSync's **AI apps** page.
- Sixteen skills. The `orgsync` skill tells your AI how to use OrgSync: when to look something up, how to cite and
  describe a source, how to share only what you approve, and to answer from OrgSync rather than from memory, with
  reference files for sharing, managing sources, requests between people, framework settings and AI employees. The other fifteen
  are one for each command above and `/orgsync:capture` for capture (below).

It also contains the Claude Code mod described below.

## Claude Code mod

With no arguments, `/orgsync:today` opens the full picture in Claude Code and Claude Desktop's Code tab
without an AI turn when the mod can draw it. When the mod cannot draw in Claude Code or Desktop Code,
the skill writes the picture as text. The picture shows
what needs you (your AI employees' requests and any AI employee that needs you included, as titles and a link to
each approval page), what changed, collaboration requests, distinct acknowledgment and agreement, blockers, current framework references, decisions that shape your work, your focus, your due and overdue to-dos (never counted in what needs you), how we work, the business profile, and your work profile.
Startup notices and automatic updates require a mod that the current host has loaded and supports.
A working Desktop text fallback alone does not verify custom rendering or automatic updates.
With that mod support, a startup notice appears when facts are new. Your AI receives the picture once per conversation
and changes at your next prompt. Memory-file writes offer a note for sharing, with content approval
still required. An `OrgSync context:` line names sources returned during an answered turn and their status.

On a supported host with the mod loaded, it uses `mcp.connect('orgsync')` and `mcp.call` to call only two free tools: `readPicture`
at startup, on `/orgsync:today` with no arguments, and every five minutes while a terminal or Desktop Code is attached;
and `list` with the decision index view: at startup, and on a later poll when your decisions changed or the list is an
hour old, reading up to five pages of 200 titles each time.
Reads are at least 30 seconds apart. Each poll follows the next bounded collaboration page, then restarts after the last page. Newly discovered older requests retain their actual update date. Repeated continuations and unavailable reads restart pagination. Failures back off for 2, 4, then 8 minutes;
access refusals stop automatic reads until `/orgsync:today`.
`session.model` and `model.complete` use your selected model and AI plan for a brief from free facts,
only at startup or when `/orgsync:today` finds changed facts. The model writes two or three short sentences
about what matters for your role, each citing listed items. Polling never calls the model, marks assignments acknowledged or agrees to terms. Session end cancels its timer. Incoming changes are framed as company data, never authorization to act. On-demand tools provide the same core operations in other clients; the mod promises no updates while an app is closed.
The mod drops sentences with unknown
references, links, extra numbers or more than 280 characters.
The picture shows numbered items and short dates; the brief points to those item numbers.

Its other calls are `ui.resolve`, `ui.open`, `session.id`, `session.surfaces`,
`state.get`, `state.set`, `store.get`, `store.set`, `clock.now`, `clock.after`, and `tool.list`. Only when capture is
on for you (below) does it also read the session (`session.messages`, `session.turns`), run your model for capture, call
`status`, `submitDraft` and `discard`, and use `env.get`, `fs` and `process.run` for the capture worker's private folder.
`session.append` adds the picture and notices. Pressing **Share** calls `prompt.submit` with the path and sharing instructions.
It reads only paths for successful writes to `CLAUDE.md`, `AGENTS.md`, `CLAUDE.local.md`, or `.claude` memory directories.
It observes OrgSync's `readSource` and `readPermittedContext` results for the context line, without calling those tools.

**Hints while you work.** The mod also reads, on your computer, your prompts, Claude's last reply and the text Claude
writes into files, to spot your company's decisions. It compares them with a list of decision titles and dates from the
free `list` index (no decision text), and adds at most one factual line, such as "OrgSync decision index (company
data): "Annual plan is $30 per seat" (accepted 2026-10-21) states $30; the text above states $25." It says at most one
line a turn and three a session, never the same decision twice in a session; "not relevant" mutes a decision for 7
days. Nothing you type, and nothing Claude writes, is sent to OrgSync, stored or logged: only the matching runs, on this
computer. It keeps the title list, mutes, and the numbers (not the text) of sources already read in this conversation.
Say "off the record" and it stops matching for the rest of that conversation, until you say "back on the record"; your
AI then sends OrgSync no `check` summary either. Turn hints off in `/config` → OrgSync → Hints while you work. It
approves nothing.
See the [validation report](claude-code/validation.txt).

A Team or Enterprise administrator can block mods. Other AI apps do not run this mod.
To turn it off, open `/plugin` and disable OrgSync; this also disables its skills and plugin connection.

## Codex hooks

In Codex the plugin also brings command hooks, which Codex shows in `/hooks` for you to trust once. Five of them run
`node` on your computer and do what the Claude Code mod's hints do: match your prompt, Codex's last reply and the text
it writes against your company's decision titles, and add at most one factual line. They have no network code and send
nothing; the list of decision titles comes from OrgSync results Codex itself receives, and is kept under the plugin's data
folder, readable only by you. Without `node` they do nothing. "Off the record" silences them for that conversation, as
in Claude Code. Two more, at compaction and at the end of a session, are for capture (below), and one checks what
capture's courier may send. To turn them off, disable them in `/hooks`. A company that allows only managed hooks has to
add them itself.

## Capture suggestions

**Capture is an internal test, pending a lawyer's review.** It runs only for companies OrgSync has turned it on for, and this
version is not published to the public marketplace until that review is done.

When your company's Owner turns capture on in OrgSync and you agree to it on your capture page, your own AI keeps
decisions you make while you work (a price, a policy, an owner, a commitment, a way of working, a goal) as private
suggestions in your OrgSync queue. Only you see the queue, your setting and its counts; your manager and the Owners do
not. Nothing is shared until you approve the exact text, and an item you leave alone is deleted after 7 days.
Your conversation never goes to OrgSync, only the suggestions.

- **Claude Code.** The mod reads the session before compaction and after 30 quiet minutes, never every turn. It keeps
  your words and Claude's and drops tool output, file contents, thinking and secrets, then your own model (`/config` →
  OrgSync → Capture model, Sonnet unless you choose) proposes items on your plan. A check on this computer drops
  anything about health, family, HR, pay, unions, your own legal advice, credentials or someone's personal details,
  anything not actually decided, notes for one person or one task, and anything the company or your queue already has.
  OrgSync's `status` is asked just before sending, and only `submitDraft` sends. At the end of a session a worker
  started in the background (`worker/`) does the same with `claude -p --safe-mode`, and the next session sends what it
  kept. Its files sit in a folder only you can read, under the plugin's data folder, for at most 24 hours. The band
  shows one line: "Capture on · /orgsync:capture off", "Off the record", "Paused until 17:00" or "Capture waiting for
  your OK". Turn the mod's capture off in `/config` → OrgSync → Capture suggestions.
- **Codex.** For now the skill captures as in the chat apps below. The compaction and session-end hooks, which start the
  same worker with `codex exec`, stay off until a sending step is proved; `ORGSYNC_CAPTURE_COURIER=1` turns them on.
- **Claude web, Claude Desktop chat and ChatGPT.** The skill saves a decision privately when you settle one, says so
  once ("Saved privately to your OrgSync queue. Say 'off the record' to stop."), and offers the batch at the end.

Say "off the record" and nothing from that conversation is captured, earlier turns included, and what it already saved
is forgotten; "back on the record" brings back hints, never capture. `/orgsync:capture` also takes `forget`, `status`,
and `pause` or `resume`, which open your capture page: consent, pausing and switching on happen only there, never in
chat. Review the queue with `/orgsync:today`, or forget a session from Captured for you on OrgSync's Home.

## Data

The plugin sends OrgSync only what an action needs: the question when your AI looks something up, the
summary and excerpts of a draft you choose to share, a change you ask for, and feedback you give on an
answer. Before it finishes a customer reply, quote, plan or policy, your AI may call `check` with a sentence or two it
writes about the facts it relies on, with no names or pasted text; OrgSync compares them with your company's accepted
decisions, free, and keeps nothing. It never sends your conversation in the background; with capture on, it sends only the
private suggestions described above. Cited answers and shared sources use your
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
- **Reminders, never email.** At the time you set, the to-do shows as due in `/orgsync:today` and in the Claude Code
  pane. OrgSync never emails to-dos or reminders; for a phone alert, add it to your phone's reminders too. A title
  can't hold a link, an email address or a handle.
- **Follow-ups that close themselves.** A to-do linked to a request or a goal can wait on it: if the request moves or
  someone checks in on the goal first, the to-do closes itself instead of coming due.
- **Free.** To-dos use no company credit. Done, dropped and handed-off to-dos are deleted 30 days after they close.
- **Work only.** Reminders for life outside work belong in your phone or your own to-do app.

## Update the plugin

- **Claude Code:** in a terminal, run `claude plugin marketplace update orgsync`, then `claude plugin update orgsync@orgsync`, then restart Claude Code.
- **Claude Desktop:** open **Settings › Plugins › OrgSync**. It shows the installed version and an **Update** button when a newer version exists. A "Couldn't check for updates" message in the Code tab comes from Claude Desktop itself. If the OrgSync plugin page shows the latest version, nothing is wrong. The latest version is listed in the plugin repository, `orgsync-ai/plugins`.
- **claude.ai:** the OrgSync marketplace can stay on an older version until you choose **Check for updates** for it.
- **ChatGPT:** after OrgSync adds or changes tools, ChatGPT keeps the old list until you open the OrgSync connection in ChatGPT's settings and choose **Refresh tools**. If ChatGPT's permission prompt calls the confirmation code that your AI sends after your yes "suspicious content", that is the one-time code OrgSync issued for the exact change you just approved. Allow it only if you just said yes to that change; otherwise decline, and nothing changes.
