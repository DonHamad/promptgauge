# Local plugin enablement

PromptGauge ships a Claude Code plugin under `plugin/`.

Official plugin settings currently apply only `agent` and `subagentStatusLine` from a plugin `settings.json`. Live quota is exposed on the **user/project status line**, not via plugin settings. Add the snippet in `claude-statusline.json` to `~/.claude/settings.json` (or project `.claude/settings.json`) if you want PromptGauge to observe `rate_limits`.

Enable the plugin from a local checkout after `pnpm build` and `pnpm link --global`.

The collector prints nothing on hook events. `UserPromptSubmit` stdout would otherwise be injected into Claude's context.
