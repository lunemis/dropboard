import { rm } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const dataDir = process.env.DROPBOARD_DATA_DIR;
if (!dataDir) throw new Error("DROPBOARD_DATA_DIR is required for E2E tests");

await rm(path.dirname(dataDir), { recursive: true, force: true });

const port = process.env.DROPBOARD_E2E_PORT ?? "3015";
const nextBin = path.join(
  process.cwd(),
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);
const server = spawn(process.execPath, [nextBin, "start", "-p", port], {
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

const exitCode = await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.once("exit", (code) => resolve(code ?? 1));
});
process.exitCode = exitCode;
