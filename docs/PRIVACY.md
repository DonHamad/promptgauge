# Privacy

PromptGauge is local-first.

- Data stays on the machine in `PROMPTGAUGE_HOME` or `~/.promptgauge`.
- Prompt text is not stored. `privacy.storePromptText` is forced false in V1.
- Tool arguments, tool results, assistant messages, and task titles are discarded.
- Transcript files are not read.
- Claude OAuth credentials are not required and must not be collected.
- No telemetry is sent to PromptGauge maintainers.
- `promptgauge doctor` prints `No credentials inspected.`

If you find PromptGauge writing prompt bodies or source code to disk, that is a security bug. See SECURITY.md.
