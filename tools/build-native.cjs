#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
function build(options = {}) {
  if (!["darwin", "linux"].includes(process.platform))
    throw new Error("Native filesystem addon supports macOS/Linux only");
  const headers =
    process.env.HANDOFF_NODE_HEADERS ||
    process.env.ASTACK_NODE_HEADERS ||
    path.resolve(path.dirname(process.execPath), "../include/node");
  if (!fs.existsSync(path.join(headers, "node_api.h")))
    throw new Error(
      "Local Node headers missing; set HANDOFF_NODE_HEADERS to the directory containing node_api.h. No automatic download.",
    );
  const output = path.join(
    root,
    "native",
    `${process.platform}-${process.arch}`,
    "posix.node",
  );
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const flags = [
    "-O2",
    "-Wall",
    "-Wextra",
    "-Werror",
    "-fPIC",
    "-I",
    headers,
    "-DNAPI_VERSION=8",
  ];
  flags.push(
    ...(process.platform === "darwin"
      ? ["-mmacosx-version-min=11.0", "-bundle", "-undefined", "dynamic_lookup"]
      : ["-shared"]),
  );
  const result = spawnSync(
    process.env.CC || "cc",
    [...flags, path.join(root, "native/posix.c"), "-o", output],
    { stdio: options.stdio || "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error("Native addon build failed");
  return output;
}
if (require.main === module) {
  try {
    console.log(build());
  } catch (error) {
    console.error(error.message);
    process.exitCode = 2;
  }
}
module.exports = { build };
