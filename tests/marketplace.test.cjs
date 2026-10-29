"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const ROOT = path.resolve(__dirname, "..");
// The repository root is a single plugin, like addyosmani/agent-skills and obra/superpowers.
// Its instruction-only skills live at skills/<skill>/SKILL.md, the layout Claude Code, Codex
// and `npx skills` all discover. Handoff needs the bundled native addon, which only the
// release installer provides, so it is built on first use in a plugin install and hidden from `npx skills`.
const PLUGIN = "skills";
const WORKFLOW_SKILLS = ["adopt", "experiment", "incident", "independent-review", "journal", "preflight", "ship"];
const HANDOFF_SKILLS = ["publish-handoff", "resume-handoff"];
const SKILLS = [...WORKFLOW_SKILLS, "ios-design", ...HANDOFF_SKILLS];
// What the plugin ships to agents. Claude Code copies the whole root, but only these paths
// change what a session loads, so they define the plugin's content for versioning.
const CONTENT = [".claude-plugin/plugin.json", ".codex-plugin", "CORE.md", "hooks", "skills"];
// Claude Code and Codex load components from fixed paths in a plugin root (commands/, agents/,
// workflows/, themes/, .mcp.json, .app.json, a root SKILL.md and more, growing over time).
// So the root is an allow-list: a new top-level entry needs a deliberate decision about
// whether agents load it, and if they do, it belongs in CONTENT and the version.
const ROOT_ENTRIES = [
  ...CONTENT.map((item) => item.split("/")[0]),
  ".agents", ".github", ".gitignore", "AGENTS.md", "README.md", "REVIEW.md", "VERSION",
  "docs", "evals", "native", "package.json", "schema", "tests", "tools",
];
// Local state that never reaches GitHub: git, Finder, build output, and the per-checkout
// .claude/ and .codex/ folders that agents create. Neither agent loads those from a plugin root.
const LOCAL_ENTRIES = [".git", ".DS_Store", "node_modules", "dist", ".claude", ".codex"];
const listing = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((name) => name !== ".DS_Store").sort();
const marketplace = readJson(".claude-plugin/marketplace.json");
const codexMarketplace = readJson(".agents/plugins/marketplace.json");
const plugin = marketplace.plugins[0];

function readJson(relative) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relative), "utf8"));
}
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue; // Finder metadata; git-ignored and never shipped.
    const full = path.join(dir, entry.name);
    out.push(full);
    if (entry.isDirectory()) walk(full, out);
  }
  return out;
}
// Git stores a symlink as its target text, so the digest does too.
function contentBytes(relative) {
  const full = path.join(ROOT, relative);
  return fs.lstatSync(full).isSymbolicLink() ? Buffer.from(fs.readlinkSync(full)) : fs.readFileSync(full);
}
function contentFiles(root) {
  const files = [];
  for (const item of CONTENT) {
    const full = path.join(root, item);
    if (fs.lstatSync(full).isDirectory()) files.push(...walk(full).filter((f) => !fs.lstatSync(f).isDirectory()));
    else files.push(full);
  }
  return files.map((f) => path.relative(root, f).split(path.sep).join("/")).sort();
}

test("the marketplace lists the root as its one plugin", () => {
  assert.equal(marketplace.name, "skills");
  assert.ok(marketplace.owner && marketplace.owner.name);
  assert.equal(marketplace.plugins.length, 1);
  assert.equal(plugin.name, PLUGIN);
  assert.equal(plugin.source, "./");
  assert.equal(plugin.skills, undefined, "the plugin uses the default skills/ scan");
  assert.match(plugin.version, /^\d+\.\d+\.\d+$/);
  assert.ok(plugin.description);
  const manifest = readJson(".claude-plugin/plugin.json");
  assert.equal(manifest.name, plugin.name);
  assert.equal(manifest.version, plugin.version);
  assert.equal(manifest.description, plugin.description);
  for (const key of ["skills", "hooks", "commands", "agents", "mcpServers"])
    assert.equal(manifest[key], undefined, "plugin.json must not add " + key);
});

// Skill frontmatter can declare hooks, tools and other behavior that runs when the skill
// is invoked. Marketplace skills are instructions only, so allow exactly name and description.
function frontmatter(text, name) {
  const match = /^---\n([\s\S]*?)\n---\n/.exec(text);
  assert.ok(match, name + ": SKILL.md needs frontmatter");
  return match[1];
}
function assertPlainFrontmatter(text, name) {
  const keys = frontmatter(text, name).split("\n").map((line) => line.split(":")[0]);
  assert.deepEqual(keys, ["name", "description"], name + ": frontmatter may hold only name and description");
}

