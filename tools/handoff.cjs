#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const VERSION = "0.1.2";
const MAX_BYTES = 2 * 1024 * 1024;
const C = fs.constants;
const fail = (message) => {
  throw new Error(message);
};
const identifier = (value) =>
  typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,79}$/.test(value)
    ? value
    : fail(
        "Invalid ID: lowercase letters, digits and hyphens (1–80 characters)",
      );
const expand = (value) =>
  path.resolve(
    value === "~"
      ? os.homedir()
      : value.startsWith("~/")
        ? path.join(os.homedir(), value.slice(2))
        : value,
  );
// The store moved from ~/.local/share/a-stack when the repository was renamed. Keep using
// an existing legacy store, and the legacy environment variable, until the owner moves it.
const dataDir = () => {
  const configured =
    process.env.HANDOFF_DATA_DIR || process.env.ASTACK_DATA_DIR;
  if (configured) return configured;
  const present = (value) => {
    try {
      fs.lstatSync(expand(value));
      return true;
    } catch (error) {
      if (error.code === "ENOENT") return false;
      throw error;
    }
  };
  return !present("~/.local/share/handoff") && present("~/.local/share/a-stack")
    ? "~/.local/share/a-stack"
    : "~/.local/share/handoff";
};
const within = (child, parent) => {
  const rel = path.relative(parent, child);
  return (
    rel === "" ||
    (!rel.startsWith(".." + path.sep) && rel !== ".." && !path.isAbsolute(rel))
  );
};
const canonical = (value) => {
  const full = expand(value);
  try {
    return fs.realpathSync(full);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return path.join(canonical(path.dirname(full)), path.basename(full));
  }
};
const own = (object, key) => Object.hasOwn(object, key);
function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sorted(value[key])]),
    );
  return value;
}
const encoded = (value) =>
  Buffer.from(JSON.stringify(sorted(value), null, 2) + "\n");
