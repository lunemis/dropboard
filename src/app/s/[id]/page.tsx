import { verifyShareSig } from "../../../lib/session";
import { getItem, isValidId } from "../../../lib/store";
import { t } from "../../../lib/i18n";

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
  if (!item) return <Invalid message={t.shareInvalid} />;

  const epoch = Number(ep);
  const exp = Number(e);
  if (secret) {
    const ok =
      (item.share_epoch ?? 0) === epoch &&
      (await verifyShareSig(secret, id, epoch, exp, st));
    if (!ok) return <Invalid message={t.shareExpired} />;
  }

  const rawUrl = `/api/items/${id}/raw?e=${e}&ep=${ep}&st=${st}`;

  return (
    <div className="flex h-dvh flex-col">
      <header className="flex h-14 shrink-0 items-center border-b border-[var(--line)] bg-[var(--bg)] px-4">
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">
          {item.title}
        </h1>
      </header>
      <iframe
        sandbox="allow-scripts"
        src={rawUrl}
        title={item.title}
        className="w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}
