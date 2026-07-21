import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const TOKEN = "e2e-token-that-is-at-least-24-characters";
const AUTHORIZATION = { Authorization: `Bearer ${TOKEN}` };

async function publish(request: APIRequestContext, title: string) {
  const response = await request.post("/api/items", {
    headers: AUTHORIZATION,
    data: {
      title,
      type: "report",
      content: `# ${title}`,
      content_type: "markdown",
      source: "playwright",
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).item as { id: string };
}

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
  await page.getByLabel("PIN").fill("123456");
  await expect(page).toHaveURL(/\/$/);
}

test("organizes multiple archived documents in one action", async ({
  page,
  request,
}) => {
  const suffix = Date.now();
  const first = await publish(request, `Bulk first ${suffix}`);
  const second = await publish(request, `Bulk second ${suffix}`);
  await patchItem(request, first.id, { status: "archived" });
  await patchItem(request, second.id, { status: "archived" });

  await login(page);
  await page.goto("/archive");
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
