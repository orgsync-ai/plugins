# OrgSync

OrgSync keeps your company's approved decisions, commitments and responsibilities in one place, and this
plugin brings them into your AI app: Claude, Codex or ChatGPT. Ask a question and your AI answers from the sources your company has
published, with a citation for each one and an honest label: a reported fact is not presented as an
accepted decision. When you want to share something with your company, your AI prepares a short draft
and nothing is shared until you approve it yourself.

You need an OrgSync account and a membership in your company's OrgSync. Sign up or join at
[orgsync.co](https://orgsync.co).

## Use it

- Ask about your company as you work, for example "what did we decide about the trial length?". Your AI
  uses OrgSync when the question is about your company's decisions, sources, owners or responsibilities.
- In Claude Code and Claude Desktop, `/orgsync:ask <question>` asks OrgSync directly, and
  `/orgsync:share <what to share>` prepares a draft from this conversation. In ChatGPT, type `@OrgSync`
  before your request. In Codex, ask it to use OrgSync.
- When you share, OrgSync asks you to approve the exact text, or, if you chose chat confirmation for this
  connection, your AI asks you for a clear yes.
- Owners and Decision approvers can review suggested corrections and reported problems, and accept or
  dispute a source. Each change asks you in OrgSync's own prompt, which your AI cannot answer for you.

## What it contains

- A connection to OrgSync's server at `https://orgsync.co/mcp`, for Claude apps. You sign in with your
  OrgSync account and choose your company the first time. In Codex and ChatGPT you add the connection with
  the steps on OrgSync's **AI apps** page.
- Skills that tell your AI how to use OrgSync: when to look something up, how to cite and describe a
  source, how to share only what you approve, and to answer from OrgSync rather than from memory.

It contains no hooks, scripts or programs that run on your computer.

## Data

The plugin sends OrgSync only what an action needs: the question when your AI looks something up, the
summary and excerpts of a draft you choose to share, a change you ask for, and feedback you give on an
answer. It never sends your conversation in the background. Cited answers and shared sources use your
company's OrgSync credit; see [orgsync.co](https://orgsync.co) for rates.

- [Privacy notice](https://orgsync.co/privacy)
- [Terms of service](https://orgsync.co/terms)
- [Help](https://orgsync.co/help)
