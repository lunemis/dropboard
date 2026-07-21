import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { after, before, test } from "node:test";

const cli = path.join(process.cwd(), "bin", "dropboard.mjs");
let tempDir: string;
let artifactPath: string;

before(async () => {
  tempDir = await mkdtemp(path.join(os.tmpdir(), "dropboard-cli-"));
  artifactPath = path.join(tempDir, "artifact.md");
  await writeFile(artifactPath, "# Artifact\n");
});

after(async () => {
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
});

test("prints help successfully without a command", () => {
  const result = spawnSync(process.execPath, [cli], { encoding: "utf8" });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /dropboard publish/);
  assert.match(result.stdout, /--folder A\/B/);
});

test("rejects an invalid artifact type before publishing", () => {
  const result = spawnSync(
    process.execPath,
    [cli, "publish", artifactPath, "--type", "invalid"],
    { encoding: "utf8" },
  );
  assert.equal(result.status, 1);
  assert.match(result.stderr, /type must be one of/);
  assert.doesNotMatch(result.stderr, /docket/i);
});
