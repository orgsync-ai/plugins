# OrgSync plugins for Claude

This repository is OrgSync's plugin marketplace for Claude. Its one plugin, [OrgSync](plugins/orgsync/README.md),
brings your company's approved OrgSync context into Claude Code, Claude Desktop and claude.ai: cited
answers, exact source lookups, and sharing or source changes that you approve yourself.

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

If you connected OrgSync earlier with `claude mcp add`, remove that connection with
`claude mcp remove orgsync` so that Claude does not see two copies of each tool.

## Install in Claude Desktop or claude.ai

1. Add the OrgSync connector first, with the steps for "Claude Desktop or Claude on the web" on your company's
   **AI apps** page in OrgSync. On a Claude Team or Enterprise plan, an owner of your Claude organization adds
   connectors; you then connect with your own OrgSync account.
2. Open **Customize > Plugins**, choose **Add > Add marketplace**, and enter `orgsync-ai/plugins`. Add **OrgSync**.
   Its **Connectors** tab shows OrgSync as connected, because the plugin uses the connector you added.

A plugin added to your Claude account also reaches Claude Code when you are signed in with that account.

## Help

[Help](https://orgsync.co/help), [privacy notice](https://orgsync.co/privacy) and
[terms of service](https://orgsync.co/terms). The plugin's files are under the [MIT license](LICENSE).
