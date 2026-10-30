# Handoff reference

Handoff 0.2 uses Node 22+ and a POSIX filesystem with descriptor-relative operations, no-follow opens, hard links, and directory fsync. macOS and Linux are the intended platforms; Windows is not supported in this version. No third-party npm packages, network operations, daemon, MCP server, or model service are used by the helper.

## Commands

In a source checkout use `node /absolute/path/skills/tools/handoff.cjs`. In an installed skill use `node /absolute/path/SKILL/scripts/handoff.cjs`. Below, `handoff` abbreviates that full command. Global options must precede the subcommand:

```sh
handoff --project /path/to/app --data-dir /local/private/handoff project
handoff --project /path/to/app list --query retry
handoff --project /path/to/app inspect --path src/retry.ts --path tests/retry.test.ts
handoff --project /path/to/app template --title 'Retry investigation'
handoff fingerprint --transcript ~/.codex/sessions/2026/10/30/rollout-2026-10-30T09-00-00-ID.jsonl
handoff --project /path/to/app draft --input /private/payload.json
handoff --project /path/to/app render --input /local/private/handoff/projects/P/drafts/R.json
handoff --project /path/to/app publish --input /local/private/handoff/projects/P/drafts/R.json
handoff --project /path/to/app get HANDOFF_ID --check-state
handoff --project /path/to/app get HANDOFF_ID --revision REVISION_ID --format json
handoff --project /path/to/app get HANDOFF_ID --path /local/private/handoff/projects/P/handoffs/H/revisions/R.json
handoff --project /path/to/app export HANDOFF_ID --format markdown
handoff --project /path/to/app validate --input /private/full-record.json
```

`template` emits a v2 payload without identity fields. Replace its illustrative objective, focus and next action truthfully. Save payload JSON in a private file before preparing a draft; use `umask 077` when redirecting shell output. `inspect` reads HEAD, branch, and status for literal selected paths only. It does not infer push status, read secrets, or verify semantic findings. Its output has the shape of `code_state`, but v2 caps `code_state` at 50 relevant paths and 200 dirty paths of up to 500 characters each. Keep the paths that matter for the focus, and add already known unpublished work.

`fingerprint` reads one regular file without interpreting it and returns its canonical path, SHA-256, byte count, line count (null for `.zst`/`.gz`) and a format hint. Copy it into `source` with the agent name and session ID. It needs no project or store.

`draft` validates the payload, generates identity/UTC metadata, and saves a complete draft. It never appears in `list`. `publish` accepts a complete prepared record, preserving its IDs for exact retries. A repeated identical record succeeds; differing content at the same ID fails. Input files are never edited. Saved drafts remain available after publish and after storage failures. When using `--input -`, retaining the original input is the caller's responsibility; private files are preferred.

For an update, prepare a complete payload, then:

```sh
handoff --project /path/to/app draft --input /private/payload.json \
  --handoff-id HANDOFF_ID --predecessor REVISION_ID
```

For explicit reconciliation, repeat `--predecessor` for every conflicting revision that the new complete record supersedes. The helper does not merge prose. A sole graph head is current; concurrent heads produce a conflict. Exact revision reads disclose successors. Timestamps never decide which content wins.

`get --format json` returns an envelope containing `record`, `current_revision_ids`, `successor_revision_ids`, and optional `state_comparison`. For a v2 record, `state_comparison.source_transcript` reports whether the recorded transcript is `unchanged`, `grown since handoff`, `changed since handoff`, `compressed since handoff` or `missing`, `unverifiable: no fingerprint recorded`, `unreadable`, or that there is `no pointer`; the helper hashes the file and never interprets its content. `export` renders to stdout; redirect explicitly for an exported copy. Both are read-only. A metadata comparison reports potentially stale or unverifiable; only an agent's revalidation of critical evidence can establish verified freshness. Resume is orientation unless the current user also requests implementation.

## Record contract

The authoritative JSON Schema is `schema/handoff.schema.json` in source, or `scripts/handoff.schema.json` in an installed skill. It defines two record versions, selected by `schema_version`. `draft` writes v2. v1 records remain readable and renderable, and a v1 handoff can be continued with a v2 revision. Other versions are rejected. The standard-library validator implements exactly the schema features used here, including `oneOf` only as a union discriminated by `schema_version`; it is not a general JSON Schema engine. No stored record is migrated or rewritten.

