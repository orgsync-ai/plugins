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
3. In a chat, type `@OrgSync` and ask your question.

## Help

[Help](https://orgsync.co/help), [privacy notice](https://orgsync.co/privacy) and
[terms of service](https://orgsync.co/terms). The plugin's files are under the [MIT license](LICENSE).
