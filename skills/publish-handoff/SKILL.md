---
name: publish-handoff
description: Save or draft a local continuation record for a selected task from this conversation, or publish a new revision with updated findings. Use for local agent handoffs; this workflow does not publish to GitHub or transfer code.
metadata:
  internal: true
---

Create a task-specific continuation record using only context available to this agent. “Publish” means durable local storage. Use the bundled `scripts/handoff.cjs` with Node 22+; substitute the actual absolute skill directory in commands. The first run in a plugin install compiles the bundled filesystem addon with the local C compiler and Node headers; if that fails, use the akhilvuputuri/skills release installer rather than downloading dependencies. Read [handoff reference](references/handoff.md) for command syntax and the record contract when constructing a record.

## Select and extract

Resolve the requested topic and project from the user's instruction and observed workspace. A bare “issue 2” can refer to a numbered conversational list; never assume a GitHub issue. Ask one focused question when scope or project remains materially ambiguous. An unambiguous local save needs no extra confirmation.

Collect selected information across all available turns. Include directly relevant context and necessary shared dependencies with a reason. Explain how retained shared context connects to the selected goal in `dependencies`, retaining uncertainty when that connection is conditional. Shared files or keywords alone do not justify importing another topic. State boundaries in terms of the selected task; put acknowledgments of excluded topic titles in the receipt, outside the record. Exclude unrelated details, next actions, credentials, environment values, and transcript dumps. If several tasks are explicitly requested, produce separate records and report each save independently.

Preserve user requirements, observed results, hypotheses, proposals, accepted decisions, and rejected approaches separately. Later explicit corrections supersede earlier claims. Keep unresolved conflicts visible. Mark compaction, inaccessible outputs, and other context gaps; do not claim a complete extraction when context is incomplete. Do not invent user-approved acceptance criteria or passing tests.

## Prepare and save

Run `project` and project-scoped `list --query` to discover identity and any relevant existing handoff. Matching words do not automatically make this an update. Use a new handoff for a new task. An update uses a full replacement payload with an explicit handoff ID and predecessor revision ID(s).

Run `template --title` for an editable JSON payload and `inspect --path` for relevant repository paths. Preserve other known code-state details when incorporating inspection output. Record unpublished work and inaccessible artifacts. The helper does not transfer code. Discussion-only records may have unknown code state with a stated limitation.

Create the payload in a private temporary file outside application and skills checkouts, preferably beneath the Handoff store directory (`HANDOFF_DATA_DIR`, otherwise `~/.local/share/handoff` or an existing legacy `~/.local/share/a-stack`) with mode 0600. Retain that file on failure. Populate all concept groups: scope, continuation, findings, decisions, code state, verification, dependencies, provenance. Aim for a 600–1200 word rendered brief, shorter for simple tasks; keep essential constraints and blockers even when longer.

Run `draft --input FILE` (with explicit lineage for an update). This validates and saves a private draft outside the published list. For a draft request, render that draft and stop. For a publish request, run `publish --input DRAFT_PATH` using exactly the generated draft, retaining its IDs for retries. Publishing validates, writes atomically without overwriting, and reads back. A differing same-ID retry is an error. Competing successors remain visible; never choose by timestamp. A multi-parent revision requires explicit reconciliation of the conflicting content.

Return the selected topic, handoff ID, revision ID, local path, and material limitations. Report conflicts and individual failures. Unrelated topics may be acknowledged by short title only, outside the stored record.

Do not fetch remote state, contact issue trackers, commit, push, stash, switch branches, copy checkouts, or add telemetry as part of this workflow. Issue URLs are inert metadata. Keep runtime records out of the skills repo and packages. The helper adds no network calls; the host agent may still process content through its configured model provider.
