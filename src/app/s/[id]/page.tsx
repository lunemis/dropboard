import { verifyShareSig } from "../../../lib/session";
import { getItem, isValidId } from "../../../lib/store";
import { t } from "../../../lib/i18n";
import { BrandMark } from "../../../components/Brand";
import { ArtifactFrame } from "../../../components/ArtifactFrame";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ e?: string; ep?: string; st?: string }>;
};

function Invalid({ message }: { message: string }) {
  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-sm text-[var(--muted)]">{message}</p>
    </div>
  );
}

export default async function SharePage({ params, searchParams }: Props) {
  const { id } = await params;
  const { e, ep, st } = await searchParams;

  if (!isValidId(id) || !e || !ep || !st) {
    return <Invalid message={t.shareInvalid} />;
  }

  const secret = process.env.DROPBOARD_SESSION_SECRET;
  const item = await getItem(id);
  if (!secret || !item) return <Invalid message={t.shareInvalid} />;

  const epoch = Number(ep);
  const exp = Number(e);
  const ok =
    (item.share_epoch ?? 0) === epoch &&
    (await verifyShareSig(secret, id, epoch, exp, st));
  if (!ok) return <Invalid message={t.shareExpired} />;

  const rawUrl = `/api/items/${id}/raw?e=${e}&ep=${ep}&st=${st}`;

  return (
    <div className="flex h-dvh flex-col">
      <header className="viewer-header flex h-15 shrink-0 items-center gap-3 border-b border-[var(--line)] px-4">
        <BrandMark className="h-6 w-6" />
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {item.title}
        </h1>
        {item.view_mode === "presentation" && (
          <span className="hidden rounded-full bg-[var(--violet-soft)] px-2 py-1 font-mono text-[9px] font-semibold tracking-wide text-[var(--violet)] uppercase sm:inline">
            {t.presentation}
          </span>
        )}
        <a
          href={rawUrl}
          target="_blank"
          rel="noopener"
          aria-label={t.openNewTab}
          title={t.openNewTab}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold text-[var(--muted)] hover:bg-[var(--surface-2)]"
        >
          <span aria-hidden="true">↗</span>
          <span className="hidden sm:inline">{t.openNewTab}</span>
        </a>
      </header>
      <ArtifactFrame
        src={rawUrl}
        title={item.title}
        viewMode={item.view_mode}
      />
    </div>
  );
}
