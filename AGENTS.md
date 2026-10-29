# Maintaining skills

## Workflow

This repository follows the engineering workflow from its own source, [CORE.md](CORE.md), at the checked-out revision. Read it, and the workflow skills under `skills/`, before starting work. The bindings below supply this repository's specifics.

Non-negotiable even without the plugin:

- Fetch origin and read from `origin/main` before exploring or changing anything, and again whenever you cannot establish that the last fetch is still current. Never reset or clean a shared or dirty checkout. Work on a branch or worktree.
- Every change gets an independent reviewer that did not write it, with an explicit APPROVE or REQUEST CHANGES for the exact head SHA. Re-review after every fix.
- A task ends at a verified merge, tag or release, or at a named blocker.
- Label claims as reported, tested, measured, hypothesis or deferred. Never invent results. A supplied memory or context item is not proof the model used it.
- Commit as the human developer's git identity, with no agent author or `Co-Authored-By` trailer. If the identity is unset or shows an agent, stop and ask; never set one yourself. Keep secrets, real handoffs and private data out of the repository, PRs and logs.

### Workflow bindings

- **Checks:** `npm run build:native`; `npm test`; `claude plugin validate .` for marketplace or plugin changes, plus an `npx skills add <checkout> --list` and a Codex `plugin marketplace add` and `plugin add` into scratch homes when install layout changes; validate changed skill frontmatter. Build and test the release artifacts when setup changes. Do not run routinely: nothing paid.
- **Reviewer:** the most capable available model (Opus 5.5 in Claude sessions). Documentation-only changes may get a focused review. Code, schema, plugin and skill changes need review of their behavior and the guarantees they affect. Bot review: Devin Review when the PR is ready and after each push; its instructions are in REVIEW.md.
- **Merge authority:** merge after current-head independent approval, passing CI and a completed Devin review. If a reviewer or integration is unavailable, report the missing review and leave the PR open.
- **Release:** the plugin is released by tagging the reviewed merge commit `skills--v<version>`. Every change to what it ships bumps its version and records the content digest in `.claude-plugin/releases.json`. Released digests are immutable. Handoff releases are built from the reviewed merged source per [docs/development.md](docs/development.md).
- **Records:** [docs/validation.md](docs/validation.md) records scope, findings and their disposition, reviewed SHA, checks, verdict and remaining limits. No separate journal.
- **Diagnostics:** none. The repository has no deployed service.
- **Exceptions:** none.

## Repository rules

Keep this repository a small collection of reusable skills and plugins. Handoff is the local handoff helper, and nothing else needs to depend on it. The `workflow` plugin holds generic engineering workflow. Repository-specific rules belong in each consuming repository's bindings, not here.

Use Node 22+ built-in libraries and the bundled filesystem addon for Handoff. Runtime handoffs, drafts and work context belong outside this repository and application checkouts. Examples and tests must be synthetic. Packaging and installation use explicit source allowlists and never read the runtime store.

The schema is authoritative. Keep the dependency-free validator, renderer, skills and command documentation consistent with it. Preserve local-only behavior, immutable revisions, explicit conflicts, project isolation, and the boundary between evidence and executable authority.

The repository root is a single plugin, `skills@skills`, as in addyosmani/agent-skills and obra/superpowers. Its skills live at `skills/<skill>/SKILL.md`, the layout that Claude Code, Codex and `npx skills` all discover. What it ships is instructions and Handoff's local helper: Markdown skills, `CORE.md`, the plugin manifests, and one Claude SessionStart hook, which prints `CORE.md`. Keep every other plugin component (`commands/`, `agents/`, `.mcp.json` and the like) out of the root. Codex would otherwise discover `hooks/hooks.json` and run it without its arguments, so the Codex manifest points `hooks` at an explicit empty `.codex-plugin/hooks.json`. Keep `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, `.agents/plugins/marketplace.json` and `.codex-plugin/plugin.json` in step. Handoff lives in `skills/` so the plugins load it, with its helper and reference as symlinks into `tools/` and `docs/` (Claude Code keeps them in the plugin cache). It is hidden from `npx skills` with `metadata.internal`, because it needs the platform addon; in a plugin install the helper builds that addon on first use from the bundled source, with no download. Keep `CORE.md` under the 10,000-character hook output cap. Document the environments you actually tested, and do not infer another agent's compatibility from local helper tests.

## Independent review

Follow [the development workflow](docs/development.md), [the review contract](REVIEW.md) and the `independent-review` skill. Give the reviewer the requirements, the base and exact head SHA, the actual diff and the relevant source. Ask for an open assessment without supplying the intended verdict. Disclose any capacity fallback and the actual model when known.

Devin Review should run when the PR is ready and after each push. Inspect its current-head findings, fix confirmed defects and verify completion. Enrollment or a trigger comment is not a completed review. Never enable automatic code edits or broaden account or repository permissions incidentally.

Checkpoint commits and PR pushes are permitted for review. Do not claim review or merge approval from a previous revision.