const equal = (a, b) => encoded(a).equals(encoded(b));
// JSON.parse alone silently accepts duplicate keys. Preserve the previous record contract.
function decode(bytes) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  let i = 0;
  const space = () => {
    while (/\s/.test(text[i] || "") && i < text.length) {
      if (!" \t\r\n".includes(text[i])) fail("Invalid JSON whitespace");
      i++;
    }
  };
  function string() {
    const start = i++;
    while (i < text.length) {
      if (text[i] === "\\") {
        i += 2;
        continue;
      }
      if (text[i++] === '"') return JSON.parse(text.slice(start, i));
    }
    fail("Unterminated JSON string");
  }
  function value(depth) {
    if (depth > 100) fail("JSON nesting exceeds limit");
    space();
    if (text[i] === '"') return string();
    if (text[i] === "{") {
      i++;
      space();
      const object = Object.create(null);
      if (text[i] === "}") {
        i++;
        return object;
      }
      for (;;) {
        space();
        if (text[i] !== '"') fail("Expected JSON property");
        const key = string();
        space();
        if (text[i++] !== ":") fail("Expected JSON colon");
        if (own(object, key)) fail("Duplicate JSON key: " + key);
        object[key] = value(depth + 1);
        space();
        const end = text[i++];
        if (end === "}") return object;
        if (end !== ",") fail("Expected JSON comma");
      }
    }
    if (text[i] === "[") {
      i++;
      space();
      const array = [];
      if (text[i] === "]") {
        i++;
        return array;
      }
      for (;;) {
        array.push(value(depth + 1));
        space();
        const end = text[i++];
        if (end === "]") return array;
        if (end !== ",") fail("Expected JSON comma");
      }
    }
    const match =
      /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(
        text.slice(i),
      );
    if (!match) fail("Invalid JSON value");
    i += match[0].length;
    const result = JSON.parse(match[0]);
    if (typeof result === "number" && !Number.isFinite(result))
      fail("Non-finite JSON number");
    return result;
  }
  const result = value(0);
  space();
  if (i !== text.length) fail("Trailing JSON content");
  return result;
}
function readBounded(fd) {
  const chunks = [];
  let total = 0;
  for (;;) {
    const buffer = Buffer.alloc(Math.min(65536, MAX_BYTES + 1 - total));
    const count = fs.readSync(fd, buffer);
    if (!count) break;
    chunks.push(buffer.subarray(0, count));
    total += count;
    if (total > MAX_BYTES) fail("Record exceeds the 2 MiB limit");
  }
  return decode(Buffer.concat(chunks));
}
function inputJson(filename) {
  if (filename === "-") return readBounded(0);
  const fd = fs.openSync(filename, "r");
  try {
    return readBounded(fd);
  } finally {
    fs.closeSync(fd);
  }
}
function resource(name) {
  const adjacent = path.join(__dirname, name);
  return fs.existsSync(adjacent)
    ? adjacent
    : path.join(__dirname, "../schema", name);
}
function validate(record) {
  const schema = decode(fs.readFileSync(resource("handoff.schema.json")));
  const kind = (value) =>
    value === null
      ? "null"
      : Array.isArray(value)
        ? "array"
        : typeof value === "object"
          ? "object"
          : typeof value === "number" && Number.isInteger(value)
            ? "integer"
            : typeof value;
  function visit(value, rule, location) {
    if (rule.$ref) rule = schema.$defs[rule.$ref.split("/").at(-1)];
    if (own(rule, "const") && value !== rule.const)
      fail(location + ": unsupported value/schema version");
    if (rule.enum && !rule.enum.includes(value))
      fail(location + ": invalid enum value");
    if (
      rule.type &&
      !(Array.isArray(rule.type) ? rule.type : [rule.type]).includes(
        kind(value),
      )
    )
      fail(location + ": invalid type");
    if (kind(value) === "object") {
      for (const key of rule.required || [])
        if (!own(value, key)) fail(location + ": missing " + key);
      for (const key of Object.keys(value)) {
        if (
          rule.additionalProperties === false &&
          !own(rule.properties || {}, key)
        )
          fail(location + ": unknown " + key);
        if (own(rule.properties || {}, key))
          visit(value[key], rule.properties[key], location + "." + key);
      }
    }
    if (Array.isArray(value)) {
      if (
        rule.uniqueItems &&
        new Set(value.map((x) => encoded(x).toString())).size !== value.length
      )
        fail(location + ": duplicate items");
      value.forEach((item, index) =>
        visit(item, rule.items || {}, `${location}[${index}]`),
      );
    }
    if (typeof value === "string") {
      if (value.trim().length < (rule.minLength || 0))
        fail(location + ": empty string");
      if (rule.pattern && !new RegExp(rule.pattern).test(value))
        fail(location + ": invalid ID");
      if (rule.format === "date-time") {
        if (
          !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|\+00:00)$/.test(
            value,
          ) ||
          !Number.isFinite(Date.parse(value))
        )
          fail(location + ": expected UTC ISO timestamp");
        const day = value.slice(0, 10);
        if (new Date(value).toISOString().slice(0, 10) !== day)
          fail(location + ": invalid date");
      }
    }
  }
  visit(record, schema, "record");
  if (record.predecessor_revision_ids.includes(record.revision_id))
    fail("A revision cannot be its own predecessor");
  for (const item of record.findings)
    if (!item.evidence.length && !item.evidence_limitations.length)
      fail("Every finding needs evidence or an explicit evidence limitation");
  for (const item of record.decisions)
    if (item.status === "rejected" && !item.reason)
      fail("Rejected approaches need a reason");
  if (encoded(record).length > MAX_BYTES)
    fail("Record exceeds the 2 MiB limit");
  return record;
}
// A plugin install from the repository has no compiled addon. Build it once from the bundled
// source with the local C compiler and Node headers; nothing is downloaded. Compiler output
// goes to stderr so command output stays machine-readable.
function buildIfMissing(filename) {
  if (fs.existsSync(filename) || !fs.existsSync(path.join(__dirname, "build-native.cjs")))
    return filename;
  const built = require("./build-native.cjs").build({ stdio: ["ignore", 2, 2] });
  return built;
}
function native() {
  if (
    !["darwin", "linux"].includes(process.platform) ||
    Number(process.versions.node.split(".")[0]) < 22
  )
    fail("Handoff requires Node 22+ on macOS/Linux");
  const nearby = path.join(__dirname, "posix.node");
  const filename = fs.existsSync(nearby)
    ? nearby
    : path.join(
        __dirname,
        "../native",
        `${process.platform}-${process.arch}`,
        "posix.node",
      );
  try {
    return require(buildIfMissing(filename));
  } catch (error) {
    fail(
      "Filesystem addon unavailable for this platform. Install the matching release, or run npm run build:native in a development checkout. " +
        error.message,
    );
  }
}
function git(root, ...args) {
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")),
  );
  Object.assign(env, {
    GIT_CONFIG_NOSYSTEM: "1",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_TERMINAL_PROMPT: "0",
    GIT_OPTIONAL_LOCKS: "0",
    GIT_NO_LAZY_FETCH: "1",
    GIT_ALLOW_PROTOCOL: "",
  });
  const result = spawnSync(
    "git",
    [
      "--no-optional-locks",
      "-c",
      "core.fsmonitor=false",
      "-c",
      "core.untrackedCache=false",
      "-C",
      root,
      ...args,
    ],
    { env, timeout: 15000, maxBuffer: 8 * 1024 * 1024 },
  );
  return result.status === 0 && !result.error
    ? result.stdout.toString("utf8").replace(/\n+$/, "")
    : null;
}
function projectIdentity(filename) {
  let root = fs.realpathSync(expand(filename));
  if (!fs.statSync(root).isDirectory()) fail("Project must be a directory");
  const top = git(root, "rev-parse", "--show-toplevel");
  let common = null;
  if (top) {
    root = fs.realpathSync(top);
    const found = git(
      root,
      "rev-parse",
      "--path-format=absolute",
      "--git-common-dir",
    );
    if (!found) fail("Cannot resolve Git common directory");
    common = fs.realpathSync(found);
  }
  return {
    id:
      "p-" +
      crypto
        .createHash("sha256")
        .update(common || root)
        .digest("hex")
        .slice(0, 32),
    root,
    git_common_dir: common,
    label: path.basename(root),
  };
}
function syncDirectory(filename) {
  const fd = fs.openSync(filename, C.O_RDONLY | C.O_DIRECTORY | C.O_NOFOLLOW);
  try {
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}
function privateEntry(fd) {
  const info = fs.fstatSync(fd);
  if (info.uid !== process.getuid() || info.mode & 0o077)
    fail(
      "Store entries must be owned by you with user-only permissions (0700/0600)",
    );
}
class Store {
  constructor(dataRoot, project) {
    const configured = expand(dataRoot);
    if (fs.existsSync(configured) && fs.lstatSync(configured).isSymbolicLink())
      fail("Data root cannot be a symlink");
    this.root = canonical(configured);
    this.project = project;
    this.n = native();
    const code = path.dirname(path.dirname(fs.realpathSync(__filename)));
    for (const source of [project.root, code])
      if (within(this.root, source) || within(source, this.root))
        fail(
          "Data root must be separate from project and source/skill directories",
        );
  }
  directory(parts = [], create = false) {
    if (create && !fs.existsSync(this.root)) {
      const missing = [];
      let next = this.root;
      while (!fs.existsSync(next)) {
        missing.push(next);
        next = path.dirname(next);
      }
      for (const item of missing.reverse()) {
        try {
          fs.mkdirSync(item, { mode: 0o700 });
        } catch (error) {
          if (error.code !== "EEXIST") throw error;
        }
        syncDirectory(path.dirname(item));
      }
    }
    let fd;
    try {
      fd = this.n.openDir(this.root);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    try {
      privateEntry(fd);
      for (const name of parts) {
        identifier(name);
        if (create && this.n.mkdirAt(fd, name)) fs.fsyncSync(fd);
        let child;
        try {
          child = this.n.openAt(fd, name, C.O_RDONLY | C.O_DIRECTORY, 0);
        } catch (error) {
          if (error.code === "ENOENT") {
            fs.closeSync(fd);
            return null;
          }
          throw error;
        }
        fs.closeSync(fd);
        fd = child;
        privateEntry(fd);
      }
      return fd;
    } catch (error) {
      fs.closeSync(fd);
      throw error;
    }
  }
  locked(create, operation) {
    const dir = this.directory([], create);
    if (dir === null) return operation();
    let fd;
    try {
      fd = this.n.openAt(
        dir,
        ".relay.lock",
        C.O_RDWR | C.O_CREAT | C.O_NONBLOCK,
        0o600,
      );
      privateEntry(fd);
      if (!fs.fstatSync(fd).isFile()) fail("Store lock must be a regular file");
      this.n.lock(fd);
      return operation();
    } finally {
      if (fd !== undefined) fs.closeSync(fd);
      fs.closeSync(dir);
    }
  }
  readAt(fd, name) {
    let file;
    try {
      file = this.n.openAt(fd, name, C.O_RDONLY | C.O_NONBLOCK, 0);
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
    try {
      privateEntry(file);
      if (!fs.fstatSync(file).isFile())
        fail("Store records must be regular files");
      return readBounded(file);
    } finally {
      fs.closeSync(file);
    }
  }
  read(parts, name) {
    const fd = this.directory(parts);
    if (fd === null) return null;
    try {
      return this.readAt(fd, name);
    } finally {
      fs.closeSync(fd);
    }
  }
  write(parts, name, record) {
    const fd = this.directory(parts, true);
    const temp = ".tmp-" + crypto.randomUUID();
    try {
      const file = this.n.openAt(
        fd,
        temp,
        C.O_WRONLY | C.O_CREAT | C.O_EXCL,
        0o600,
      );
      try {
        fs.writeFileSync(file, encoded(record));
        fs.fsyncSync(file);
      } finally {
        fs.closeSync(file);
      }
      if (
        !this.n.linkAt(fd, temp, name) &&
        !equal(this.readAt(fd, name), record)
      )
        fail("ID already exists with different content; nothing overwritten");
      this.n.unlinkAt(fd, temp);
      fs.fsyncSync(fd);
    } finally {
      try {
        this.n.unlinkAt(fd, temp);
      } finally {
        fs.closeSync(fd);
      }
    }
    return path.join(this.root, ...parts, name);
  }
  entries(parts) {
    const fd = this.directory(parts);
    if (fd === null) return [];
    try {
      return this.n.list(fd).sort();
    } finally {
      fs.closeSync(fd);
    }
  }
  mappedProject() {
    const seen = new Set();
    let current = this.project.id;
    for (;;) {
      if (seen.has(current)) fail("Project mappings contain a cycle");
      seen.add(current);
      const mapping = this.read(["mappings"], current + ".json");
      if (mapping === null) break;
      if (
        typeof mapping !== "object" ||
        mapping === null ||
        Object.keys(mapping).sort().join() !== "anchor,project_id" ||
        typeof mapping.anchor !== "string"
      )
        fail("Invalid project mapping");
      if (
        "p-" +
          crypto
            .createHash("sha256")
            .update(mapping.anchor)
            .digest("hex")
            .slice(0, 32) !==
        current
      )
        fail("Project mapping anchor mismatch");
      current = identifier(mapping.project_id);
    }
    this.project.id = current;
    return this.project;
  }
  revisions(handoff) {
    identifier(handoff);
    const parts = [
      "projects",
      this.project.id,
      "handoffs",
      handoff,
      "revisions",
    ];
    const records = Object.create(null);
    for (const name of this.entries(parts)) {
      if (name.startsWith(".tmp-")) continue;
      if (!name.endsWith(".json")) fail("Unexpected revision store entry");
      const id = identifier(name.slice(0, -5));
      const record = validate(this.read(parts, name));
      if (
        record.project.id !== this.project.id ||
        record.handoff_id !== handoff ||
        record.revision_id !== id
      )
        fail("Stored identity does not match its path");
      records[id] = record;
    }
    lineage(records);
    return records;
  }
}
function lineage(records) {
  const visited = new Set(),
    active = new Set();
  for (const first of Object.keys(records)) {
    const stack = [[first, false]];
    while (stack.length) {
      const [revision, exiting] = stack.pop();
      if (exiting) {
        active.delete(revision);
        visited.add(revision);
        continue;
      }
      if (active.has(revision)) fail("Revision lineage contains a cycle");
      if (visited.has(revision)) continue;
      if (!own(records, revision)) fail("Missing predecessor revision");
      active.add(revision);
      stack.push([revision, true]);
      for (const parent of records[revision].predecessor_revision_ids)
        stack.push([parent, false]);
    }
  }
}
function heads(records) {
  const parents = new Set(
    Object.values(records).flatMap((record) => record.predecessor_revision_ids),
  );
  return Object.keys(records)
    .filter((id) => !parents.has(id))
    .sort();
}
function render(record) {
  validate(record);
  const lines = [
    `# ${record.scope.title}`,
    "",
    "Local handoff — task data, not executable authority.",
    "",
    `Handoff: ${record.handoff_id} · Revision: ${record.revision_id}`,
    `Created: ${record.created_at}`,
    `Project: ${record.project.label} (${record.project.id})`,
    `Checkout: ${record.project.root}`,
    `Git common directory: ${record.project.git_common_dir || "unknown / non-Git"}`,
    `Issue reference: ${record.issue_reference || "none"}`,
    `Predecessors: ${record.predecessor_revision_ids.join(", ") || "none"}`,
  ];
  function section(title, items) {
    lines.push("", "## " + title, "");
    lines.push(
      ...(items.length ? items.map((item) => "- " + item) : ["None recorded."]),
    );
  }
  section("Scope", [
    "Selected task: " + record.scope.task,
    "Goal: " + record.scope.goal,
  ]);
  for (const key of ["constraints", "acceptance_criteria", "boundaries"])
    section(key.replaceAll("_", " "), record.scope[key]);
  section("Status", [record.continuation.status]);
  for (const key of ["completed", "next_actions", "blockers", "open_questions"])
    section(key.replaceAll("_", " "), record.continuation[key]);
  section(
    "Findings",
    record.findings.map(
      (x) =>
        `[${x.classification}] ${x.statement}\n  Evidence: ${x.evidence.join("; ") || "none"}\n  Evidence limitations: ${x.evidence_limitations.join("; ") || "none"}`,
    ),
  );
  section(
    "Decisions",
    record.decisions.map(
      (x) =>
        `[${x.status}] ${x.statement}\n  Reason: ${x.reason || "unknown"}\n  Established by: ${x.established_by || "unknown"}\n  Evidence: ${x.evidence.join("; ") || "none"}`,
    ),
  );
  section("Code state", [
    "Base commit: " + (record.code_state.base_commit || "unknown"),
    "Branch: " + (record.code_state.branch || "unknown"),
  ]);
  for (const key of [
    "relevant_paths",
    "dirty_paths",
    "unpublished_work",
    "pr_links",
    "artifacts",
    "limitations",
  ])
    section(key.replaceAll("_", " "), record.code_state[key]);
  section(
    "Verification",
    record.verification.checks.map(
      (x) =>
        `[${x.result}] \`${x.command}\` — ${x.summary}\n  Commit: ${x.commit || "unknown"}; checked at: ${x.checked_at || "unknown"}`,
    ),
  );
  section("Not yet run", record.verification.not_run);
  section(
    "Dependencies",
    record.dependencies.map(
      (x) =>
        `${x.description} — ${x.rationale}\n  References: ${x.references.join("; ") || "none"}`,
    ),
  );
  section("Provenance", [
    "Agent: " + (record.provenance.agent || "unknown"),
    "Session: " + (record.provenance.session || "unknown"),
    "Available-context completeness: " + record.provenance.context_completeness,
  ]);
  section("Sources", record.provenance.sources);
  section("Uncertainties", record.provenance.uncertainties);
  return lines.join("\n") + "\n";
}
function trackedDigest(root, name, mode, expected) {
  const n = native();
  const parts = name.split("/");
  if (path.isAbsolute(name) || parts.some((x) => !x || x === "." || x === ".."))
    fail("Invalid tracked path");
  let fd = n.openDir(root);
  try {
    for (const part of parts.slice(0, -1)) {
      const child = n.openAt(fd, part, C.O_RDONLY | C.O_DIRECTORY, 0);
      fs.closeSync(fd);
      fd = child;
    }
    const leaf = parts.at(-1);
    const hash = crypto.createHash(expected.length === 64 ? "sha256" : "sha1");
    if (mode === "120000") {
      const bytes = n.readlinkAt(fd, leaf);
      hash.update(`blob ${bytes.length}\0`);
      hash.update(bytes);
      return [hash.digest("hex"), false];
    }
    const file = n.openAt(fd, leaf, C.O_RDONLY | C.O_NONBLOCK, 0);
    try {
      const info = fs.fstatSync(file);
      if (!info.isFile()) return [null, true];
      hash.update(`blob ${info.size}\0`);
      const buffer = Buffer.alloc(65536);
      let count;
      while ((count = fs.readSync(file, buffer)))
        hash.update(buffer.subarray(0, count));
      return [
        hash.digest("hex"),
        Boolean(info.mode & 0o100) !== (mode === "100755"),
      ];
    } finally {
      fs.closeSync(file);
    }
  } finally {
    fs.closeSync(fd);
  }
}
function inspectProject(project, paths) {
  const result = {
    base_commit: null,
    branch: null,
    relevant_paths: paths,
    dirty_paths: [],
    unpublished_work: [],
    pr_links: [],
    artifacts: [],
    limitations: [],
  };
  for (const item of paths)
    if (
      !item ||
      path.isAbsolute(item) ||
      item.split("/").includes("..") ||
      !within(canonical(path.join(project.root, item)), project.root)
    )
      fail("Relevant paths must stay inside the project");
  if (!project.git_common_dir) {
    result.limitations.push("Non-Git project; commit and branch are unknown");
    return result;
  }
  result.base_commit = git(project.root, "rev-parse", "--verify", "HEAD");
  result.branch = git(
    project.root,
    "symbolic-ref",
    "--quiet",
    "--short",
    "HEAD",
  );
  if (!result.base_commit)
    result.limitations.push(
      "HEAD is unavailable (possibly an unborn repository)",
    );
  if (paths.length) {
    const index = git(
      project.root,
      "--literal-pathspecs",
      "ls-files",
      "--stage",
      "-z",
      "--",
      ...paths,
    );
    const other = git(
      project.root,
      "--literal-pathspecs",
      "ls-files",
      "--others",
      "--exclude-standard",
      "-z",
      "--",
      ...paths,
    );
    const staged = result.base_commit
      ? git(
          project.root,
          "--literal-pathspecs",
          "diff-index",
          "--cached",
          "--name-only",
          "--no-ext-diff",
          "--no-textconv",
          "-z",
          result.base_commit,
          "--",
          ...paths,
        )
      : "";
    if (index === null || other === null || staged === null)
      result.limitations.push(
        "Relevant index/working-tree metadata is unavailable",
      );
    else {
      const dirty = new Set((other + staged).split("\0").filter(Boolean));
      for (const entry of index.split("\0").filter(Boolean)) {
        const tab = entry.indexOf("\t"),
          name = entry.slice(tab + 1);
        const [mode, expected, stage] = entry.slice(0, tab).split(" ");
        if (stage !== "0" || !result.base_commit) dirty.add(name);
        if (mode === "160000") continue;
        try {
          const [actual, changed] = trackedDigest(
            project.root,
            name,
            mode,
            expected,
          );
          if (actual !== expected || changed) dirty.add(name);
        } catch (error) {
          dirty.add(name);
          result.limitations.push(
            "A tracked file or parent is missing, unreadable, or a parent symlink; its current contents could not be verified",
          );
        }
      }
      result.dirty_paths = [...dirty].sort();
    }
  } else
    result.limitations.push(
      "No relevant paths supplied; dirty state was not inspected",
    );
  if (result.dirty_paths.length)
    result.unpublished_work.push(
      "Relevant dirty files are recorded by path only; their contents are not transferred",
    );
  result.limitations.push(
    "Local metadata only; remote/pushed state and finding freshness are not established",
    "Raw file comparisons bypass all conversions; submodule working-tree changes are not inspected",
  );
  result.limitations = [...new Set(result.limitations)];
  return result;
}
function getRecord(store, handoff, revision) {
  const records = store.revisions(handoff),
    current = heads(records);
  if (!current.length) fail("Handoff not found in this project");
  if (revision) {
    identifier(revision);
    if (!own(records, revision)) fail("Revision not found");
  } else {
    if (current.length !== 1)
      fail(
        "Competing current revisions: " +
          current.join(", ") +
          "; choose an exact revision or reconcile explicitly",
      );
    revision = current[0];
  }
  const successors = [];
  for (const [id, record] of Object.entries(records)) {
    const stack = [...record.predecessor_revision_ids],
      seen = new Set();
    while (stack.length) {
      const parent = stack.pop();
      if (parent === revision) {
        successors.push(id);
        break;
      }
      if (!seen.has(parent)) {
        seen.add(parent);
        stack.push(...records[parent].predecessor_revision_ids);
      }
    }
  }
  return {
    record: records[revision],
    current_revision_ids: current,
    successor_revision_ids: successors.sort(),
  };
}
function parse(argv) {
  const opts = {
    data_dir: null,
    project: process.cwd(),
    path: [],
    predecessor: [],
    query: "",
    format: "markdown",
  };
  const commands = new Set([
    "project",
    "link-project",
    "template",
    "inspect",
    "validate",
    "draft",
    "publish",
    "render",
    "get",
    "export",
    "list",
  ]);
  const values = new Set([
    "data-dir",
    "project",
    "to",
    "title",
    "input",
    "handoff-id",
    "predecessor",
    "revision",
    "format",
    "path",
    "query",
  ]);
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") return { help: true };
    if (arg === "--version") return { version: true };
    if (arg === "--check-state") {
      opts.check_state = true;
      continue;
    }
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      if (!values.has(key) || i + 1 >= argv.length)
        fail("Unknown option or missing value: " + arg);
      const value = argv[++i];
      if (key === "path" || key === "predecessor") opts[key].push(value);
      else opts[key.replaceAll("-", "_")] = value;
      continue;
    }
    if (!opts.command && commands.has(arg)) opts.command = arg;
    else if (["get", "export"].includes(opts.command) && !opts.handoff_id)
      opts.handoff_id = arg;
    else fail("Unexpected argument: " + arg);
  }
  if (!opts.command) fail("A command is required; use --help");
  if (
    ["validate", "draft", "publish", "render"].includes(opts.command) &&
    !opts.input
  )
    fail("--input is required");
  if (opts.command === "template" && !opts.title) fail("--title is required");
  if (opts.command === "link-project" && !opts.to) fail("--to is required");
  if (["get", "export"].includes(opts.command) && !opts.handoff_id)
    fail("Handoff ID is required");
  if (!["json", "markdown"].includes(opts.format)) fail("Invalid format");
  return opts;
}
function template(title) {
  return {
    issue_reference: null,
    scope: {
      title,
      task: title,
      goal: "Describe the intended outcome",
      constraints: [],
      acceptance_criteria: [],
      boundaries: [],
    },
    continuation: {
      status: "unknown",
      completed: [],
      next_actions: [],
      blockers: [],
      open_questions: [],
    },
    findings: [],
    decisions: [],
    code_state: {
      base_commit: null,
      branch: null,
      relevant_paths: [],
      dirty_paths: [],
      unpublished_work: [],
      pr_links: [],
      artifacts: [],
      limitations: ["Code state has not been inspected"],
    },
    verification: { checks: [], not_run: [] },
    dependencies: [],
    provenance: {
      agent: null,
      session: null,
      sources: [],
      context_completeness: "unknown",
      uncertainties: [],
    },
  };
}
function run(args) {
  if (args.help)
    return (
      "Handoff " +
      VERSION +
      " — Node 22+, macOS/Linux\nCommands: project, link-project, template, inspect, validate, draft, publish, render, get, export, list\nOptions: --data-dir ROOT --project DIR; --input FILE; --title TITLE; --path PATH (repeat); --handoff-id H --predecessor R (repeat); --revision R --check-state --format json|markdown; --query TEXT; --to DIR\n"
    );
  if (args.version) return VERSION + "\n";
  if (["validate", "render"].includes(args.command)) {
    const record = validate(inputJson(args.input));
    return args.command === "render"
      ? render(record)
      : { valid: true, schema_version: 1 };
  }
  // Resolve the default only when no directory was given, so an explicit --data-dir never
  // depends on reading the default locations.
  args.data_dir ??= dataDir();
  const project = projectIdentity(args.project),
    store = new Store(args.data_dir, project);
  return store.locked(
    ["draft", "publish", "link-project"].includes(args.command),
    () => runInStore(args, store),
  );
}
function runInStore(args, store) {
  const project = store.mappedProject();
  switch (args.command) {
    case "project":
      return project;
    case "template":
      return template(args.title);
    case "inspect":
      return inspectProject(project, args.path);
    case "link-project": {
      const target = new Store(
          args.data_dir,
          projectIdentity(args.to),
        ).mappedProject(),
        original = projectIdentity(args.project);
      if (project.id === target.id)
        return { project_id: target.id, linked: true };
      if (store.entries(["projects", project.id, "handoffs"]).length)
        fail("Source project already has handoffs; linking would hide them");
      const filename = store.write(["mappings"], original.id + ".json", {
        project_id: target.id,
        anchor: original.git_common_dir || original.root,
      });
      return { project_id: target.id, linked: true, mapping_path: filename };
    }
    case "draft": {
      const payload = inputJson(args.input);
      if (!payload || typeof payload !== "object" || Array.isArray(payload))
        fail("Draft input must be an object");
      for (const key of [
        "schema_version",
        "project",
        "handoff_id",
        "revision_id",
        "created_at",
        "predecessor_revision_ids",
      ])
        if (own(payload, key))
          fail("Draft expects a payload without helper-managed fields");
      const handoff = args.handoff_id
        ? identifier(args.handoff_id)
        : "h-" + crypto.randomUUID().replaceAll("-", "");
      const parents = args.predecessor.map(identifier);
      if (parents.length && !args.handoff_id)
        fail("Updating requires --handoff-id");
      const records = store.revisions(handoff);
      if (Object.keys(records).length && !parents.length)
        fail("Existing handoff requires explicit predecessors");
      if (parents.some((id) => !own(records, id)))
        fail("Predecessor not found");
      const record = validate({
        ...payload,
        schema_version: 1,
        project,
        handoff_id: handoff,
        revision_id: "r-" + crypto.randomUUID().replaceAll("-", ""),
        created_at: new Date().toISOString(),
        predecessor_revision_ids: parents,
      });
      const filename = store.write(
        ["projects", project.id, "drafts"],
        record.revision_id + ".json",
        record,
      );
      return {
        draft: true,
        handoff_id: handoff,
        revision_id: record.revision_id,
        path: filename,
      };
    }
    case "publish": {
      const record = validate(inputJson(args.input));
      if (record.project.id !== project.id)
        fail("Record belongs to another project");
      const records = store.revisions(record.handoff_id);
      if (!own(records, record.revision_id)) {
        if (
          Object.keys(records).length &&
          !record.predecessor_revision_ids.length
        )
          fail("Existing handoff requires explicit predecessors");
        if (record.predecessor_revision_ids.some((id) => !own(records, id)))
          fail("Predecessor not found");
      }
      const parts = [
        "projects",
        project.id,
        "handoffs",
        record.handoff_id,
        "revisions",
      ];
      const filename = store.write(parts, record.revision_id + ".json", record);
      if (!equal(store.read(parts, record.revision_id + ".json"), record))
        fail("Read-back verification failed; retain the draft");
      const current = heads(store.revisions(record.handoff_id));
      return {
        published: true,
        topic: record.scope.title,
        handoff_id: record.handoff_id,
        revision_id: record.revision_id,
        path: filename,
        current_revision_ids: current,
        conflict: current.length > 1,
      };
    }
    case "list": {
      const handoffs = [];
      for (const handoff of store.entries([
        "projects",
        project.id,
        "handoffs",
      ])) {
        identifier(handoff);
        const records = store.revisions(handoff),
          current = heads(records);
        if (!current.length) continue;
        const text = Object.values(records)
          .map(
            (r) =>
              `${r.scope.title} ${r.scope.task} ${r.issue_reference || ""}`,
          )
          .join(" ");
        if (!text.toLowerCase().includes(args.query.toLowerCase())) continue;
        handoffs.push({
          handoff_id: handoff,
          current_revision_ids: current,
          titles: current.map((id) => records[id].scope.title),
          conflict: current.length > 1,
        });
      }
      return { project_id: project.id, handoffs };
    }
    case "get":
    case "export": {
      const handoff = identifier(args.handoff_id);
      let revision = args.revision;
      if (args.path.length) {
        if (args.path.length !== 1) fail("An exact record path is required");
        const supplied = expand(args.path[0]),
          expected = path.join(
            store.root,
            "projects",
            project.id,
            "handoffs",
            handoff,
            "revisions",
          );
        if (path.dirname(supplied) !== expected || !supplied.endsWith(".json"))
          fail("Record path must stay inside the selected project store");
        const inferred = identifier(path.basename(supplied, ".json"));
        if (revision && revision !== inferred)
          fail("Path and revision disagree");
        revision = inferred;
      }
      const envelope = getRecord(store, handoff, revision);
      if (args.check_state) {
        const actual = inspectProject(
          project,
          envelope.record.code_state.relevant_paths,
        );
        envelope.state_comparison = {
          freshness:
            actual.base_commit && envelope.record.code_state.base_commit
              ? "potentially stale"
              : "unverifiable",
          reason:
            "Local metadata only; the agent must recheck critical findings",
          commit_matches: actual.base_commit
            ? actual.base_commit === envelope.record.code_state.base_commit
            : null,
          current_code_state: actual,
        };
      }
      if (args.format === "json") return envelope;
      return (
        render(envelope.record) +
        "\n## Revision selection\n\nCurrent revisions: " +
        envelope.current_revision_ids.join(", ") +
        "\nSuccessors of selected revision: " +
        (envelope.successor_revision_ids.join(", ") || "none") +
        "\n" +
        (envelope.state_comparison
          ? "\n## Local state comparison\n\n" +
            JSON.stringify(envelope.state_comparison, null, 2) +
            "\n"
          : "")
      );
    }
    default:
      fail("Unknown command");
  }
}
function main(argv = process.argv.slice(2)) {
  try {
    const value = run(parse(argv));
    process.stdout.write(typeof value === "string" ? value : encoded(value));
    return 0;
  } catch (error) {
    process.stderr.write(
      JSON.stringify({
        error: error.message,
        source_file_unmodified: !argv.includes("-"),
      }) + "\n",
    );
    return 2;
  }
}
if (require.main === module) process.exitCode = main();
module.exports = {
  VERSION,
  MAX_BYTES,
  identifier,
  decode,
  encoded,
  validate,
  render,
  git,
  projectIdentity,
  Store,
  lineage,
  heads,
  inspectProject,
  trackedDigest,
  run,
  parse,
  main,
  template,
  native,
  within,
  canonical,
  dataDir,
};
