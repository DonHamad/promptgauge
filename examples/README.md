# Local status-line enablement

Prefer:

```bash
node dist/index.js statusline install
```

This wraps `~/.claude/settings.json` without deleting an existing `statusLine`.

```bash
node dist/index.js hooks install
```

Adds `UserPromptSubmit` and `Stop` collectors next to any existing hooks.

`claude-statusline.json` remains a manual snippet only if you want PromptGauge as the sole status line without using the installer.

The wrapper prints nothing extra when a previous status line exists. Hook collectors still print nothing so `UserPromptSubmit` does not inject output into Claude's context.
