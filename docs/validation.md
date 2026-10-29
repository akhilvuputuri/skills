# Validation status

## Handoff in the plugin, skills 0.3.0 — 30 October 2026

- **Change:** importing the repository as a Claude Code plugin gave no Handoff, because Handoff lived in `handoff/`, outside the plugin's `skills/` scan.
  - `publish-handoff` and `resume-handoff` moved to `skills/`. They keep `metadata.internal: true`, so `npx skills` still hides them. Their helper and reference stay development symlinks into `tools/` and `docs/`.
  - `tools/handoff.cjs` builds the filesystem addon on first use when it is missing and `tools/build-native.cjs` is beside it, using the local C compiler and Node headers. Nothing is downloaded. Compiler output goes to stderr. Release installs ship the addon prebuilt and never build.
  - The installer and release build read the new skill path. The marketplace test now allows exactly Handoff's two symlinks per skill (and checks they resolve), and the content digest reads symlinks as link text, as git stores them.
  - Version 0.3.0 in all four manifests; README pins and docs updated; digest recorded.
- **Checks** (30 October 2026, macOS arm64, Node 22): `npm test` 47/47; `claude plugin validate .` passes.
  - **Claude Code** (isolated `CLAUDE_CONFIG_DIR`, install from this branch): `claude plugin details` lists 10 skills including both Handoff skills. The plugin cache keeps the symlinks. With the addon removed, the first `list` built `native/darwin-arm64/posix.node` and returned JSON; `template` then ran. With `HANDOFF_NODE_HEADERS` pointing nowhere, the helper failed with the headers message and built nothing.
- **Not verified:** Codex (no `codex` binary on this machine) and whether it keeps the symlinks; installing from GitHub (tag does not exist yet); hosts without a C compiler or Node headers, which see the error above; a read-only plugin cache. Digest scope is unchanged, so edits to `tools/` or `docs/` alone do not require a version bump.
- **Independent review:** not yet run for this head.

## One root plugin, skills 0.2.0 — 15 October 2026

- **Change:** the repository root is now a single plugin, `skills@skills`, laid out like addyosmani/agent-skills and obra/superpowers (both checked on GitHub: one root plugin each, with `skills/` at the top). Before, it shipped two plugins under `plugins/`.
  - Every instruction skill is in `skills/`: the seven workflow skills and `ios-design`. `CORE.md`, `hooks/hooks.json`, `.claude-plugin/plugin.json` and `.codex-plugin/` are at the root.
  - Handoff moved from `skills/` to `handoff/`. Its development symlinks keep the same depth and still resolve. The installer and release build read the new path; the release ZIP layout is unchanged.
  - **One version and tag:** `skills--v0.2.0`. The content digest covers only what the plugin ships (`skills/`, `CORE.md`, `hooks/`, both plugin manifests). Claude Code copies the whole root, but nothing else changes what a session loads.
  - The released digests of the former `workflow` and `ios-design` plugins are still checked against their tags.
  - A test keeps other plugin components (`commands/`, `agents/`, `.mcp.json` and the like) out of the root.
  - The README, adopt skill and AGENTS.md block now use `skills@skills` and `skills--v<VERSION>`, with steps for moving off the 0.1.x plugins.
- **Trade-off (accepted by the owner):** Claude Code and Codex now install the workflow and `ios-design` together, so anyone wanting only `ios-design` also gets the workflow's SessionStart hook. `npx skills` still installs single skills, without the hook.
- **Checks** (15 October 2026, macOS arm64, Node 22.15):
  - `npm test` 47/47 (unchanged after the review fixes, which only add assertions).
  - `claude plugin validate .` and `claude plugin validate .claude-plugin/plugin.json` pass.
  - **Claude**, isolated `CLAUDE_CONFIG_DIR`, from this checkout: `skills@skills` 0.2.0. `claude plugin details` lists 8 skills, 1 SessionStart hook, 0 agents, 0 MCP and 0 LSP servers, about 701 tokens always-on.
  - **Codex** 0.159.2, scratch `CODEX_HOME`: `skills@skills` 0.2.0. `codex debug prompt-input` lists the 8 `skills:*` skills once each, with no hook text.
  - **npx** `skills@1.5.18 --list`: 8 skills, with Handoff hidden.
  - **Migration**, tested on a clone moved from `f5aef0a` (0.1.3) to this branch:
    - Claude: uninstalling `workflow@skills` and `ios-design@skills`, `marketplace update skills` and installing `skills@skills` leaves only 0.2.0.
    - Codex: removing both plugins, removing and re-adding the marketplace, and adding `skills@skills` leaves only `[plugins."skills@skills"]`, and each skill loads once.
- **Independent review** (Opus 5.5) of `aa9b2bc`: **REQUEST CHANGES**.
  - The reviewer confirmed the restructure:
    - tampering with each of the 8 old release digests fails, and so does moving a tag;
    - a simulated `skills--v0.2.0` tag verifies, and editing a skill under it fails;
    - the Handoff release ZIP and one-file installer work from `handoff/`;
    - from the binaries' strings (Claude Code 2.1.283, Codex 0.159.2), no other loaded component is present at the root.
  - **Medium:** the root guard was a short block-list. It missed folders and files those binaries load (`workflows/`, `themes/`, `.app.json`, a root `SKILL.md`), so adding one would pass with no version bump. The test now allow-lists every top-level entry and the contents of `.claude-plugin/` and `.agents/`; a new entry fails until someone decides whether agents load it. Tested: adding `workflows/` fails.
  - **Low:** deleting the old `workflow` or `ios-design` records from `releases.json` passed silently. Every `<name>--v<version>` tag must now have a record. Tested: deleting the `workflow` records fails.
  - **Info:** `evals/` is the default folder for `claude plugin eval`. The existing `cases.json` evals use another format, so that command finds no cases. Sessions are unaffected.
- **Delta review** (Opus 5.5) of `94d887d`: **APPROVE**.
  - **No false positives:** the allow-list passed on a clean clone, after `build:native`, after `build-release`, and in a `git archive` export without `.git`.
  - **Both fixes falsified:** adding `workflows/`, `themes/`, `.app.json` or a root `SKILL.md` fails, and so does deleting any old release record.
  - **Info:** a local `.claude/` or `.codex/` folder, or a `.DS_Store` in a subfolder, also failed. Agents create these in checkouts but never load them from a plugin root, so the next head ignores them. Tested both ways: with `.claude/`, `.codex/` and `.claude-plugin/.DS_Store` present the test passes, and with `workflows/` it fails.
  - That head also adds the ios-design 0.1.3 release record above.
- **Delta review** (Opus 5.5) of `351d3d0`: **APPROVE**.
  - The reviewer read the binaries' strings: neither Claude Code nor Codex loads `.claude/` or `.codex/` from a plugin root.
  - It checked every fact in the 0.1.3 record. On its wording nit, the merge flag is now marked as reported.
  - It noted that committed content under those two folders would also be exempt.
