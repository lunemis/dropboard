import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const packageJson = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const expectedTag = `v${packageJson.version}`;
const tag = process.argv[2] ?? expectedTag;

if (tag !== expectedTag) {
  throw new Error(
    `release tag ${tag} does not match package version ${packageJson.version}`,
  );
}

const notesPath = path.join(root, "docs", "releases", `${tag}.md`);
await readFile(notesPath, "utf8").catch(() => {
  throw new Error(
    `missing curated release notes: ${path.relative(root, notesPath)}`,
  );
});

const changelog = await readFile(path.join(root, "CHANGELOG.md"), "utf8");
if (!changelog.includes(`## [${packageJson.version}] - `)) {
  throw new Error(
    `CHANGELOG.md has no dated ${packageJson.version} release entry`,
  );
}

console.log(`${tag} metadata is ready`);
