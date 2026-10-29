#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { VERSION, SKILLS, sourceFile, install } = require("./install.cjs");
// ZIP with uncompressed entries. No dependencies, shell utilities, or downloads.
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function zip(entries) {
  const local = [],
    central = [];
  let offset = 0;
  for (const [name, bytes] of entries) {
    const filename = Buffer.from(name);
    const crc = crc32(bytes),
      header = Buffer.alloc(30),
      index = Buffer.alloc(46);
    header.writeUInt32LE(0x04034b50);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(0x21, 12);
    header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(filename.length, 26);
    index.writeUInt32LE(0x02014b50);
    index.writeUInt16LE(20, 4);
    index.writeUInt16LE(20, 6);
    index.writeUInt16LE(0x800, 8);
    index.writeUInt16LE(0x21, 14);
    index.writeUInt32LE(crc, 16);
    index.writeUInt32LE(bytes.length, 20);
    index.writeUInt32LE(bytes.length, 24);
    index.writeUInt16LE(filename.length, 28);
    index.writeUInt32LE(offset, 42);
    local.push(header, filename, bytes);
    central.push(index, filename);
    offset += header.length + filename.length + bytes.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}
function build(output) {
  fs.mkdirSync(output, { recursive: true });
  const platform = process.platform + "-" + process.arch;
  const files = [
    "tools/install.cjs",
    "tools/handoff.cjs",
    "schema/handoff.schema.json",
    "docs/handoff.md",
    "native/" + platform + "/posix.node",
    ...SKILLS.map((name) => "skills/" + name + "/SKILL.md"),
  ];
  const payload = Object.fromEntries(
    files.map((relative) => [
      relative,
      fs.readFileSync(sourceFile(relative)).toString("base64"),
    ]),
  );
  const installer = path.join(output, "handoff-install-" + platform + ".cjs");
  const runner = `#!/usr/bin/env node\n'use strict';\nconst fs=require('node:fs'),path=require('node:path'),os=require('node:os');\nif(process.platform+'-'+process.arch!==${JSON.stringify(platform)}){console.error('Download the matching platform installer');process.exit(2);}\nconst root=fs.mkdtempSync(path.join(os.tmpdir(),'handoff-install-'));\ntry{const payload=${JSON.stringify(payload)};for(const [name,bytes] of Object.entries(payload)){const file=path.join(root,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,Buffer.from(bytes,'base64'));}process.exitCode=require(path.join(root,'tools/install.cjs')).main();}finally{fs.rmSync(root,{recursive:true});}\n`;
  fs.writeFileSync(installer, runner, { mode: 0o700 });
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "handoff-release-")),
    skillZip = path.join(output, `handoff-skills-${VERSION}-${platform}.zip`);
  try {
    const staged = path.join(scratch, "skills");
    install(staged, SKILLS);
    const entries = [];
    for (const skill of SKILLS)
      for (const relative of [
        "SKILL.md",
        "scripts/handoff.cjs",
        "scripts/posix.node",
        "scripts/handoff.schema.json",
        "references/handoff.md",
        ".handoff-version",
      ])
        entries.push([
          "skills/" + skill + "/" + relative,
          fs.readFileSync(path.join(staged, skill, relative)),
        ]);
    fs.writeFileSync(skillZip, zip(entries));
  } finally {
    fs.rmSync(scratch, { recursive: true });
  }
  const sums = path.join(output, "SHA256SUMS-" + platform);
  fs.writeFileSync(
    sums,
    [installer, skillZip]
      .map(
        (file) =>
          crypto
            .createHash("sha256")
            .update(fs.readFileSync(file))
            .digest("hex") +
          "  " +
          path.basename(file),
      )
      .join("\n") + "\n",
  );
  return [installer, skillZip, sums];
}
if (require.main === module) {
  try {
    const argv = process.argv.slice(2);
    if (argv.length !== 2 || argv[0] !== "--output-dir")
      throw new Error("Usage: node tools/build-release.cjs --output-dir DIR");
    for (const file of build(path.resolve(argv[1]))) console.log(file);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
module.exports = { build, zip };
