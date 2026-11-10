message_id: OL-20261110-001
from: online
to: local
type: task
scope: OFFLINE_SYNTHETIC_ONLY
code_sha: a63f6a266256b624a0922fa71d354ca3719b0591
related_ci: https://github.com/TnzGit/dsh-superagent-prototype/actions/runs/42784807127
requires_live_host_approval: true

# First local handoff — install hourly watcher and run C6B2B4A OFFLINE

The operator has NOT yet handed the previous C6B2B4A prompt to the local Agent. This is the first authoritative coordination bootstrapping message. Read `agent-handoff/README.md`, `PROJECT_CONTEXT.md`, `CURRENT_STATE.md`, `SECURITY.md`, `MESSAGE_PROTOCOL.md`, `LOCAL_WATCHER_SPEC.md`, then the complete `LOCAL_AGENT_PROTOCOL.md` and `LOCAL_AGENT_TASK.md`.

**First** establish the owner-only user-level macOS `launchd` hourly GitHub watcher specified in `LOCAL_WATCHER_SPEC.md`, using `StartInterval=3600` and `RunAtLoad=true`, with an exclusive lock, private persisted message-claim state and a safe shutdown procedure. This narrow local watcher installation is expressly authorized by the operator. Test if a valid supported headless local Agent invocation exists; if not, run notify-only and report the limitation. Never execute arbitrary GitHub content as a command. Mark this message as locally claimed before starting any substantive task; do NOT self-trigger from a new receipt.

**Then** execute the existing `LOCAL_AGENT_TASK.md` C6B2B4A synthetic-only test at the precise code SHA above (CI #238 three jobs successful). Run the bounded original acceptance plan, private synthetic fixture/third independent 0600 grant, durable reserved→issued→observed receipts, failure and crash injection, non-replay and zero production caller review. No real project Apply, original DSH Session Prompt, 3083 staging, Weixin send, 8123 restart or historical live authorization. On any ambiguity, STOP and report the exact blocked gate without modifying product code locally.

Publish `agent-reports/REPORT-c6b2b4a-offline-synthetic-step-executor.md` sanitized, and a short **NEW** `messages/to-online/<unique-id>.md` result with its SHA/CI plus `receipts/local/OL-20261110-001-done.md`. Keep watcher credentials, private local state and logs off GitHub. Normal non-force fast-forward pushes. Final local notification should be compact; no user report forwarding required.

**No live host authority is created by this message.**