- **Devin Review of `351d3d0`:** 0 bugs, 0 vulnerabilities, 3 flags.
  - **Agent folders lack git ignore rules:** fixed. The test now fails if anything under `.claude/`, `.codex/` or the other local-only paths is committed. Tested: a committed `.claude/skills/x/SKILL.md` fails.
  - **Release-record coverage depends on fetched tags:** accepted. CI checks out with `fetch-depth: 0`, so it has every tag. A local clone without tags checks less, and never wrongly passes a tag it can see.
  - **Current-head review record:** recorded on the PR. Writing a head's approval into that same head would create a new head.
- **Not verified:** installing from GitHub at `skills--v0.2.0`, which doesn't exist until merge; the hook's output reaching the model in an authenticated session; Codex project config.

## Codex migration steps; workflow 0.1.3 — 15 October 2026

- **Change:** the adopt skill's migration from the `a-stack` marketplace now removes each `<plugin>@a-stack` in Codex before removing the marketplace, and the README says the same. Workflow moves to 0.1.3.
- **Why (tested):** this came from the independent review of akhilvuputuri/PageStash#48. In a scratch `CODEX_HOME` with codex-cli 0.159.2, `codex plugin marketplace remove a-stack` left `[plugins."workflow@a-stack"]` and `[plugins."ios-design@a-stack"]` enabled. `codex debug prompt-input` then listed every shared skill twice. Running `codex plugin remove` for each old plugin first left only the `@skills` entries.
- **Release line.** Main gained ios-design 0.1.3 (#9) before this merged. The README examples now pin `workflow--v0.1.3`, which will also carry ios-design 0.1.3.
- **Checks** (15 October 2026, macOS arm64, Node 22.15, after merging main): `npm test` 46/46 and `claude plugin validate .` pass.
- **Independent review** (Opus 5.5) of `657eee1`: **APPROVE**.
  - The reviewer ran the documented Codex steps from an old `a-stack` install in a scratch `CODEX_HOME`. Only the `@skills` entries remained.
  - It reproduced the duplicate loading when only the marketplace is removed.
  - It confirmed `codex plugin remove` still works after the marketplace is gone, and on a plugin that isn't installed.
  - Two low findings, both fixed in the next head: this record lacked its checks and verdict, and the README's Codex step sat in the Claude paragraph.
- **Not verified:** installing from GitHub at `workflow--v0.1.3`, which doesn't exist until merge, and Codex project config.

## ios-design 0.1.3: field notes from shipping PageStash — 15 October 2026

Adds `references/implementation.md`, field notes from applying the skill end to end in PageStash, a SwiftUI reading app (iOS 17 target; Xcode 26.3 with the iOS 26.3 SDK locally, Xcode 16.4 in CI), across releases 0.3.0–0.4.1. Other changes:

- `SKILL.md`: links the notes, adds compile-time gating for SDK-only APIs, and adds an issue-tracker boundary (close only when asked; list verified and unverified items).
- `content-apps.md`: theme scope becomes a product decision to ask about, recording that the owner rejected a reader-only theme as inconsistent; adds app-wide guidance and a Trash pattern.
- `checklist.md`: an Icon row, theme scope as decided, and passing simulator UDIDs.
- `hig-system.md`: pointers for icon checks and naming.

Evidence (reported from that project's records and CI, not re-run here):

- **Tested:** the SDK gating failure on the Xcode 16.4 CI runner, and its `#if compiler(>=6.2)` fix.
- **Measured:** the contrast ratios (3.87:1 for `#4685c5` on white, 10.62:1 for the sepia ink); the Swift snippet in the notes reproduces them, run with `swift` locally.
- **Tested in the simulator:**
  - The destructive swipe-role, sheet/full-screen-cover and confirmation-capture pitfalls.
  - The receding-bar behaviors, including edge swipe-back with the bar hidden.
  - The Trash flow, and the widget, quick action and deep-link routing.
  - The `booted` multi-simulator pitfall.
- **Tested in unit tests or CI:**
  - The blank AppKit icon and the CoreGraphics fix.
  - The rejected-edit status mapping.
  - The App Group snapshot round trip and Continue Reading selection. Clearing on sign-out is implemented but untested.
- **Tested on the owner's iPhone:** signed install and launch only.
- **Compiled against the iOS 26.3 SDK in PageStash:** the API names in the notes (`safeAreaBar`, `Button(role: .close)`, `ToolbarSpacer`, `privacySensitive()`, `CSSearchableItemActionType`, `windowScene(_:performActionFor:completionHandler:)`, `UIFontMetrics.scaledValue(for:compatibleWith:)`). They are not added to `evals/ios-design/ApiProbe.swift`.
- **Owner decisions** recorded as observations, not rules: the app-wide theme preference, and the Trash request.
- **Not verified:** Icon Composer `.icon` builds, and dark or tinted Home Screen icons on a device.
- **Independent review of `7d29e88`: REQUEST CHANGES (Opus 5.5).** Fixed:
  - The false "no simulator tooling for Bold Text or shake" line now points to Settings, Environment Overrides and Device > Shake.
  - The no-alpha icon rule now applies only to the default icon, since dark variants may be transparent.
  - The theme guidance agrees across files: `hig-foundations.md` points to `content-apps.md`, the trade-off is put to the owner, and the owner's choice is a dated observation in the notes.
  - Home Screen icon styles can be switched with Customize in the simulator.
  - Removed an unverified CSS claim, and corrected the cause of Bold Text not reaching web content.
  - Clarified compiler-version gating and the tinted JSON, and dropped an unverified glass claim.
  - Split the evidence above by kind.
- **Re-review of `505baf6`: APPROVE (Opus 5.5).** One low finding was fixed in the next commit: the reason sheets need the theme reapplied is now stated accurately (tokens derived from each presentation's `colorScheme`, and per-controller UIKit overrides). The icon-check wording in `hig-system.md` now matches the checklist.
- **Checks (tested):** at `819702e`, `npm run build:native`, `npm test` (43/43, on three consecutive runs) and `claude plugin validate .` passed. One earlier run had a single failure in "store permissions are private and public records reject", a Handoff test this change does not touch; it did not reproduce, including on unmodified `origin/main` at the time (`fd2f711`). The install layout is unchanged (one new reference file), so `npx skills` and Codex install checks were not rerun.
- **Devin Review of `819702e`:** no issues found.
- **Ships as 0.1.3, not 0.1.2** (tag `ios-design--v0.1.3` on the merge commit): the rename PR (#8) merged first and released `ios-design--v0.1.2`, so this change was squashed onto `138eee4` as 0.1.3. Conflicts were confined to `releases.json` (0.1.2 kept, 0.1.3 added), the README release line and this file; the plugin folder merged cleanly. After the rebase, `npm run build:native`, `npm test` (46/46) and `claude plugin validate .` pass.
- **Re-review of `694099f`: APPROVE (Opus 5.5).** Confirmed the skills folder is byte-identical to the approved `819702e`, the 0.1.2 digest is unchanged and 0.1.3 matches, and reran the checks (46/46). Two wording nits in this section were fixed.
- **Devin Review of `694099f`:** one finding, fixed. The README's copyable pins (the `npx` tag URL, the Claude settings example and the Codex marketplace command) still named `workflow--v0.1.2`, which carries ios-design 0.1.2; they now pin `ios-design--v0.1.3`, which carries both current versions.

- **Release (recorded in #11).**
  - **Verified with git and the GitHub API:**
    - PR #9 merged as `b3d41dc`. Its second parent is the approved head `2c7b9c0` (first parent `138eee4`), and its tree is identical to `2c7b9c0`. The session that merged it reports using `--match-head-commit 2c7b9c0`.
    - The annotated tag `ios-design--v0.1.3` (`e402f52`) points at `b3d41dc`.
    - CI passed on `b3d41dc` (all six jobs).
  - **Reported by the session that made the release:**
    - With an isolated `CLAUDE_CONFIG_DIR`, `claude plugin marketplace add akhilvuputuri/skills@ios-design--v0.1.3` installed ios-design 0.1.3 (with `references/implementation.md`) and workflow 0.1.2.
    - A local `npm test` on the owner's Mac failed two or three different Handoff tests per run, at a load average of about 22. Hypothesis: flakiness under load, since CI passed and a later local run passed 46/46.

## Rename to akhilvuputuri/skills; workflow and ios-design 0.1.2 — 15 October 2026

- **Change:** the GitHub repository `akhilvuputuri/a-stack` was renamed `akhilvuputuri/skills` (reported: `gh repo rename`; GitHub redirects the old URL, and `git ls-remote` of the old URL returned the same HEAD). This PR renames everything inside it.
  - **Marketplace.** Both marketplaces are now named `skills`, so plugin IDs become `workflow@skills` and `ios-design@skills`. That breaks existing `@a-stack` pins, so both plugins move to 0.1.2 and need new tags. The adopt skill gained migration steps for repositories that pin `a-stack`.
  - **Text.** URLs, titles and prose say `skills`; CORE.md and the workflow's Codex display name drop the brand.
  - **Handoff.** The store default is `~/.local/share/handoff` and the variable `HANDOFF_DATA_DIR`. `ASTACK_DATA_DIR` is still read when the new variable is unset, and an existing `~/.local/share/a-stack` is used while the new directory doesn't exist, so current stores keep working without moving private data. Installs write `.handoff-version` and `--replace` still recognizes `.a-stack-version`. Release files are `handoff-install-*` and `handoff-skills-*`. Handoff stays 0.1.2, because 0.1.2 was never released. `ASTACK_NODE_HEADERS` is still read after `HANDOFF_NODE_HEADERS`.
  - **Not renamed:** dated entries below, and `docs/installation-research.md`, keep the names and links of their time; the old links redirect.
- **Tests:** three new Handoff tests cover data-directory resolution (new default, legacy directory, both variables, and a CLI `get` from a legacy store under a scratch `HOME`), the installer marker (new marker written, legacy-marked install replaced), and an explicit `--data-dir` (or `--version`) working when the default locations can't be read.
- **Checks** (15 October 2026, macOS arm64, Node 22):
  - `npm run build:native`; `npm test` passes 46/46, including the release-artifact build and offline installer test. `claude plugin validate .` passes.
  - **Claude:** isolated `CLAUDE_CONFIG_DIR`, `claude plugin marketplace add <checkout>` registers `skills`; `workflow@skills` and `ios-design@skills` install at 0.1.2.
  - **Codex:** `codex-cli 0.159.2`, scratch `CODEX_HOME`: marketplace `skills` added, both plugins installed at 0.1.2.
  - **npx:** `skills@1.5.18`, scratch `HOME`: `--list` against this checkout finds 8 skills.
  - **Old registration** (tested, isolated `CLAUDE_CONFIG_DIR`): with a base checkout added as `a-stack` and `workflow@a-stack` installed, `claude plugin marketplace remove a-stack` removed the plugin too, and adding this checkout then registered `skills`.
- **CI at `4f9c5aa`:** the legacy-store test failed on every CI runner (Linux and macOS, Node 22 and 24) with "Store entries must be owned by you with user-only permissions" but passed locally on Node 22.15. The test had copied a store with `fs.cpSync`. Hypothesis: the CI Node versions don't keep the 0700 directory modes on copy. The test now moves the store with `renameSync`. Test-only change.
- **Independent review, round 1** (Opus 5.5, head `7a4ea8f`): REQUEST CHANGES.
  - **Medium:** the CLI resolved the default store before reading arguments, so with `~/.local` unreadable or a file, an explicit `--data-dir` and `--version` failed. Fixed: the default is resolved only when no directory is given, with a regression test that fails before the fix.
  - **Low:** README still named `ASTACK_NODE_HEADERS`; fixed. README and the adopt note lacked steps for an existing `a-stack` registration and for Codex contributors; added. The publish-handoff skill assumed `HANDOFF_DATA_DIR` is set; it now names the resolved store.
  - **Accepted risk:** once `~/.local/share/handoff` exists, a legacy `~/.local/share/a-stack` is no longer read (documented: move the directory to migrate), and an older install that still writes to `a-stack` would split stores from a fresh install.
- **Not verified:** installing from GitHub at the new tags, which don't exist until merge; Codex project config; agents other than Claude Code and Codex.

## npx and Codex installation; workflow and ios-design 0.1.1 — 14 October 2026

- **Change:** `npx skills add akhilvuputuri/a-stack` (and Codex's plugin marketplace) now install the instruction skills, the way `addyosmani/agent-skills` does.
  - **One plugin layout.** Every marketplace plugin now lives at `plugins/<name>/skills/<skill>/SKILL.md`. `ios-design` moved from `skills/ios-design` to `plugins/ios-design/skills/ios-design`. Codex discovers skills only in this layout. It ignored a `SKILL.md` at the plugin root with `skills` set to `"./"`, `"."` or omitted. The Claude skill name stays `/ios-design:ios-design`.
  - **Codex manifests.** `.agents/plugins/marketplace.json` and each plugin's `.codex-plugin/plugin.json` were added. The workflow's Codex manifest points `hooks` at an explicit empty `.codex-plugin/hooks.json`, so Codex doesn't discover the Claude hook (see the review below).
  - **Handoff hidden from npx.** Handoff stays in `skills/`, and `metadata.internal: true` hides it from `npx skills`.
  - **Rules from the chief-agent review, upstreamed into CORE.md and the AGENTS.md block:**
    - Refetch whenever the last fetch can't be shown to be current.
    - If the git identity is unset or shows an agent, stop and ask; never set one yourself.
    - A supplied memory or context item is not proof that the model used it.
  - **Docs.** The adopt skill and README gained Codex and npx guidance. The README now opens with install commands.
  - **Versions:** `ios-design` 0.1.1 and `workflow` 0.1.1.
- **Tests:** `tests/marketplace.test.cjs` now requires:
  - the unified layout, with only Markdown, `.codex-plugin/plugin.json` and the workflow hook;
  - plain skill frontmatter;
  - the Codex marketplace and manifests to mirror the Claude marketplace (names, versions, descriptions, local paths, `skills: "./skills/"`, no hooks);
  - `skills/` to hold only the two Handoff skills, both `internal`.

  The immutability test now reads each tag's own `.claude-plugin/marketplace.json` for the source path, so moved plugins keep their released digests verified. `ios-design--v0.1.0` and `workflow--v0.1.0` both pass at their old paths.
- **Checks** (14 October 2026, macOS arm64):
  - `npm test` passes 43/43. `claude plugin validate` passes for `.`, `plugins/ios-design` and `plugins/workflow`.
  - **npx:** `skills@1.7.0`, in a scratch `HOME`.
    - Run against this checkout, `--list` finds 8 skills: ios-design plus the seven workflow skills. With `INSTALL_INTERNAL_SKILLS=1` it finds 10.
    - `--skill '*' -a claude-code -a codex --copy` installed all 8 into `.claude/skills` and `.agents/skills`, including ios-design's 8 references and the workflow templates.
    - On `main` before this change, an npx-installed Handoff helper failed with "Filesystem addon unavailable".
    - A tag URL (`.../tree/ios-design--v0.1.0`) resolved that tag's skills.
  - **Codex:** `@openai/codex@0.159.1`, scratch `CODEX_HOME`. `plugin marketplace add <checkout>` and `plugin add` installed both plugins at 0.1.1. `codex debug prompt-input` lists `ios-design:ios-design` and the seven `workflow:*` skills in the model-visible prompt.
  - **Claude:** an isolated `CLAUDE_CONFIG_DIR` install from this checkout gives ios-design 0.1.1 (1 skill, no hooks) and workflow 0.1.1 (7 skills, 1 SessionStart hook).
- **Not verified:**
  - Installing from GitHub. The tags for this layout don't exist until merge, so `npx skills add akhilvuputuri/a-stack` and `codex plugin marketplace add akhilvuputuri/a-stack` were run against a local checkout only.
  - Codex project config (`.codex/config.toml`) enabling plugins in a trusted project.
  - Any agent other than Claude Code and Codex.
  - The model seeing the Claude hook output in an authenticated session.
- **Independent review of `2b4729d` (Opus 5.5):** REQUEST CHANGES.
  - **Blocking.** Codex discovers `hooks/hooks.json` by default when its manifest doesn't define `hooks`. The app-server `hooks/list` call returned `workflow@a-stack:hooks/hooks.json:session_start` with `command: "cat"`: Codex had dropped the Claude-only `args`. If a user trusted it, the hook would print the SessionStart input instead of CORE.md. The PR's claim that the plugin had no Codex hooks was wrong.
  - **Non-blocking:**
    - The Codex project instructions left out `codex plugin add`, and enabling a plugin in project config does not install it.
    - `metadata.internal` also hides Handoff in the release ZIP route.
    - The AGENTS.md block lacked the supplied-memory rule. a-stack's own block lacked the new rules.
    - The tests no longer pinned ios-design's skill name, any plugin could carry a hook, and a tag missing from its marketplace failed with an unclear error.
- **Follow-up:**
  - **Codex hooks.** First tried `"hooks": []`; `hooks/list` still reported the hook, so that doesn't work. Then pointed `hooks` at an explicit `./.codex-plugin/hooks.json` containing `{"hooks": {}}`. After a reinstall, `hooks/list` reports 0 workflow hooks, and `prompt-input` still lists all seven workflow skills. A test requires this, and removing the key fails it.
  - **Install docs.** The README and adopt skill now include `codex plugin add`. The ZIP route documents `INSTALL_INTERNAL_SKILLS=1`.
  - **Rules.** The block and a-stack's AGENTS.md carry all three upstreamed rules.
  - **Tests.** They pin each plugin's skill inventory and allow hooks only for workflow. A missing plugin in a tag's marketplace now fails with a clear message.
  - The unreleased workflow 0.1.1 digest is re-recorded. `npm test` passes 43/43, and `claude plugin validate` passes for all three.
- **Release:** pending re-review. Tag the reviewed merge commit `workflow--v0.1.1` and `ios-design--v0.1.1`.

## Workflow plugin — 14 October 2026

- **Change:** adds `workflow` 0.1.0, a bundle plugin at `./plugins/workflow`. It extracts the generic engineering workflow from chief-agent's AGENTS.md, REVIEW.md and its cloud-workflow, portable-development, releases, journal, troubleshooting and development-process docs, as read from chief-agent `origin/main` `e4b71ad`. It also folds in owner preferences recorded in Claude memory: commit identity, foreground-only reviewers, shared-worktree hazards, and docs shipping with every change. Chief-specific architecture, product rules and infrastructure stay in chief-agent.
  - **Contents:** `CORE.md` holds the always-on rules (5,286 characters). `hooks/hooks.json` is an exec-form SessionStart hook that runs `cat ${CLAUDE_PLUGIN_ROOT}/CORE.md`, with no matcher, so it fires on startup, resume, clear and compact. There are seven skills: `preflight`, `independent-review` (with its reviewer prompt and review contract), `ship`, `journal` (with entry and index templates), `incident`, `experiment` and `adopt` (with the AGENTS.md block).
  - **Adoption:** a repository pins the plugin in its `.claude/settings.json` and puts the workflow block at the top of its AGENTS.md. The block names the pinned tag, repeats five non-negotiable rules for agents that only read AGENTS.md, and holds the repository's bindings.
  - **This repository:** a-stack's own AGENTS.md now follows the workflow from its in-repo source and states its bindings.
- **Tests:** `tests/marketplace.test.cjs` now distinguishes `skill` plugins (unchanged rules for `ios-design`) from `bundle` plugins. For a bundle it requires:
  - the source is `./plugins/<name>`, with the default `skills/` scan
  - only Markdown files plus `hooks/hooks.json`, and no symlinks
  - each `skills/<dir>/SKILL.md` declares `name: <dir>` and a description
  - `CORE.md` stays under the 10,000-character hook output cap and lists every skill
  - the hook config is exactly the single `cat CORE.md` hook

  The workflow digest is recorded for 0.1.0.
- **Checks:**
  - `npm test` passes 42/42.
  - `claude plugin validate .` and `claude plugin validate ./plugins/workflow` pass (Claude Code 2.1.283).
  - In an isolated `CLAUDE_CONFIG_DIR`, `claude plugin marketplace add <checkout>` plus `claude plugin install workflow@a-stack` installed it. `claude plugin details` lists 7 skills and 1 SessionStart hook, with about 575 tokens of always-on skill-description context. The details view does not count the hook's output.
  - With `--plugin-dir plugins/workflow` and `--debug-file`, the debug log shows `Loaded 7 skills` and `Hook SessionStart:startup (SessionStart) success`, carrying the full CORE.md text as plain-text hook output.
- **Mutation checks:** the test suite fails for each of these: an edit to CORE.md without a version bump, a changed hook command, an added shell script, and a renamed skill folder. The clean tree passes.
- **Not verified:**
  - **Model context:** that the model sees the hook output in an authenticated session. The CLI in the build sandbox was not logged in, so no model turn ran. The debug log and Claude Code's documented SessionStart plain-stdout behavior support it.
  - **Cloud sessions:** that cloud sessions (claude.ai/code) install project-pinned plugins and run their hooks.
  - **Folder trust:** automatic registration when a contributor trusts a repository.
  - **Other agents:** Codex or other agents. For those, the AGENTS.md block is the supported path.
- **Independent review of `1ef612b` (Opus 5.5):** REQUEST CHANGES.
  - **What it reproduced:** validation, the marketplace tests, `npm pack --dry-run`, the hook format against the Claude Code docs, fidelity to the chief-agent sources, and that ios-design's guarantees are preserved.
  - **Blocking finding:** the review skill allowed a backgrounded reviewer "when your next step does not depend on it", which is weaker than the owner's foreground-only rule.
  - **Non-blocking findings:**
    - Skill frontmatter could declare `hooks:` and still pass the tests after a version bump. This gap already existed for ios-design.
    - The adopt skill could overwrite an existing a-stack `ref` and downgrade another plugin, or pin a tag whose versions are not all released.
    - The AGENTS.md block said "behavior change" where CORE.md says "every change".
    - The journal index template linked a `TEMPLATE.md` that the skill never told agents to create.
- **Follow-up:**
  - The reviewer always runs in the foreground.
  - A test now requires every marketplace SKILL.md frontmatter to hold exactly `name` and `description`. Mutation check: adding `hooks: {}` to a skill fails the structural test.
  - The adopt skill keeps or upgrades an existing ref without downgrading, pins only fully released tags, and writes the actual ref into the block, now parameterised as `<REF>`. The README states the same rule.
  - The block wording now matches CORE.md.
  - The journal skill copies the entry template to `TEMPLATE.md` when it creates a journal.
  - The unreleased 0.1.0 digest is re-recorded. `npm test` passes 42/42 and `claude plugin validate .` passes.
- **Release:** pending re-review. The tag `workflow--v0.1.0` will be cut from the reviewed merge commit.

## Claude Code plugin marketplace — 13 October 2026

- **Change:** a-stack is now a Claude Code plugin marketplace (`.claude-plugin/marketplace.json`, named `a-stack`). It lists only instruction-only skills: currently `ios-design` 0.1.0, sourced from `./skills/ios-design`, with `skills: ["."]` so the plugin root holds `SKILL.md` directly.
- **Handoff excluded:** Handoff stays on the release installer. Its native addon is built per platform, and one marketplace entry can't select a build.
- **New test:** `tests/marketplace.test.cjs` enforces the allowlist, the source path, the skill name, the version format, and that plugin folders contain only Markdown and no symlinks. A mutation check that added `publish-handoff` to the marketplace made both tests fail.
- **Checks:**
  - `claude plugin validate .` passes (Claude Code 2.1.283).
  - In an isolated `CLAUDE_CONFIG_DIR`:
    - `claude plugin marketplace add <checkout>` plus `claude plugin install ios-design@a-stack` installed the plugin at user scope with `SKILL.md` and all eight references. `claude plugin details` reports one skill and about 115 tokens of always-on context.
    - With `--scope project`, the CLI wrote the `extraKnownMarketplaces`/`enabledPlugins` shape the README documents, and listed the plugin as enabled at project scope.
  - `npm test` passes 38/38.
- **Independent review of `b6ec2ac`:** REQUEST CHANGES.
  - **What it reproduced:** validation, a local install, a GitHub install pinned with `ref` (at user and project scope), 38/38 tests, and the mutation checks.
  - **Blocking finding:** moving a project to a new `ref` without bumping the plugin's `version` leaves users on the cached copy.
  - **Low findings:** the Handoff exclusion was worded too absolutely, and the Codex copy steps were fragile and unverified.
  - **Follow-up:** adopts the `<plugin>--v<version>` tag convention, documents the bump rule, and adds a README-tag/version test. Codex steps now replace the folder, use a temporary clone, and say Codex discovery is unverified.
- **Independent re-review of `1352897`:** APPROVE. Its non-blocking notes: the version-bump rule was enforced only by documentation, the Codex "no project pin" sentence was unverified, and the temporary clone wasn't cleaned up.
- **Devin Review of `1352897`:**
  - **Bug:** "fresh Codex installs miss the skill". This targeted the earlier snippet, which lacked `mkdir -p`. I ran the current snippet's steps against an empty temporary `HOME`, cloning the `claude-plugin-marketplace` branch because the tag didn't exist yet. It installed `SKILL.md` and all references, and a second run removed a planted stale file.
  - **Flag:** version bumps rely on discipline.
- **Follow-up:**
  - `.claude-plugin/releases.json` records a SHA-256 digest of the skill folder for each version, and a test requires the current content to match the current version's digest. Mutation checks: a content change without a bump fails; a bump without a recorded digest fails.
  - The Codex wording is softened, and the snippet removes its temporary clone.
- **Independent re-review of `43cc615`:** APPROVE. It reproduced the digest independently in Python and confirmed byte stability (all files mode 100644, no `.gitattributes`). Notes: the distinct-digest rule blocked legitimate reverts, a Finder `.DS_Store` broke the tests locally, and the Codex run record didn't say which ref it used.
- **Devin Review of `43cc615`:** one bug. Editing the skill and overwriting the same version's digest would pass, leaving users on a cached copy.
- **Follow-up:**
  - Released versions are now immutable. When the tag `<name>--v<version>` exists, a test recomputes that version's digest from the tagged git blobs (`ls-tree` and `cat-file`, with fsmonitor disabled and no filters) and requires it to equal the recorded digest. CI checks out full history so tags are present.
  - Mutation check with a temporary local tag: the clean state passes, which also shows the git-based and file-based digests agree; overwriting the released digest fails. The tag was deleted afterwards.
  - The distinct-digest rule is removed, `.DS_Store` is ignored, and the Codex run record now names the branch it used.
- **Not verified:** automatic registration when a contributor trusts a repository whose committed settings declare the marketplace. This happens at interactive session start and was not exercised. Installing from GitHub at a tag needs the tag to exist; `ios-design--v0.1.0` will be cut from the reviewed merge commit.

## ios-design reader theme scope — 13 October 2026

- **Change:** follow-up to the HIG pass, from the reviewer's optional suggestion. As of the PR's final head (`5b8b838`, merged as `bedb8b4`), `content-apps.md` recommends:
  - a `.fullScreenCover` reader with `.preferredColorScheme` applied inside it
  - `.preferredColorScheme` inside every sheet the reader presents
  - for UIKit, a full-screen `UINavigationController` carrying `overrideUserInterfaceStyle`

  It advises against a pushed reader for themed reading.
- **Pitfall:** `.preferredColorScheme` on a view pushed in the main stack restyles the whole window while shown; this was observed. The same is documented, not observed, for a window or root `overrideUserInterfaceStyle`.
- **Checklist:** a new item requires the system style to return after leaving the reader.
- **Checks:**
  - `ApiProbe.swift` covers these APIs and typechecks against the iOS 26.2 simulator SDK.
  - `quick_validate.py` passes.
- **Simulator evidence:** the independent reviewer built a scratch probe app on the iPhone 17 Pro simulator (iOS 26.3.1, system in Light Mode, reader forced dark). It recorded interface styles, bar styles, and the web view's `prefers-color-scheme`, with screenshots. The guidance now reflects those observations.
- **Not verified:** devices, iPad, a system Dark Mode setting, and scroll-edge transitions. The repository probe is compile-only.
- **Devin Review of `c779ed3`:**
  - **Bug:** `.toolbarColorScheme` applies only while the bar background is visible, so see-through glass bars could keep the system style.
  - **Flag:** the probe can't show rendering.
  - **Response:** the guidance now leads with a full-screen presentation plus `.preferredColorScheme`, where Apple documents scoping to the presentation. It qualifies the pushed-reader approach and requires a simulator check of both scroll-edge states. The probe is labelled compile-only.
- **Independent review of `5230d79`:** REQUEST CHANGES, based on simulator observation.
  - Sheets opened from a full-screen reader keep the system style unless they set their own color scheme.
  - A UIKit override on a pushed controller leaves the parent's bars in the system style.
  - A pushed SwiftUI reader drew its large title dark-on-dark.
  - SwiftUI `.preferredColorScheme` on a pushed view reverted after going back; it didn't persist. The UIKit window or root override was not tested.
  - All four are reflected in the follow-up commit.
- **Independent re-review of `cebac2e`:** APPROVE. Its non-blocking wording notes (which results were observed versus documented, and the bottom bar's adaptive glass) are addressed in the next commit, which needs Devin and reviewer confirmation.

## ios-design HIG pass — 13 October 2026

The first version drew on Apple's Liquid Glass overview and secondary sources, not the Human Interface Guidelines themselves. This pass read the HIG directly:
- **Source:** Apple serves the HIG as structured page data. All 173 pages were fetched into a scratch directory, outside the repository.
- **Coverage:** the 95 pages relevant to iOS and iPadOS were read. Subsections specific to macOS, tvOS, visionOS and watchOS were dropped. The core pages were read in full; minor control pages were read through their rule statements.

New references: `hig-foundations.md`, `hig-components.md`, `hig-writing.md`, and `hig-system.md`.
- They paraphrase the guidance, with only short example quotations, and link each section to its HIG page.
- Every linked page slug exists in the fetched set.
- The Dynamic Type table was transcribed from the HIG's typography specifications.

Corrections to earlier guidance:
- **Chevrons:** the HIG prescribes disclosure indicators for drill-in rows, so they are no longer described as optional.
- **Undo:** an Undo affordance should not auto-dismiss on a timer, because the HIG asks to minimize time-boxed UI.
- **Popovers:** they are discouraged in compact width, so iPhone typography controls use a medium-detent sheet.
- **Appearance:** app chrome should follow the system light/dark setting. The HIG discourages app-specific appearance settings; reading themes remain acceptable for the reading surface.
- **Principles:** Apple's current eight principles replace the older framing as the primary HIG summary.

Checks:
- `ApiProbe.swift` now also covers the following, and typechecks against the iOS 26.2 simulator SDK:
  - paging scroll behavior, presentation detents, drag indicator, compact adaptation
  - `dynamicTypeSize.isAccessibilitySize`, `requestReview`, `undoManager`
  - standard materials, `widgetAccentable`, `ContainerRelativeShape`, `SiriTipView`
  - `confirmationDialog`, `UIBarButtonItem.Style.prominent`
- `quick_validate.py` passes, internal reference links resolve, and `npm test` passes 36/36.
- Not done: no behavioral re-evaluation of the revised text, and no simulator rendering checks.
- Independent review of `374bb19` (separate Claude Opus 5.5 subagent): **REQUEST CHANGES**.
  - **What it checked:** about 70 claims against the fetched HIG text, all 33 cells of the Dynamic Type table, an 8-word overlap scan for copying, the probe, links, and tests.
  - **Blocking finding:** `hig-foundations.md` reintroduced Increase Contrast as a fallback, contradicting the default-settings contrast rule.
  - **Low findings:** paging overlap isn't provided by `.paging`; "don't" was overstated where the source says "reduce"; and minor wording issues.
  - **Status:** all fixed in the follow-up commit, which needs renewed review.
- Re-review of `0f69476`: **APPROVE**.
- Devin Review flags, read in the Devin app because they were not posted to GitHub:
  - **Contrast fallback:** already resolved.
  - **Theme conflict:** reading themes vs. chrome matching. A sepia page in Dark Mode couldn't satisfy both rules. Now the reader screen takes its interface style from the theme's luminance, and the rest of the app follows the system.
  - **Stale inventory:** an earlier entry here still said four references. Fixed.
  - Both fixes need renewed review.

## ios-design skill — 13 October 2026

`skills/ios-design` is an instruction-only skill (at that time, SKILL.md plus four references; the HIG pass above brought it to eight); it has no helper, runtime, or store access, and it is not part of the Handoff release installer. Install it by copying the folder. Its runtime environment is whatever agent loads it; only the checks below were performed.

- Frontmatter/naming: the skill-creator `quick_validate.py` passes for `ios-design`, `publish-handoff`, and `resume-handoff` (Python 3.13 with a pre-installed PyYAML).
- API names: `evals/ios-design/ApiProbe.swift` uses the iOS 26-specific SwiftUI APIs the references name (plus several older ones) and typechecks against the iOS 26.2 simulator SDK (Xcode on macOS 26.1). The probe caught an error copied from Apple's overview: `ToolbarContent.hidden(_:)` is unavailable on iOS, so the reference now recommends conditional toolbar content. Behavioral claims about iOS 26 rendering (row padding, scroll edge effects) come from Apple's "Adopting Liquid Glass" overview and were not observed in a simulator.
- Fixture: `evals/ios-design/EpisodeLibrary.swift` is synthetic, typechecks at an iOS 26 target, and fails at its stated iOS 17 target only on the intentionally ungated `glassEffect`.
- Behavioral evaluation: a separate Claude Opus 5.5 subagent loaded the skill and ran the `full-audit`, `narrow-change`, and `glass-everywhere` cases in isolated scratch Git workspaces. All include/exclude criteria were met on that earlier draft; the final text has not been re-evaluated behaviorally. The audit left its workspace unchanged, the narrow change was a one-line title edit, and the glass request produced an explanation with a native alternative and no edits. No simulator, VoiceOver, or screenshot checks were run. The evaluator's critique led to these changes: an explicit rule for requests that conflict with the principles, a narrower P0 definition with grouping, a shorter finding format, side-effect disclosure for narrow edits, a neutral (non-serif) text-style example, "verify before mirroring" wording for VoiceOver swipe actions, contrast required at default settings, a `scrollContentBackground` note for themed lists, and a typecheck/preview fallback when no runnable project exists. The `sepia-theme` and `screenshot-only` cases were not run.
- `npm run build:native` and `npm test` (36/36) pass locally on macOS arm64; no helper code changed.
- Independent review (separate Claude Opus 5.5 subagent) of `2ff7e8e`: REQUEST CHANGES. It found a probe-coverage overstatement, a missing "earlier draft" caveat, and a principles line contradicting the no-duplicate VoiceOver guidance. It also raised low-severity notes on web-view CSS (`viewport-fit=cover`, `font` shorthand order, prefixed hyphens), the large-text contrast cut-off, the swipe-edge convention, the Liquid Glass setting location, and a fixture comment that revealed a graded defect. The follow-up commit addresses all of them and needs renewed review.
- Re-review of `afc5cf2`: APPROVE, with one non-blocking wording nit (Undo or confirmation). Devin Review on `afc5cf2` flagged that "or bold" let small bold text pass at 3:1; the contrast rule now follows WCAG AA's 14 pt bold cut-off. That commit and the nit fix need renewed review.

## Current Node-only candidate — 6 October 2026

Handoff 0.1.2 now runs on Node 22+ with a bundled filesystem addon. The Python results below are retained historical evidence, not approval of the Node port. The current native build explicitly targets macOS 11+; Linux CI builds on Ubuntu 22.04 for a glibc 2.35 baseline. Older-OS loader execution and musl/Alpine support are not established.

The Node port has 36 grouped tests passing locally on macOS arm64 / Node 22.15.0. [CI run 37457918337](https://github.com/akhilvuputuri/a-stack/actions/runs/37457918337) passed all six jobs at `cc242d6fa9528062ceef602ade39b332be46c9ac`: macOS arm64, macOS Intel, and Linux, each on Node 22 and 24. The build-floor/documentation follow-up requires refreshed current-head CI and review; passing older-head checks do not approve it.

A separate GPT-6 Astra reviewer approved the native/installer/release scope of `cc242d6`, independently passing all 36 tests plus 1,000 native boundary/resource cycles with stable open-descriptor counts and an unchanged outside sentinel. It identified the implicit build-host macOS floor as a compatibility limitation; the follow-up sets `-mmacosx-version-min=11.0`, verified locally with Mach-O `LC_BUILD_VERSION minos 11.0`. Full implementation review remains pending on the final head.

An independent skill evaluation used the installed Node publishing and receiving helpers on synthetic mixed-topic context. It saved only the duplicate-reply investigation, retained rejected approaches and uncertainty, excluded unrelated content, and resumed for orientation without code/status/record mutation. No Python or network operations were used. Freshness remained unverifiable for unavailable code/logs.

An isolated `npx skills` installation attempt with npm version 1.5.18 did not support the direct localhost archive route described by repository main: it sought a well-known discovery endpoint and found no skills. The direct Node installer is tested; npx archive installation remains unverified and is not advertised as a working supported route. No registry package for a-stack was published.

Devin enrollment and public release publication remain pending owner confirmation of the prepared repository-specific GitHub App access. No runtime usage depends on Devin. Native OS-level egress isolation and actual host automatic skill discovery remain unverified.

Checked on 2 October 2026 (Asia/Singapore), using macOS 26.1. All data used for these checks is synthetic. No real work handoffs are in this repository or its bundle.

## Deterministic helper checks

34 tests pass on Python 3.12.14 and 3.14.7:

```sh
python3 -m unittest discover -s tests -v
```

Coverage includes schema/evidence validation, unknown schema rejection, malformed JSON, duplicate keys, private permissions, traversal and symlink rejection, store/source separation, interrupted writes and retries, concurrent same-ID writes, competing successors and explicit reconciliation, missing predecessors, cycles and long revision chains, project isolation, worktree sharing, explicit clone mappings, Git environment/fsmonitor defenses, relevant dirty-state inspection, changed commits, draft/list separation, read-only export, preserved inputs and prior successful writes after failures, code-only updates, preservation of unexpected installation files, allowlisted packaging, and independently installed producer/receiver helpers in fresh processes.

Each child Python helper process runs with a test-only audit hook that rejects all `socket.*` operations and records any attempt. A canary test confirms the hook blocks network use. Actual helper operations produced no Python socket attempts, including operations storing issue URLs as metadata. Git commands are local metadata reads; fsmonitor execution is explicitly tested as disabled. Local-clone setup in tests uses filesystem paths only.

OS-level network denial could not be independently enabled in this host: `sandbox-exec` returned `sandbox_apply: Operation not permitted`. Python socket isolation is verified; native-process network isolation/attempt capture is not verified here. Re-run the suite in a host/container with egress disabled before claiming the PRD's full OS-level offline release gate. No extra network mechanism or permissions were added to bypass that limitation.

Both skill folders pass the bundled skill-creator `quick_validate.py` frontmatter/naming/scaffold validator. Its YAML dependency came from an already cached development library; Relay and its installer remain standard-library-only.

## Behavioral checks

An independent agent used the installed publishing skill on the synthetic three-topic conversation. It saved only the duplicate-reply task, retained the later rejection of the in-memory flag, marked retry/restart behavior uncertain, recorded missing raw logs/code and no tests, and generated no implementation. It used the installed resume skill to retrieve the record, report unverifiable freshness, and leave stored bytes unchanged.

That first pass named excluded topic titles in a scope boundary. The publishing instruction was tightened to describe selected scope in the record and keep excluded title acknowledgments in the receipt. The independent follow-up exercised six isolated cases with the updated installed skills:

| Case | Observed result |
| --- | --- |
| Selected duplicate-reply task | One scoped record; excluded topic titles remained outside the record; correction, uncertainty, constraints, and next action retained. |
| Conversational “issue 2” | Calendar topic selected; no GitHub number assumption. |
| Draft only | Rendered private draft; published list empty. |
| Two selected topics | Two distinct handoffs, each with isolated topic context. |
| Repository-qualified issue reference | `example/repo#42` retained literally as metadata; no external retrieval. |
| Ambiguous selection among three topics | One focused clarification proposed; no published record. |

The follow-up produced five handoffs across isolated case stores, with distinct project IDs. Resume retrieved the selected record and preserved record/status/project bytes. The evaluator reported no further deviations, no implementation, no invented acceptance criteria or test passes, and no network calls. These are qualitative agent evaluations of designated facts and exclusions, not assertions that future models will always select context correctly.

A separate receiving agent, given only the handoff ID, project path, data root, and installed resume skill, retrieved the same record without seeing the original conversation or another evaluation report. It recovered the selected goal, constraints, rejected approach, uncertainty, and next action. It made no code/store changes. This demonstrates a handoff between two local agent contexts with shared filesystem access; it does not establish compatibility with different agent products.

## Compatibility

| Environment | Skill loading | Terminal/runtime | Data access | Result |
| --- | --- | --- | --- | --- |
| Local Codex agent evaluation | Installed skill loaded explicitly by path | Python helper commands | Shared private local store | Publish and fresh-session resume demonstrated |
| Python 3.12.14, macOS 26.1 | Not an agent host | Complete deterministic suite | Temporary local stores | 34/34 pass |
| Python 3.14.7, macOS 26.1 | Not an agent host | Complete deterministic suite | Temporary local stores | 34/34 pass |
| Codex automatic skill discovery/UI invocation | Not exercised | Available locally | Not installed globally by this build | Unverified |
| Other local coding agents | Not exercised | Depends on host | Requires shared store access | Unverified |
| Python 3.11 / Linux | Not exercised | Intended minimum/runtime platform | Requires compatible POSIX filesystem | Unverified |
| Windows | Not supported | POSIX filesystem primitives required | — | Unsupported in 0.1 |
| Hosted agent without local filesystem access | — | — | Cannot access this store | Unsupported |

The extracted offline bundle installs both skills without dependency downloads. A separately installed publishing helper creates a record and a separately installed receiving helper reads it in another process. Updating a recognized installation preserves every runtime JSON file byte-for-byte. The bundle contains generic source and synthetic checks only, and uses an explicit allowlist.

The complete 34-test suite also passed from an extracted bundle with the Python network tripwire enabled in the parent test process and helper child processes. The parent reported no unexpected Python network attempts.

Pending broader validation: actual target-agent discovery/permissions, the remaining behavioral fixtures (including implementation against changed code and hostile stored instructions at the agent level), Linux/minimum-Python testing, and native-process egress isolation. Helper-level hostile-text non-execution and changed-state detection are covered. This build is a tested local MVP, not a claim that every PRD deployment environment/release gate has been exercised.

## Independent code review and v0.1.1 candidate

On 2 October 2026 a separate Codex agent reviewed initial commit `2dee350252e1102a46beaa744776abdaee299b3a`, including the full helper, installer, packager, schema, skills, docs, and tests. Its model identifier was not exposed. It independently ran all 34 original tests and reproduced four defects using synthetic scratch data:

| Finding | Resolution in this candidate |
| --- | --- |
| P1: Git status ran a repository-configured clean/process filter | Replace working-tree Git status with index metadata and raw-byte blob comparisons; skip submodule working-tree checks with a recorded limitation. Regression checks inspect and resume-state comparison for both driver types. |
| P2: Code file leaves could be directories, then deleted on replacement | Require regular files at expected leaves; preserve and reject unexpected directories. Test all affected leaf locations. |
| P2: Linking could race publication and hide a successful record | Serialize store resolution/mutation with a private store lock. A draft prepared for an old identity is rejected intact after a link. Test a paused link against a competing publication. |
| P2: Mapping chains split previously linked projects | Resolve chains transitively and validate cycles. Test shared retrieval through a chain and rejection of a malformed cycle. |

An additional installation reviewer was unavailable after capacity errors; its preliminary source-path observations motivated rejection of source symlinks and symlinked ancestors in installation/packaging. These changes remain in the final re-review scope.

The first v0.1.1 candidate had 43 passing tests on Python 3.12.14 and 3.14.7. New setup checks execute the one-file Python installer with no Git on PATH and networking disabled by the Python tripwire, verify independent installed helpers, preserve published bytes during an update from a v0.1.0 marker, inspect regular self-contained ZIP contents and SHA256SUMS, reject symlinked source ancestors, and verify agent destination shortcuts. This tests installation without cloning or source checkout; actual work-laptop host discovery remains unverified.

AGENTS.md now requires an independent implementation review and exact-head verdict, plus CI and requested Devin review before merge/release. REVIEW.md defines the applicable boundaries; docs/development.md records the process. Current-head re-review, GitHub CI, and actual Devin enrollment/completion are pending for this candidate and must be recorded on its PR. Repository instruction files alone do not enable Devin's account-side integration.

The independent reviewer returned REQUEST CHANGES for candidate `88cf15cbb7c92879a2392874278cca9a79cb6ce7`. It independently passed all 43 tests and verified resolution of the installation deletion and both project-linking defects, but reproduced two remaining P1 filter boundaries: valid driver names containing `=` bypassed command-line overrides, and a driver added between enumeration and status escaped overrides. Environment key/value pairs addressed the first case; the final approach removes the enumeration/status check/use sequence entirely in favor of raw byte comparisons and metadata-only Git commands. Regression cases retain both triggers plus staged, deleted, untracked, and symlink changes. Final-head re-review is required; this history preserves the rejected candidate rather than treating passing tests as approval.

Review of follow-up `b96820cd6ff99addd385f90bdd2e8fa53424db81` independently passed 46 tests and confirmed both filter triggers were resolved. The reviewer still returned REQUEST CHANGES after reproducing lazy promisor fetching through a cached comparison and an escaping-parent swap during a raw read. The next candidate denies all Git transport protocols and lazy fetching, and holds no-follow directory descriptors through the tracked file open. Synthetic regressions use an inert remote-helper canary and prove the outside inode is not opened or incorrectly treated as clean. All 48 tests pass locally on Python 3.14.7; exact-head independent re-review remains required before merge/release.

The independent reviewer returned **APPROVE** for exact implementation head `f5563313d01c10b84fb2ec0d4ead2bc064297d26`, with no actionable findings remaining in its scope. It independently passed all 48 tests and retested permissive/inherited promisor configuration, parent swaps before traversal and final open, leaf symlink replacement, and the earlier equals-named filter. No remote canary ran, outside inodes were not opened, dirty paths stayed visible, unavailable metadata remained explicit, and records stayed unchanged. [Recorded review verdict](https://github.com/akhilvuputuri/a-stack/pull/1#issuecomment-5936803385).

[GitHub CI run 36898791472](https://github.com/akhilvuputuri/a-stack/actions/runs/36898791472) passed all four jobs at that exact implementation SHA: macOS/Linux with Python 3.11/3.14, including release-artifact builds. This supersedes the initial platform table's unverified Linux/minimum-Python status for helper execution. Automatic host skill discovery and native OS-level egress isolation remain unverified. This follow-up changes validation/README evidence only; current-head approval remains required on the PR.

Devin enrollment is a separate, pending account-side step. The existing GitHub App selected only Chief; adding a-stack would expand its write access to this repository and requires the owner's permission confirmation. The repository-specific change is prepared, not saved. No completed Devin review or public v0.1.1 release is claimed while that step is pending.

## Node-only Handoff port — 6 October 2026

Candidate 0.1.2 replaces the Python runtime, installer, tests and builder with JavaScript executed by Node 22+. The helper is now Handoff. The schema remains v1, existing project IDs/store layout remain compatible, and the legacy lock filename is retained for cross-version coordination. Recognized Python installations can update to the new code without reading runtime handoffs.

Node lacks openat/flock in its built-in filesystem API; the release bundles a small Node-API C addon for descriptor-relative no-follow traversal, atomic no-overwrite linking, directory reads and store locking. Development/CI compiles it with local headers and a C compiler; installed users need only the matching Node release artifact. No automatic compiler/header/dependency downloads are present.

The initial port passes 36 grouped Node tests on macOS arm64 / Node 22.15.0, including prior reviewed failure triggers, legacy-record compatibility, input/schema/evidence rejection, revision conflicts, mapping/locking, process interruption, private permissions, symlinks, raw inspection, Git filters and promisor prevention, installation preservation, and independent installed producer/receiver helpers. The standalone installer and usage ran with an empty PATH and a Node network tripwire: no Python, Git, compiler or source checkout was available through PATH. Test group counts differ from the Python suite and do not imply one-for-one test equivalence.

Native OS-level egress isolation, actual target-agent discovery and npx archive installation remain unverified. Node current-head independent review and CI are pending; previous Python approvals do not cover this port. Devin access/enrollment is still pending owner approval and is not a requirement for using the installed skills. Release publication remains pending those requested development review gates.
