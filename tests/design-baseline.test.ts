import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("keeps the dashboard design baseline contract", async () => {
  const [styles, board, card, dialog, packageJson] = await Promise.all([
    readFile(new URL("src/app/globals.css", root), "utf8"),
    readFile(new URL("src/components/Board.tsx", root), "utf8"),
    readFile(new URL("src/components/ArtifactCard.tsx", root), "utf8"),
    readFile(new URL("src/components/ui/DialogSurface.tsx", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(styles, /@theme inline/);
  assert.match(styles, /--color-background:\s*var\(--ds-background\)/);
  assert.match(styles, /--ds-accent:\s*#3157d5/);
  assert.match(styles, /\.board-intro/);
  assert.match(styles, /\.ui-dialog-content--sheet/);
  assert.match(board, /data-slot="topbar"/);
  assert.match(board, /data-design="control-suite"/);
  assert.match(board, /data-slot="page-intro"/);
  assert.match(board, /data-slot="toast"/);
  assert.match(card, /data-slot="card"/);
  assert.match(dialog, /DialogPrimitive\.Content/);
  assert.match(dialog, /data-slot="dialog-overlay"/);
  assert.match(dialog, /returnFocusRef/);
  assert.match(packageJson, /@radix-ui\/react-dialog/);
  assert.match(packageJson, /lucide-react/);
});
