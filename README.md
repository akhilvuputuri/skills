# skills

Akhil's lean collection of coding and AI workflow skills for coding agents.

## Install

Any agent (Claude Code, Codex, Cursor, Copilot, Gemini and [70+ more](https://github.com/vercel-labs/skills#supported-agents)):

```sh
npx skills add akhilvuputuri/skills
```

This installs the skills in [`skills/`](skills). Add `--list` to browse, `--skill <name>` to pick, `-g` for every project, and `-a <agent>` to choose agents. For a reviewed release instead of the default branch, use a tag URL such as `npx skills add https://github.com/akhilvuputuri/skills/tree/skills--v0.2.0`.

**Claude Code:** the plugin is recommended, because only the Claude plugin adds the workflow's always-on core rules (a SessionStart hook). The Codex plugin deliberately ships no hooks.

```sh
claude plugin marketplace add akhilvuputuri/skills
claude plugin install skills@skills
```

**Codex** (CLI plugin marketplace):

```sh
codex plugin marketplace add akhilvuputuri/skills
codex plugin add skills@skills
```

**Handoff** needs a compiled helper per platform, so it installs only through the [release installer](#install-without-cloning). `npx skills` hides it.

| Skills | Use |
| --- | --- |
| `preflight`, `independent-review`, `ship`, `journal`, `incident`, `experiment`, `adopt` | Akhil's engineering workflow for coding agents, plus always-on core rules in Claude Code |
| `ios-design` | Audit or refine native iPhone/iPad interfaces using a source-linked digest of Apple's Human Interface Guidelines: Liquid Glass, Dynamic Type, accessibility, components, writing, app icons, and reading/offline-first patterns |
| `publish-handoff`, `resume-handoff` (release installer, in [`handoff/`](handoff)) | Save a short brief of a conversation (the whole goal, every workstream's status, and the current focus in depth), then resume it in another local agent session such as Codex or Claude Code |

### Moving from earlier installs

Up to 0.1.x this repository shipped two plugins, `workflow@skills` and `ios-design@skills`, and before that a marketplace called `a-stack`. From 0.2.0 the repository root is a single plugin, `skills@skills`.

- **Claude Code:** `claude plugin uninstall workflow@skills` and `claude plugin uninstall ios-design@skills`, then `claude plugin marketplace update skills` and install as above. If you still have `a-stack`, `claude plugin marketplace remove a-stack` removes it with its plugins.
- **Codex:** `codex plugin remove workflow@skills` and `codex plugin remove ios-design@skills` (or `…@a-stack`), then `codex plugin marketplace remove skills` (or `a-stack`) and add it again as above. Removing only a marketplace leaves its plugins enabled, so every skill loads twice; `codex plugin remove` still works after the marketplace is gone.

## Engineering workflow for every repository

The workflow skills centralise the development workflow that grew up in chief-agent, so other repositories can apply it without copying it.

- **Core rules** ([`CORE.md`](CORE.md)) cover fresh-state preflight, capability checks, independent exact-head review, verified delivery, evidence labels, records and hygiene. In Claude Code, a SessionStart hook loads them into every session, including after `/clear` and compaction. Other agents get the condensed rules from the repository's AGENTS.md block.
- **Skills** load when a task reaches their stage:

  | Skill | Use |
  | --- | --- |
  | `preflight` | Fetch and read from `origin/main`, use a worktree, record capabilities, classify the deployment shape |
  | `independent-review` | Reviewer prompt template, review contract, verdict recording |
  | `ship` | Exact-head merge, release watch by SHA, versioning, tags, release notes |
  | `journal` | Journal entry and index templates, evidence rules, release closure |
  | `incident` | Sources of truth, first pass, follow the failing stage, close the loop |
  | `experiment` | Frozen baseline, one mechanism at a time, honest reporting |
  | `adopt` | Set up a repository: pin the plugin, add the AGENTS.md block, fill in bindings |

To adopt it in a repository, ask an agent to "adopt the skills workflow in this repo". The `adopt` skill:

- pins `skills@skills` in `.claude/settings.json`;
- puts [the workflow block](skills/adopt/agents-block.md) at the top of AGENTS.md. The block links `CORE.md` at the pinned tag, repeats the non-negotiable rules, and holds the repository's **bindings**: check commands, reviewer, merge authority, release verification, record paths and exceptions.

## Pinning a repository to a release

Commit this to the repository's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "skills": { "source": { "source": "github", "repo": "akhilvuputuri/skills", "ref": "skills--v0.2.0" } }
  },
  "enabledPlugins": { "skills@skills": true }
}
```

For Codex, each contributor runs `codex plugin marketplace add akhilvuputuri/skills@skills--v0.2.0` and then `codex plugin add skills@skills` once. The repository's `.codex/config.toml` then keeps the plugin enabled in that trusted project. Enabling it there does not install it.

```toml
[plugins."skills@skills"]
enabled = true
```

The current release is `skills--v0.2.0`. Pin only release tags, never a branch.

### Releasing

Claude Code and Codex install a new copy only when the plugin's `version` changes.

- Every change to what the plugin ships (`skills/`, `CORE.md`, `hooks/`, `.claude-plugin/plugin.json`, `.codex-plugin/`) bumps `version` in `.claude-plugin/marketplace.json`, `.claude-plugin/plugin.json`, `.agents/plugins/marketplace.json` and `.codex-plugin/plugin.json`. It also records the content digest for that version in `.claude-plugin/releases.json`.
- The reviewed merge commit is tagged `skills--v<version>`, following Claude Code's convention, as soon as it merges. Released digests are immutable, including those of the former `workflow` and `ios-design` plugins.
- `tests/marketplace.test.cjs` fails if the plugin changes without a new version, if the Codex and Claude manifests disagree, or if the README's pinned tag doesn't match the version.

**Node 22+ is the only runtime requirement.** Release artifacts bundle a small Node-API filesystem addon to retain directory-relative reads, atomic writes, and store locking on macOS/Linux. No Python, compiler, dependency installation, daemon, MCP server, or model service is needed to use an installed skill. Windows is unsupported in this version. Git is optional for local code metadata; no Git is required to install or use discussion-only handoffs.

Use the matching platform/architecture artifact. macOS binaries target macOS 11+; Linux builds use glibc 2.35+ (Ubuntu 22.04 baseline). Alpine/musl builds are not supplied. CI verifies current macOS/Linux runners; minimum-OS loader execution is not independently verified.

## Install without cloning

This is the Handoff installer. Download the installer matching your laptop from the release: `handoff-install-darwin-arm64.cjs` for an Apple Silicon Mac, or `handoff-install-darwin-x64.cjs` for an Intel Mac. Linux artifacts use the corresponding architecture name. Check `node -p 'process.platform + "-" + process.arch'` if unsure. Release publication is pending review; prepared artifacts are not yet a public release.

```sh
node handoff-install-darwin-arm64.cjs --agent codex
# Or:
node handoff-install-darwin-arm64.cjs --agent claude-code
```

The single downloaded file includes both skills, the helper, schema, reference, and matching compiled addon. It installs independent copies into `~/.agents/skills` for Codex or `~/.claude/skills` for Claude Code. A custom destination is supported with `--target /path/to/agent/skills`. Install just one with `--skill publish-handoff` or `--skill resume-handoff`. Restart/start a fresh agent session if discovery does not refresh. Host invocation/discovery and filesystem permissions still need to be verified in your chosen agent.

The downloaded installer runs offline. Transfer it and its release checksum file to a work laptop through your approved mechanism; no source checkout or Git history travels with it. Updates are explicit: download a chosen new version and rerun with `--replace`. Recognized Python-era installations can be upgraded to Node without modifying stored handoffs. Unknown layouts/versions and unexpected file types are rejected to preserve local files. The installer never reads runtime records.

## Optional npx installation of Handoff

`npx skills add akhilvuputuri/skills` hides the Handoff skills (`metadata.internal`), because a repository copy has no compiled addon. Forced with `INSTALL_INTERNAL_SKILLS=1`, the copied helper reports that the filesystem addon is unavailable. The self-contained release ZIP below does include the addon, but its skills carry the same flag, so `npx skills` needs `INSTALL_INTERNAL_SKILLS=1` for that route too.

Self-contained, platform-specific Handoff skill ZIPs are also built. Vercel's `skills` CLI supports direct archive URLs, agent selection, and copy mode. Once published and validated, a ZIP can be installed using:

```sh
INSTALL_INTERNAL_SKILLS=1 npx skills add RELEASE_ZIP_URL --global --agent codex --copy
```

This route is an external installer, not a second implementation of Handoff. It may download npm packages/use its own telemetry or update behavior during setup; use the downloaded Node installer for an offline installation. The direct ZIP path avoids relying on a Git repository clone. **End-to-end npx archive installation is not yet verified.** Do not install the same skill through both routes in the same scope. [Skills CLI documentation](https://github.com/vercel-labs/skills#installation-methods).

An isolated trial with the npm-published `skills` 1.5.18 treated a direct localhost ZIP URL as a well-known discovery endpoint and found no skills. Repository main documents archive support, but that trial did not establish it for the published version. The direct Node installer is the verified install path; do not assume a future archive command works until tested against the chosen installer release.

## Use

After installation, talk to your coding agent:

- “Write a handoff so I can continue in Codex tomorrow.”
- “Publish a handoff focused on the login bug.”
- “Draft a handoff for the duplicate reply investigation.”
- “Update handoff H with today's findings.”
- “List handoffs for this project.”
- “Resume handoff H.”
- “Resume H and implement the fix.”

The agent handles JSON and helper commands. Publishing returns a handoff ID, revision ID, and local path. Another local agent with access to the same store can resume by ID; code and patches are not transferred. “Publish” means save locally; issue URLs are inert metadata. Competing successors remain visible instead of choosing by timestamp.

## Data and offline boundary

Default store: `~/.local/share/handoff`, outside source/application checkouts. Override with `HANDOFF_DATA_DIR` or `--data-dir`. Stores from before the rename keep working: `ASTACK_DATA_DIR` is still read when `HANDOFF_DATA_DIR` is unset, and an existing `~/.local/share/a-stack` is used while `~/.local/share/handoff` does not exist. To migrate, move the directory to the new path. Choose a genuinely local private directory rather than a cloud-synced folder. Store directories/files have user-only permissions. Worktrees share identity; separate clones remain isolated unless explicitly linked. Existing schema-v1 records and project IDs remain compatible with the former Python helper; new revisions use schema v2. The legacy `.relay.lock` filename is retained solely for store compatibility; the tool is called Handoff.

The helper makes no network calls. Local Git metadata reads deny transport protocols and lazy fetching. A cloud-backed agent can still send read context to its configured model provider; fully offline model processing requires a local agent/model. Containers require a store mount, and hosted agents without local filesystem access cannot use this store.

## Develop

Development requires Node 22+, a C compiler, and locally available Node headers. Compiled Node-API artifacts work across supported Node versions on the same platform/architecture. Building never downloads headers or dependencies. If the header location is unusual, set `HANDOFF_NODE_HEADERS` to the directory containing `node_api.h`.

```sh
npm run build:native
npm test
node tools/build-release.cjs --output-dir /path/to/artifacts
node tools/install.cjs --target /path/to/test-agent/skills
```

There are no npm dependencies or install scripts. The release builder emits a standalone installer, a self-contained skill ZIP, and SHA256 checksums for the build platform. Checksums detect mismatch/corruption; hashes from the same release host are not an independent publisher signature.

[Record schema](schema/handoff.schema.json), [command/storage reference](docs/handoff.md), [validation evidence](docs/validation.md), [installation research](docs/installation-research.md), and [development/review workflow](docs/development.md). `ios-design` evaluation cases and an SDK API probe live in [evals/ios-design](evals/ios-design).

Devin and independent review concern development of this repo; they are not dependencies for using the installed skills. Runtime handoffs, real work context, credentials, and scratch review data must never enter source, releases, tests, or diagnostics.
