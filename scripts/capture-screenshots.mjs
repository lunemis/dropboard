import { spawn } from "node:child_process";
import path from "node:path";
import { chromium } from "@playwright/test";

const root = process.cwd();
const port = "3015";
const baseURL = `http://127.0.0.1:${port}`;
const token = "screenshot-token-that-is-at-least-24-characters";
const env = {
  ...process.env,
  DROPBOARD_DATA_DIR: path.join(root, ".e2e-data", "screenshots"),
  DROPBOARD_TOKEN: token,
  DROPBOARD_PIN: "123456",
  DROPBOARD_SESSION_SECRET:
    "screenshot-session-secret-that-is-at-least-32-characters",
  NEXT_PUBLIC_DROPBOARD_LOCALE: "en",
  DROPBOARD_E2E_PORT: port,
};
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: "inherit",
      ...options,
    });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function waitForServer() {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(`${baseURL}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error("screenshot server did not become ready");
}

async function api(pathname, options = {}) {
  const response = await fetch(`${baseURL}${pathname}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  if (!response.ok) {
    throw new Error(
      `${options.method ?? "GET"} ${pathname}: ${response.status}`,
    );
  }
  return response.json();
}

async function publish(input) {
  return (
    await api("/api/items", {
      method: "POST",
      body: JSON.stringify({
        type: "info",
        content_type: "markdown",
        source: "screenshot-fixture",
        ...input,
      }),
    })
  ).item;
}

async function archive(input) {
  const item = await publish(input);
  await api(`/api/items/${item.id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "archived" }),
  });
  return item;
}

const deliverableHtml = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>
*{box-sizing:border-box}body{margin:0;background:#f7f6f3;color:#17202b;font:15px/1.55 ui-sans-serif,system-ui;padding:28px 22px}main{max-width:720px;margin:auto}p{color:#657080}h1{font-size:30px;line-height:1.15;letter-spacing:-.03em;margin:0 0 8px}.eyebrow{font:700 11px ui-monospace,monospace;color:#ed5b42;text-transform:uppercase;letter-spacing:.12em}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:24px 0}.card{background:white;border:1px solid #deddd8;border-radius:15px;padding:16px}.value{font-size:25px;font-weight:750}.label{font-size:11px;color:#7a8189}.recommendation{border-left:3px solid #ed5b42;background:#fff0eb;border-radius:0 14px 14px 0;padding:16px 18px;margin-top:22px}.recommendation strong{display:block;margin-bottom:4px}@media(max-width:520px){body{padding:25px 20px}.grid{grid-template-columns:1fr}.card{display:flex;align-items:center;justify-content:space-between}.value{font-size:21px}}
</style></head><body><main><div class="eyebrow">Launch readiness · v2</div><h1>Open-source launch brief</h1><p>A focused review of what is ready, what still carries risk, and the smallest credible release plan.</p><div class="grid"><div class="card"><div class="value">50</div><div class="label">automated checks</div></div><div class="card"><div class="value">3</div><div class="label">browser flows</div></div><div class="card"><div class="value">0</div><div class="label">critical findings</div></div></div><div class="recommendation"><strong>Recommendation</strong>Ship a tagged preview release, then collect installation feedback before expanding integrations.</div></main></body></html>`;

await run(npm, ["run", "build"]);
const server = spawn(process.execPath, ["scripts/e2e-server.mjs"], {
  cwd: root,
  env,
  stdio: "inherit",
});

let browser;
try {
  await waitForServer();
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  await page.goto(`${baseURL}/login`);
  await page.screenshot({
    path: path.join(root, "docs/screenshots/shot-login.png"),
  });

  await publish({
    title: "Launch brief — quick look",
    summary: "A temporary preview that clears itself after the review window.",
    type: "review",
    content: "# Launch brief\n\nTemporary review copy.",
    ttl_minutes: 120,
    tags: ["launch", "preview"],
  });
  const versioned = await publish({
    title: "Open-source launch brief",
    summary:
      "Readiness, remaining risks, and the smallest credible release plan.",
    type: "report",
    content_type: "html",
    content: deliverableHtml.replace("v2", "v1"),
    project: "Dropboard",
    folder: "Releases",
    tags: ["open-source", "launch"],
    document_key: "screenshots/open-source-launch",
  });
  await api(`/api/items/${versioned.id}/revisions`, {
    method: "POST",
    body: JSON.stringify({
      title: "Open-source launch brief",
      content: deliverableHtml,
      content_type: "html",
      revision_note: "Added release recommendation",
      source: "screenshot-fixture",
    }),
  });
  await publish({
    title: "Choose the launch channel",
    summary:
      "Compare a tagged preview, community beta, and a quiet source release.",
    type: "decision",
    content: "# Launch channel decision",
    tags: ["launch"],
  });
  await publish({
    title: "Agent publishing contract",
    summary: "Stable keys, immutable revisions, and safe update behavior.",
    type: "info",
    content: "# Agent publishing contract",
    project: "Dropboard",
    tags: ["agents", "api"],
  });
  await publish({
    title: "Weekend idea queue",
    summary: "Small experiments worth trying after the release is stable.",
    type: "fun",
    content: "# Weekend ideas",
  });

  await archive({
    title: "Authentication threat model",
    summary: "PIN, session, bearer token, and public share boundaries.",
    type: "review",
    content: "# Authentication threat model",
    project: "Dropboard",
    folder: "Security",
    tags: ["security"],
  });
  await archive({
    title: "Release checklist",
    summary: "The repeatable path from verified main to a tagged release.",
    type: "info",
    content: "# Release checklist",
    project: "Dropboard",
    folder: "Releases",
    tags: ["release"],
  });
  await archive({
    title: "Onboarding usability notes",
    summary: "Where first-time self-hosters hesitate during setup.",
    type: "report",
    content: "# Onboarding usability notes",
    project: "Dropboard",
    folder: "Research",
    tags: ["onboarding"],
  });
  await archive({
    title: "Competitor workflow scan",
    summary: "How adjacent tools move AI output from chat into durable work.",
    type: "report",
    content: "# Competitor workflow scan",
    project: "Market research",
    folder: "Competitors",
    tags: ["research"],
  });
  await archive({
    title: "Prompt publishing playbook",
    summary: "Reusable patterns for deciding when an artifact should update.",
    type: "info",
    content: "# Prompt publishing playbook",
    project: "Agent ops",
    folder: "Playbooks",
    tags: ["agents"],
  });
  await api(`/api/items/${versioned.id}`, {
    method: "PATCH",
    body: JSON.stringify({ pinned: true }),
  });

  await page.getByLabel("PIN").fill("123456");
  await page.waitForURL(`${baseURL}/`);
  await page
    .locator("li")
    .filter({ hasText: "Launch brief — quick look" })
    .waitFor();
  await page.screenshot({
    path: path.join(root, "docs/screenshots/shot-inbox.png"),
  });

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(baseURL);
  await page
    .locator("li")
    .filter({ hasText: "Launch brief — quick look" })
    .waitFor();
  await page.screenshot({
    path: path.join(root, "docs/screenshots/desktop-inbox.png"),
  });

  await page.goto(`${baseURL}/archive`);
  await page
    .locator("li")
    .filter({ hasText: "Authentication threat model" })
    .waitFor();
  await page.screenshot({
    path: path.join(root, "docs/screenshots/desktop-library.png"),
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}/i/${versioned.id}`);
  await page
    .frameLocator("iframe")
    .getByText("Open-source launch brief", { exact: true })
    .waitFor();
  await page.screenshot({
    path: path.join(root, "docs/screenshots/shot-viewer.png"),
  });
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
