---
title: Ralph — prepare
---

`ralph-prepare` sets up Supervisor and tmux so Ralph survives VPS restarts and can be monitored easily. Run from the web project folder. {% .lead %}

---

## When to use

- First time setting up Ralph on a new VPS
- After deploying to a new server
- When you want Ralph to auto-restart after a crash

---

## What it does

1. Creates `/etc/supervisor/conf.d/ralph.conf`
2. Creates `.ralph/ralph-ctl.sh` — start / stop / restart / status / logs
3. Sets up a tmux session name for easy reattaching

---

## Supervisor config (key settings)

| Setting | Value | Why |
|---|---|---|
| `autostart` | `false` | Ralph does NOT start on boot — must be started manually |
| `autorestart` | `unexpected` | Only restart if Ralph crashes (exit ≠ 0). Normal finish → stays stopped |
| `stopsignal` | `INT` | Graceful shutdown so Ralph can clean up |
| `stopwaitsecs` | `120` | 2 min for graceful stop |
| `stdout_logfile` | `{PROJECT_DIR}/.ralph/live.log` | Rotated at 50MB × 3 backups |

---

## Control script commands

```bash
.ralph/ralph-ctl.sh start     # Start Ralph
.ralph/ralph-ctl.sh stop      # Stop Ralph
.ralph/ralph-ctl.sh status    # Check status
.ralph/ralph-ctl.sh logs      # Tail live output
```

---

## Switching from nohup to Supervisor

If Ralph is currently running via `nohup`:

1. Find and kill the nohup process: `kill $(pgrep -f ralph_loop)`
2. Wait for it to stop
3. Start via supervisor: `.ralph/ralph-ctl.sh start`

---

## tmux fallback

If sudo / Supervisor not available, fall back to tmux:

```bash
tmux new-session -d -s ralph -c {PROJECT_DIR} '.ralph/ralph_loop.sh --live --verbose'
tmux attach -t ralph
```

tmux sessions do NOT survive VPS restarts. Only Supervisor (or systemd) survives reboots. To make tmux survive: `@reboot tmux new-session -d -s ralph -c {PROJECT_DIR} '.ralph/ralph_loop.sh --live --verbose'` via `crontab -e`.

---

## Hard rules

- Run from the project directory (uses `pwd` to detect paths)
- Supervisor requires `sudo`
- The `ralph` program name must be unique — for multiple projects use `ralph-{projectname}`
- Ralph's `SESSION_CONTINUITY=true` means it resumes after restart (no progress loss)

---

## Related

- [Ralph — install](/docs/dynamic-commands/ralph-install) — what to run first on a new project
- [Ralph — deploy](/docs/dynamic-commands/ralph-deploy) — what feeds Ralph the task list
- [Ralph — monitor](/docs/dynamic-commands/ralph-monitor) — watch a running Ralph