// Handoff's helper and reference are development symlinks into tools/ and docs/. Claude Code
// keeps them as symlinks in the plugin cache, so they resolve inside the plugin root.
const HANDOFF_LINKS = {
  "scripts/handoff.cjs": "../../../tools/handoff.cjs",
  "references/handoff.md": "../../../docs/handoff.md",
};

test("skills/ holds exactly the instruction-only skills and Handoff's linked helper", () => {
  const dir = path.join(ROOT, "skills");
  const names = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
  assert.deepEqual(names.sort(), [...SKILLS].sort());
  const links = [];
  for (const file of walk(dir)) {
    const info = fs.lstatSync(file);
    if (info.isSymbolicLink()) links.push(path.relative(dir, file).split(path.sep).join("/"));
    else assert.ok(info.isDirectory() || file.endsWith(".md"), "unexpected skill file: " + file);
  }
  const expected = HANDOFF_SKILLS.flatMap((name) => Object.keys(HANDOFF_LINKS).map((rel) => name + "/" + rel));
  assert.deepEqual(links.sort(), expected.sort(), "only Handoff's helper and reference may be symlinks");
  for (const name of HANDOFF_SKILLS)
    for (const [rel, target] of Object.entries(HANDOFF_LINKS)) {
      const link = path.join(dir, name, rel);
      assert.equal(fs.readlinkSync(link), target);
      assert.ok(fs.statSync(link).isFile(), "dangling link: " + link);
    }
  for (const name of names) {
    const skill = fs.readFileSync(path.join(dir, name, "SKILL.md"), "utf8");
    assert.match(skill, new RegExp("^---\\nname: " + name + "\\ndescription: \\S"));
    if (!HANDOFF_SKILLS.includes(name)) assertPlainFrontmatter(skill, name);
  }
});

// Claude Code caps SessionStart hook output at 10,000 characters; beyond that the core
// rules would be replaced by a file path and a 2,000-character preview.
const HOOK_OUTPUT_LIMIT = 10000;

test("the plugin's only hook prints CORE.md, and nothing else loads from the root", () => {
  // The local-only folders are exempt only while nothing in them is committed.
  const tracked = git(["ls-files", "--", ...LOCAL_ENTRIES]);
  if (tracked !== null) assert.equal(tracked.toString("utf8"), "", "local-only paths must not be committed");
  const entries = fs.readdirSync(ROOT).filter((name) => !LOCAL_ENTRIES.includes(name));
  assert.deepEqual(entries.sort(), [...new Set(ROOT_ENTRIES)].sort(), "unexpected or missing top-level entry");
  assert.deepEqual(listing(".claude-plugin"), ["marketplace.json", "plugin.json", "releases.json"]);
  assert.deepEqual(listing(".agents"), ["plugins"]);
  assert.deepEqual(listing(".agents/plugins"), ["marketplace.json"]);
  assert.deepEqual(listing("hooks"), ["hooks.json"]);
  assert.deepEqual(readJson("hooks/hooks.json"), {
    hooks: {
      SessionStart: [
        { hooks: [{ type: "command", command: "cat", args: ["${CLAUDE_PLUGIN_ROOT}/CORE.md"] }] },
      ],
    },
  });
  const core = fs.readFileSync(path.join(ROOT, "CORE.md"), "utf8");
  assert.ok(core.length < HOOK_OUTPUT_LIMIT, "CORE.md must stay under the hook output cap");
  for (const name of WORKFLOW_SKILLS) assert.ok(core.includes("`" + name + "`"), "CORE.md must list " + name);
});

test("the Codex marketplace and manifest mirror the Claude marketplace", () => {
  assert.equal(codexMarketplace.name, marketplace.name);
  assert.equal(codexMarketplace.plugins.length, 1);
  const entry = codexMarketplace.plugins[0];
  assert.equal(entry.name, plugin.name);
  assert.deepEqual(entry.source, { source: "local", path: plugin.source });
  assert.equal(entry.version, plugin.version);
  assert.equal(entry.description, plugin.description);
  assert.ok(entry.policy && entry.policy.installation && entry.policy.authentication && entry.category);
  const manifest = readJson(".codex-plugin/plugin.json");
  assert.equal(manifest.name, plugin.name);
  assert.equal(manifest.version, plugin.version);
  assert.equal(manifest.description, plugin.description);
  assert.equal(manifest.skills, "./skills/");
  // Codex discovers hooks/hooks.json unless the manifest names hooks explicitly, and it
  // drops the Claude hook's args. Point Codex at an explicit empty hooks file instead.
  assert.equal(manifest.hooks, "./.codex-plugin/hooks.json");
  assert.deepEqual(readJson(".codex-plugin/hooks.json"), { hooks: {} });
  assert.deepEqual(listing(".codex-plugin"), ["hooks.json", "plugin.json"]);
});

