---
name: publish-handoff
description: Save a local handoff brief of this conversation so another agent session (Claude Code, Codex or another local agent) can continue it, or publish a new revision of an existing handoff. Use for local agent handoffs; this workflow does not publish to GitHub or transfer code.
metadata:
  internal: true
---

Write a short brief that lets a fresh agent continue this conversation's work cold. "Publish" means durable local storage. Run the bundled `scripts/handoff.cjs` with Node 22+, substituting the skill's absolute directory. If the runtime is missing, use the akhilvuputuri/skills offline installer. Read [the reference](references/handoff.md) only when command syntax or a field is unclear.

## What the brief covers

The whole conversation, not only the current sub-issue. The reader must see the big picture and where the current work sits in it.

- `objective`: `{goal, constraints: [string]}`. The conversation's overall goal, plus hard constraints in the user's own words.
- `work_state`: `[{item, status, note, links: [string]}]`. Every workstream the conversation touched, one line each, with status `done`, `active`, `blocked`, `parked` or `open`. Give the reason for blocked and parked items.
- `focus`: `{item, notes: [{text, basis}]}`, where `item` repeats one `work_state` item's text exactly. The item the next session works on, and the only part written in depth. It is what the user said the next session is for, else the item the conversation ended on. Ask one question only when the choice is unclear and changes the brief.
- `decisions`: `[{statement, status, reason}]`; rejected ones need a reason. `done`: completed work the reader must not redo. `open_requests`: unanswered user requests, verbatim. `links`: `[{ref, why}]`. `next_action`: exactly one.

Use progressive disclosure. When a PR, issue, commit, doc or file already holds the detail, put it in `links` or the item's `links` with one line on why to read it, and do not restate it. A done item usually needs only its link. Spend words only on what exists nowhere else: decisions and their reasons, rejected approaches, user corrections, unverified hypotheses, and the current state of the focus.

## How to write it

- Terse single-line items, no prose paragraphs. Stay under about 700 rendered words for a long multi-issue conversation, and far less for simple work. The helper rejects oversized fields and lists.
- Tag each focus note `user`, `observed`, `hypothesis` or `assumed`. Never upgrade an assumption or hypothesis into a fact. Do not invent tests, results or acceptance criteria.
- Later corrections replace earlier claims. Keep the corrected value only.
- Self-contained: no "see above". Leave out instruction-file conventions, environment details, conversation play-by-play, secrets and credentials.
- Record compaction, missing output and other context gaps in `gaps`.

## Save

1. Run `project`, then `list --query` with a few distinctive words. If a handoff for this same work exists, this is an update: read its current revision with `get H --format json`, and edit that record rather than writing from scratch. Newer conversation takes precedence; move finished work out of `active`; drop resolved blockers and answered requests. Otherwise run `template --title`.
2. Optionally run `inspect --path` for relevant files and copy the result into `code_state`. Also record unpublished work. The helper never transfers code.
3. Optional source pointer: when you can identify this conversation's own transcript file, run `fingerprint --transcript FILE` and copy the result into `source`, adding `agent` and `session_id`. Claude Code keeps transcripts under `~/.claude/projects/<cwd-slug>/<session-id>.jsonl`, and Codex under `~/.codex/sessions/YYYY/MM/DD/rollout-*.jsonl`. Confirm the file by matching a distinctive recent message from this conversation; recency alone is not confirmation. If you cannot confirm it, leave `source` null.
4. Write the payload to a private file (mode 0600) beneath the store directory (`HANDOFF_DATA_DIR`, else `~/.local/share/handoff`), never in a checkout. Run `draft --input FILE`, adding `--handoff-id H --predecessor R` for an update. For a draft request, `render` the draft and stop. Otherwise run `publish --input DRAFT_PATH`, using exactly that draft file.

Report the handoff ID, revision ID, path, the focus, and any material gaps. If several separate handoffs are requested, save and report each independently. Competing successors stay visible; never choose one by timestamp.

Do not fetch remote state, post to issue trackers, commit, push, stash or switch branches as part of this workflow. Links are recorded as text. The helper makes no network calls; the host agent may still send context to its model provider.
