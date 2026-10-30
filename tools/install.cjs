#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { VERSION, native, canonical, within, dataDir } = require("./handoff.cjs");
const ROOT = path.resolve(__dirname, "..");
const SKILLS = ["publish-handoff", "resume-handoff"];
// Installations made before the repository was renamed carry .a-stack-version.
const MARKER = ".handoff-version",
  LEGACY_MARKER = ".a-stack-version";
function sourceFile(relative) {
  if (
    path.isAbsolute(relative) ||
    relative.split("/").some((x) => x === ".." || x === ".")
  )
    throw new Error("Invalid source path");
  let current = ROOT;
  for (const part of relative.split("/")) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink())
      throw new Error("Source paths cannot be symlinks: " + relative);
  }
  if (!fs.statSync(current).isFile())
    throw new Error("Expected regular source file: " + relative);
  return current;
}
function recognized(destination) {
  const old = fs.existsSync(path.join(destination, "scripts/relay.py"));
  const marker = fs.existsSync(path.join(destination, MARKER))
    ? MARKER
    : LEGACY_MARKER;
  const expected = new Map([
    [destination, ["SKILL.md", "scripts", "references", marker]],
    [
      path.join(destination, "scripts"),
      old
        ? ["relay.py", "handoff.schema.json"]
        : ["handoff.cjs", "posix.node", "handoff.schema.json"],
    ],
    [path.join(destination, "references"), ["handoff.md"]],
  ]);
  for (const [dir, names] of expected) {
    const info = fs.lstatSync(dir);
    if (
      info.isSymbolicLink() ||
      !info.isDirectory() ||
      fs.readdirSync(dir).sort().join() !== names.sort().join()
    )
      throw new Error(
        "Unexpected installation entries; preserve and inspect before updating",
      );
    for (const name of names) {
      const item = fs.lstatSync(path.join(dir, name));
      if (
        item.isSymbolicLink() ||
        (!["scripts", "references"].includes(name) && !item.isFile())
      )
        throw new Error("Expected code files must be regular files");
    }
  }
  const version = fs
    .readFileSync(path.join(destination, marker), "utf8")
    .trim();
  // 0.1.0 and 0.1.1 shipped the Python runtime; later versions ship the Node runtime.
  const python = ["0.1.0", "0.1.1"],
    node = ["0.1.2", VERSION];
  if (![...python, ...node].includes(version))
    throw new Error("Unknown installation version");
  if (old !== python.includes(version))
    throw new Error("Version and runtime layout disagree");
}
function install(target, names = SKILLS, replace = false) {
  native(); // Verify the bundled platform binary before any destination mutation.
  target = path.resolve(target.replace(/^~(?=\/|$)/, os.homedir()));
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink())
    throw new Error("Installation target cannot be a symlink");
  target = canonical(target);
  const data = canonical(
    dataDir().replace(/^~(?=\/|$)/, os.homedir()),
  );
  if (within(target, data) || within(data, target))
    throw new Error("Installation and runtime data must be separate");
  if (within(target, ROOT))
    throw new Error("Use a separate installation destination outside source");
  names = [...new Set(names)];
  if (names.some((name) => !SKILLS.includes(name)))
    throw new Error("Unknown skill");
  // Preflight all selected destinations before copying either skill.
  for (const name of names) {
    const dest = path.join(target, name);
    try {
      const info = fs.lstatSync(dest);
      if (info.isSymbolicLink() || !replace)
        throw new Error(
          "Skill exists; use --replace only for recognized installations",
        );
      recognized(dest);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const backup = path.join(target, "." + name + ".previous");
    try {
      fs.lstatSync(backup);
      throw new Error(
        "Previous installation backup exists; inspect before retrying",
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  fs.mkdirSync(target, { recursive: true });
  const installed = [];
  for (const name of names) {
    const dest = path.join(target, name),
      backup = path.join(target, "." + name + ".previous"),
      stage = fs.mkdtempSync(path.join(target, "." + name + "-"));
    let moved = false;
    try {
      fs.mkdirSync(path.join(stage, "scripts"));
      fs.mkdirSync(path.join(stage, "references"));
      for (const [source, relative] of [
        ["handoff/" + name + "/SKILL.md", "SKILL.md"],
        ["tools/handoff.cjs", "scripts/handoff.cjs"],
        [
          `native/${process.platform}-${process.arch}/posix.node`,
          "scripts/posix.node",
        ],
        ["schema/handoff.schema.json", "scripts/handoff.schema.json"],
        ["docs/handoff.md", "references/handoff.md"],
      ])
        fs.copyFileSync(sourceFile(source), path.join(stage, relative));
      fs.writeFileSync(path.join(stage, MARKER), VERSION + "\n");
      if (fs.existsSync(dest)) {
        recognized(dest);
        fs.renameSync(dest, backup);
        moved = true;
      }
      fs.renameSync(stage, dest);
      if (moved) fs.rmSync(backup, { recursive: true });
      installed.push(dest);
    } catch (error) {
      if (moved && !fs.existsSync(dest) && fs.existsSync(backup))
        fs.renameSync(backup, dest);
      throw error;
    } finally {
      if (fs.existsSync(stage)) fs.rmSync(stage, { recursive: true });
    }
  }
  return installed;
}
function main(argv = process.argv.slice(2)) {
  try {
    let target, agent;
    const names = [];
    let replace = false;
    for (let i = 0; i < argv.length; i++) {
      switch (argv[i]) {
        case "--help":
        case "-h":
          console.log(
            "Handoff install — Node 22+, macOS/Linux\n--agent codex|claude-code OR --target DIRECTORY\n--skill publish-handoff|resume-handoff (repeat)\n--replace for a code-only update; never reads runtime handoffs",
          );
          return 0;
        case "--version":
          console.log(VERSION);
          return 0;
        case "--replace":
          replace = true;
          break;
        case "--agent":
          agent = argv[++i];
          break;
        case "--target":
          target = argv[++i];
          break;
        case "--skill":
          names.push(argv[++i]);
          break;
        default:
          throw new Error("Unknown option: " + argv[i]);
      }
    }
    if (Boolean(target) === Boolean(agent))
      throw new Error("Choose exactly one of --agent or --target");
    if (agent && !["codex", "claude-code"].includes(agent))
      throw new Error("Unknown agent");
    target ||= path.join(
      os.homedir(),
      agent === "codex" ? ".agents/skills" : ".claude/skills",
    );
    console.log(
      JSON.stringify(
        {
          version: VERSION,
          installed: install(target, names.length ? names : SKILLS, replace),
        },
        null,
        2,
      ),
    );
    return 0;
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }));
    return 2;
  }
}
if (require.main === module) process.exitCode = main();
module.exports = {
  VERSION,
  ROOT,
  SKILLS,
  MARKER,
  sourceFile,
  recognized,
  install,
  main,
};