Helper-managed fields: schema version, stable handoff ID, unique revision ID, UTC creation time, project identity, and explicit predecessor revision IDs. A v2 brief covers the whole conversation and details one focus item. Agent payload fields (optional ones may be omitted; the renderer leaves out empty sections):

| Field | Shape and meaning |
| --- | --- |
| `title` | Required string. |
| `purpose` | Optional; what the next session will be used for. |
| `objective` | Required `goal` (the whole conversation's), optional `constraints` (hard requirements, verbatim when the user stated them). |
| `work_state` | Required, 1–30 items of `item`, `status` (done/active/blocked/parked/open), optional `note` and `links`. Every workstream the conversation touched, one line each. |
| `focus` | Required `item` (must name a `work_state` item) and `notes`: `text` plus `basis` (user/observed/hypothesis/assumed). The only section in depth. |
| `decisions` | `statement`, `status` (accepted/rejected/unresolved), optional `reason`. Rejected choices require a reason and render as "Do not retry". |
| `done` | Completed work the next agent must not redo. |
| `open_requests` | Unanswered user requests, verbatim. |
| `links` | Up to 15 `ref` + `why`: PRs, issues, commits, docs or paths that already hold detail. The brief points at them instead of restating them. |
| `code_state` | Optional nullable `base_commit`, `branch`; arrays `relevant_paths`, `dirty_paths`, `unpublished_work`, `limitations`. Paths reference local content; nothing is copied. |
| `checks` | `command`, `result` (pass/fail/unknown), `summary`, optional nullable `commit` the check ran at. |
| `gaps` | Compaction, unavailable output and other context limits. |
| `source` | Null or a transcript pointer: `agent`, `path` (required, nullable), optional `session_id`, `sha256`, `bytes`, `lines`, `format`. |
| `next_action` | Required; exactly one action. Rendered last. |

v2 agent-payload strings are single lines, except `open_requests`, whose lines all render inside the quote, so stored text cannot open a new section of the brief. Helper-managed `project` fields come from the local filesystem and keep the v1 definition. Strings and lists have maximum lengths (for example 600 characters for `next_action`, 500 for a focus note) so the brief stays terse; the schema has the exact limits. Do not invent constraints, measurements, tests, or attribution. Records are limited to 2 MiB. Markdown is derivative and rendered from the same JSON; it is never parsed as an authoritative record or executed.

v1 records use `scope`, `continuation`, `findings`, `decisions`, `code_state`, `verification`, `dependencies` and `provenance`; see the v1 branch of the schema.

## Store and project identity

Default: `~/.local/share/handoff`; override with `HANDOFF_DATA_DIR` or `--data-dir`. Stores from before the rename keep working: `ASTACK_DATA_DIR` is still read when `HANDOFF_DATA_DIR` is unset, and an existing `~/.local/share/a-stack` is used while `~/.local/share/handoff` does not exist. To migrate, move the directory to the new path. Choose a genuinely local directory outside source checkouts and cloud-synced folders. The tool cannot detect every sync product. Configured root parents are trusted filesystem configuration and resolved canonically; the configured root itself and store children cannot be symlinks. Store directories/files must be owned by the current user and private (0700/0600). Existing public permissions are rejected with an actionable error, not silently changed.

```text
DATA_ROOT/
├── mappings/ANCHOR_ID.json             # only explicit clone mappings
└── projects/PROJECT_ID/
    ├── drafts/REVISION_ID.json
    └── handoffs/HANDOFF_ID/revisions/REVISION_ID.json
```

Project IDs are opaque SHA-256-derived local anchor identifiers. Git common directories unify ordinary worktrees. Separate clones remain separate, regardless of basename or remote URL. Non-Git projects use the explicit canonical root; pass `--project` consistently. No registry is needed for ordinary discovery.

To explicitly associate an empty clone/root with another local project:

```sh
handoff --project /path/to/new-clone link-project --to /path/to/existing-clone
```

Mappings are immutable and resolve transitively with cycle validation; remapping an existing mapping or hiding existing source handoffs is rejected. Mapping resolution and writes share a private store lock so linking cannot race with publication. A previously prepared draft for a newly linked identity is rejected without deleting it; prepare a new draft for the linked project. The lock protects local store metadata only, never application code. Automatic migrations/remapping are not provided. Moving a canonical project root changes identity; keep its location stable or perform a deliberate future migration.

Writes use a private same-directory temporary file, file fsync, atomic no-overwrite hard-link installation, and directory fsync. Temporary leftovers from process termination are ignored; a completed retry reuses the same ID. Parallel successors are retained. Files are immutable by application convention, not tamper-proof; another process owned by the same user can alter them. Local storage protects completed saves against process interruption, not disk loss or guaranteed power-loss behavior on every filesystem. No backup/sync is provided.

## Offline and execution boundaries

Every Git command disables lazy fetching and denies all transport protocols. Missing objects in a partial clone produce an explicit unavailable-metadata limitation rather than contacting a promisor remote. Tracked file reads hold descriptor-relative, no-follow parent traversal through the final open; replacing a parent directory with an escaping symlink cannot redirect the read.

Git is used only for local commit/index metadata, staged-change names, and untracked filenames, with optional locks, fsmonitor, untracked cache, global/system config, inherited Git environment redirects, external diff, and text conversion disabled. The helper does not call Git status or a Git diff against the working tree. It compares selected tracked files' raw bytes to index blob IDs itself, so repository conversion drivers cannot execute even if configuration changes during inspection. Symlink contents are compared as link text; escaping parents and non-regular files are not read. Submodule working-tree inspection is skipped and reported as a limitation. Raw comparisons can conservatively report files dirty even when normal Git conversions would consider them unchanged. It never invokes remote Git helpers, fetches, hooks, network clients, or historical check commands from records. Agents must also avoid remote operations in this workflow. Git repository guidance and user instructions remain relevant to any separately requested implementation.

Two local agents share records through filesystem access, with no manual JSON transfer. Containers need an explicit volume mount. Hosted agents without local access are unsupported. The host agent may send read context to its model provider; helper-local storage does not make a cloud-backed agent offline. Fully offline model processing requires a suitable local agent/model.

Installation and updates touch skill code only and never read runtime data. Generic source can be developed at home and transferred to a work machine; real work records remain in that machine's local store. Do not include real records in examples, releases, tests, diagnostics, or this repository. Future schema upgrades must check compatibility explicitly; destructive migrations would need a separate, deliberate local backup and migration workflow.

## Node implementation (0.2.0)

Run `node /path/to/tools/handoff.cjs` in source or `node /path/to/SKILL/scripts/handoff.cjs` in an installed skill. Handoff uses Node's built-in libraries; a bundled Node-API addon supplies openat/mkdirat/linkat/unlinkat/readlinkat, directory iteration, and flock. These operations preserve the reviewed descriptor-relative guarantees that Node's standard filesystem API alone cannot provide. Releases contain the compiled addon for a specified OS/architecture. A mismatched/missing addon fails before store use; no fallback compiler or download is invoked.

Project IDs and the data layout are unchanged from 0.1. Helpers before 0.2.0 cannot read v2 records, and they fail `list` and `get` for a project whose store holds one, so upgrade every agent that shares a store together. Existing v1 records, including Python-produced ones, can be read and exact identical retries remain valid (JSON key ordering/whitespace need not match). The legacy `.relay.lock` filename intentionally remains for cross-version coordination; no tool is exposed as Relay. Upgrade the skill code only, using the Node installer with `--replace`; runtime records/drafts are preserved.

macOS addon builds explicitly target macOS 11 or newer, while Linux release builds use Ubuntu 22.04 (glibc 2.35 baseline). Current CI does not execute on every older supported OS. Platform/architecture-specific release binaries are required; Linux musl/Alpine builds are not supplied. Source builds require a local compiler and Node headers; release installation never compiles code.

Store parent directories outside the configured root are trusted filesystem configuration. Within the root, the addon retains open directory descriptors and rejects child symlinks. Local same-user modifications can still tamper with data; the store is not an authenticated/tamper-proof database. Raw comparisons are a moment-in-time check and do not prove semantic freshness.
