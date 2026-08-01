import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const TOKEN = "e2e-token-that-is-at-least-24-characters";
const AUTHORIZATION = { Authorization: `Bearer ${TOKEN}` };

async function publish(
  request: APIRequestContext,
  title: string,
  overrides: Record<string, unknown> = {},
) {
  const response = await request.post("/api/items", {
    headers: AUTHORIZATION,
    data: {
      title,
      type: "report",
      content: `# ${title}`,
      content_type: "markdown",
      source: "playwright",
      ...overrides,
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).item as { id: string };
}

test("presents wide artifacts with clear viewport and fullscreen affordances", async ({
  page,
  request,
}) => {
  const title = `Presentation ${Date.now()}`;
  const item = await publish(request, title, {
    content: `<!doctype html>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>${title}</title>
      <button id="present" onclick="document.documentElement.requestFullscreen()">Present</button>`,
    content_type: "html",
    view_mode: "presentation",
  });

  await login(page);
  const card = page.locator("li").filter({ hasText: title });
  await expect(card.getByText("Presentation", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/i/${item.id}`);
  await expect(
    page.getByRole("heading", {
      name: "This presentation needs a larger screen",
    }),
  ).toBeVisible();
  const openInNewTab = page
    .getByRole("link", { name: "Open in new tab" })
    .first();
  await expect(openInNewTab).toHaveAttribute("target", "_blank");
  await expect(openInNewTab).toHaveAttribute("rel", "noopener");

  const iframe = page.locator("iframe");
  await expect(iframe).toHaveAttribute("sandbox", "allow-scripts");
  await expect(iframe).toHaveAttribute("allow", "fullscreen");
  await expect(iframe).toBeHidden();
  await page.getByRole("button", { name: "Open anyway" }).click();
  await expect(iframe).toBeVisible();

  const artifact = page.frames().find((frame) => frame !== page.mainFrame());
  expect(artifact).toBeTruthy();
  expect(await artifact!.evaluate(() => document.fullscreenEnabled)).toBe(true);
  await artifact!.locator("#present").click();
  await expect
    .poll(() =>
      artifact!.evaluate(() => document.fullscreenElement?.tagName ?? null),
    )
    .toBe("HTML");
  await artifact!.evaluate(() => document.exitFullscreen());
});

async function patchItem(
  request: APIRequestContext,
  id: string,
  patch: Record<string, unknown>,
) {
  const response = await request.patch(`/api/items/${id}`, {
    headers: AUTHORIZATION,
    data: patch,
  });
  expect(response.ok()).toBeTruthy();
}

async function login(page: Page) {
  await page.goto("/login");
  const pin = page.getByLabel("PIN");
  await expect(pin).toBeVisible();
  await pin.fill("123456");
  await pin.press("Enter");
  await expect(page).toHaveURL(/\/$/);
}

test("routes completed work to Archive and durable work to Library", async ({
  page,
  request,
}) => {
  const suffix = Date.now();
  const reportTitle = `Completed report ${suffix}`;
  const keepTitle = `Keep reference ${suffix}`;
  const bookTitle = `Direct library book ${suffix}`;
  await publish(request, reportTitle);
  await publish(request, keepTitle);
  await publish(request, bookTitle, {
    destination: "library",
    view_mode: "reader",
  });

  await login(page);
  const report = page.locator("li").filter({ hasText: reportTitle });
  await report.getByRole("button", { name: "Archive", exact: true }).click();
  const reference = page.locator("li").filter({ hasText: keepTitle });
  await reference
    .getByRole("button", { name: "Keep in library", exact: true })
    .click();

  await page.goto("/archive");
  await expect(page.getByText(reportTitle)).toBeVisible();
  await expect(page.getByText(keepTitle)).toHaveCount(0);
  await expect(page.getByText(bookTitle)).toHaveCount(0);

  await page.goto("/library");
  await expect(page.getByText(reportTitle)).toHaveCount(0);
  await expect(page.getByText(keepTitle)).toBeVisible();
  await expect(page.getByText(bookTitle)).toBeVisible();
  const book = page.locator("li").filter({ hasText: bookTitle });
  await expect(book.getByText("Book", { exact: true })).toBeVisible();
});

test("organizes multiple library documents in one action", async ({
  page,
  request,
}) => {
  const suffix = Date.now();
  const first = await publish(request, `Bulk first ${suffix}`);
  const second = await publish(request, `Bulk second ${suffix}`);
  await patchItem(request, first.id, { status: "library" });
  await patchItem(request, second.id, { status: "library" });

  await login(page);
  await page.goto("/library");
  await expect(
    page.getByRole("link", { name: "Archive", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Library", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Select", exact: true }).click();
  await page.getByLabel(`Select Bulk first ${suffix}`).check();
  await page.getByLabel(`Select Bulk second ${suffix}`).check();
  await page
    .getByRole("button", { name: "Move selected", exact: true })
    .click();

  const dialog = page.getByRole("dialog", { name: "Move documents" });
  await dialog.getByLabel("Project").fill("E2E Project");
  await dialog.getByLabel("Folder").fill("Research / Browser");
  await dialog
    .getByRole("button", { name: "Move selected", exact: true })
    .click();
  await expect(dialog).toBeHidden();
  await expect(
    page.getByText("Moved 2 documents", { exact: true }),
  ).toBeVisible();

  for (const id of [first.id, second.id]) {
    const response = await request.get(`/api/items/${id}`, {
      headers: AUTHORIZATION,
    });
    const { item } = await response.json();
    expect(item.project).toBe("E2E Project");
    expect(item.folder).toBe("Research/Browser");
  }
});

test("restores an earlier revision as a new revision", async ({
  page,
  request,
}) => {
  const title = `Versioned ${Date.now()}`;
  const item = await publish(request, title);
  const revision = await request.post(`/api/items/${item.id}/revisions`, {
    headers: AUTHORIZATION,
    data: {
      title: `${title} v2`,
      content: "# Version two",
      content_type: "markdown",
      revision_note: "Second version",
    },
  });
  expect(revision.ok()).toBeTruthy();

  await login(page);
  await page.goto(`/i/${item.id}`);
  await page.getByRole("button", { name: "Versions" }).click();
  const dialog = page.getByRole("dialog", { name: "Version history" });
  await dialog.getByRole("button", { name: /v1/ }).click();
  await dialog.getByRole("button", { name: "Restore this version" }).click();
  await dialog.getByRole("button", { name: "Restore?" }).click();

  await expect(dialog).toBeHidden();
  await expect(page.getByText("Restored v1 as a new revision")).toBeVisible();
  await expect(page.getByRole("button", { name: "Versions" })).toContainText(
    "v3",
  );
});

test("moves a document to trash and deletes it permanently", async ({
  page,
  request,
}) => {
  const title = `Delete me ${Date.now()}`;
  const item = await publish(request, title);

  await login(page);
  const inboxCard = page.locator("li").filter({ hasText: title });
  await inboxCard.getByRole("button", { name: "Move to trash" }).click();
  await expect(page.getByText(title, { exact: true })).toBeHidden();

  await page.goto("/trash");
  const trashCard = page.locator("li").filter({ hasText: title });
  await trashCard.getByRole("button", { name: "Delete forever" }).click();
  await trashCard.getByRole("button", { name: "Sure?" }).click();
  await expect(page.getByText(title, { exact: true })).toBeHidden();

  const response = await request.get(`/api/items/${item.id}`, {
    headers: AUTHORIZATION,
  });
  expect(response.status()).toBe(404);
});
