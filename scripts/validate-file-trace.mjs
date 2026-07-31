import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const buildDirName = process.env.DROPBOARD_NEXT_DIST_DIR ?? ".next";
const buildDir = path.join(root, buildDirName);
const buildDirRelative = path.relative(root, buildDir);

async function findTraceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory()
        ? findTraceFiles(entryPath)
        : Promise.resolve(entryPath.endsWith(".nft.json") ? [entryPath] : []);
    }),
  );
  return files.flat();
}

const traceFiles = await findTraceFiles(buildDir).catch((error) => {
  throw new Error(`cannot inspect ${path.relative(root, buildDir)}`, {
    cause: error,
  });
});

if (traceFiles.length === 0) {
  throw new Error("Next.js build produced no NFT trace manifests");
}

const unexpected = new Set();
for (const traceFile of traceFiles) {
  const trace = JSON.parse(await readFile(traceFile, "utf8"));
  if (!Array.isArray(trace.files)) {
    throw new Error(
      `invalid NFT trace manifest: ${path.relative(root, traceFile)}`,
    );
  }

  for (const tracedFile of trace.files) {
    if (typeof tracedFile !== "string") continue;
    const absolute = path.resolve(path.dirname(traceFile), tracedFile);
    const relative = path.relative(root, absolute);
    const isProjectFile =
      relative !== "" &&
      !relative.startsWith(`..${path.sep}`) &&
      !path.isAbsolute(relative);
    const isBuildInput =
      (relative === buildDirRelative ||
        relative.startsWith(`${buildDirRelative}${path.sep}`)) ||
      relative.startsWith(`node_modules${path.sep}`);

    if (isProjectFile && !isBuildInput) {
      unexpected.add(
        `${path.relative(root, traceFile)} -> ${relative}`,
      );
    }
  }
}

if (unexpected.size > 0) {
  console.error(
    "[dropboard] output trace unexpectedly includes project files:\n" +
      [...unexpected]
        .sort()
        .map((entry) => `- ${entry}`)
        .join("\n"),
  );
  process.exitCode = 1;
} else {
  console.log(
    `[dropboard] output trace is scoped (${traceFiles.length} manifests checked)`,
  );
}