test("Handoff ships in skills/ for the plugin, hidden from `npx skills` discovery", () => {
  assert.ok(!fs.existsSync(path.join(ROOT, "handoff")), "Handoff lives in skills/, not a separate folder");
  for (const name of HANDOFF_SKILLS) {
    const skill = fs.readFileSync(path.join(ROOT, "skills", name, "SKILL.md"), "utf8");
    assert.match(frontmatter(skill, name), /\nmetadata:\n  internal: true$/);
  }
});

test("README pins the tag that matches the plugin version", () => {
  const readme = fs.readFileSync(path.join(ROOT, "README.md"), "utf8");
  const tag = plugin.name + "--v" + plugin.version;
  const pinned = [...readme.matchAll(/(?<![\w-])skills--v[0-9]+\.[0-9]+\.[0-9]+/g)].map((m) => m[0]);
  assert.ok(pinned.length > 0, "README must pin " + tag);
  assert.deepEqual([...new Set(pinned)], [tag]);
});

// Each released version records a digest of the plugin's content, so changing it without
// bumping the version (which Claude Code and Codex need to ship an update) fails.
function digest(entries) {
  const hash = crypto.createHash("sha256");
  for (const [name, bytes] of entries) {
    hash.update(name + "\0");
    hash.update(bytes);
    hash.update("\0");
  }
  return hash.digest("hex");
}

test("the plugin's content matches the digest recorded for its version", () => {
  const releases = readJson(".claude-plugin/releases.json");
  const actual = digest(contentFiles(ROOT).map((f) => [f, contentBytes(f)]));
  assert.equal(
    (releases[plugin.name] || {})[plugin.version],
    actual,
    plugin.name + " changed: bump its version and record " + actual + " for it",
  );
});

// Released versions are immutable: once <name>--v<version> is tagged, its recorded digest
// must match the tagged files. Untagged (unreleased) versions may still change.
// Reads raw blobs with cat-file, so no repository-configured filters or hooks run.
function git(args) {
  const result = spawnSync("git", ["-c", "core.fsmonitor=false", ...args], {
    cwd: ROOT,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
  });
  return result.status === 0 ? result.stdout : null;
}
function taggedFiles(tag, prefixes) {
  const listing = git(["ls-tree", "-r", "-z", tag, "--", ...prefixes]);
  if (listing === null) return null;
  const files = listing
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((line) => {
      const [meta, file] = line.split("\t");
      return { type: meta.split(" ")[1], file };
    });
  assert.ok(files.every((entry) => entry.type === "blob"), tag + " contains non-file entries");
  return files.map((entry) => entry.file).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
function taggedDigest(tag, source) {
  // A root plugin is versioned by its CONTENT paths, a folder plugin by its whole folder.
  // Earlier releases were folder plugins, so each tag is read with its own source.
  const prefix = source.replace(/^\.\/?/, "");
  const files = taggedFiles(tag, prefix === "" ? CONTENT : [prefix]);
  if (files === null) return null;
  return digest(files.map((file) => [path.posix.relative(prefix || ".", file), git(["cat-file", "blob", tag + ":" + file])]));
}

test("released versions keep the digest of their tagged content", (t) => {
  if (git(["rev-parse", "--is-inside-work-tree"]) === null) return t.skip("not a git checkout");
  const releases = readJson(".claude-plugin/releases.json");
  // Every release tag keeps its record, so a released digest can't be dropped silently.
  for (const tag of git(["tag", "-l", "*--v*"]).toString("utf8").split("\n").filter(Boolean)) {
    const [, name, version] = /^(.+)--v(\d+\.\d+\.\d+)$/.exec(tag) || [];
    assert.ok(name && (releases[name] || {})[version], tag + " is released but has no record in releases.json");
  }
  // Check every recorded release, including the former workflow and ios-design plugins.
  for (const [name, versions] of Object.entries(releases)) {
    for (const [version, recorded] of Object.entries(versions)) {
      const tag = name + "--v" + version;
      if (git(["rev-parse", "-q", "--verify", "refs/tags/" + tag]) === null) continue;
      const tagged = JSON.parse(git(["cat-file", "blob", tag + ":.claude-plugin/marketplace.json"]).toString("utf8"));
      const entry = tagged.plugins.find((p) => p.name === name);
      assert.ok(entry, tag + " exists but its marketplace does not list " + name);
      assert.equal(recorded, taggedDigest(tag, entry.source), tag + " is released; bump the version instead");
    }
  }
});
