/**
 * Built-in storage sweeper — runs inside the server process so no external
 * cron/scheduler is needed. Purges expired temp items (always) and trashed
 * items older than DROPBOARD_TRASH_TTL_DAYS (0 skips the trash purge).
 */
const SWEEP_INTERVAL_MS = 15 * 60 * 1000;
const FIRST_SWEEP_DELAY_MS = 30 * 1000;

export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const trashTtl = Number(process.env.DROPBOARD_TRASH_TTL_DAYS ?? 30);

  const { sweepStorage } = await import("./lib/store");
  const sweep = async () => {
    try {
      const { removed } = await sweepStorage(trashTtl > 0 ? trashTtl : 0);
      if (removed > 0) {
        console.log(`[dropboard] sweep: purged ${removed} item(s)`);
      }
    } catch (err) {
      console.error("[dropboard] sweep failed:", err);
    }
  };
  setTimeout(sweep, FIRST_SWEEP_DELAY_MS);
  setInterval(sweep, SWEEP_INTERVAL_MS);
  console.log(
    `[dropboard] sweeper armed (every 15m; temp expiry + trash ttl ${trashTtl}d)`,
  );
}
