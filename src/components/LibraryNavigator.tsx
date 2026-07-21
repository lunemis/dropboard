import { t } from "../lib/i18n";
import {
  folderSelection,
  projectSelection,
  type LibraryFolderNode,
  type LibraryIndex,
} from "../lib/library";

export function LibraryNavigator({
  index,
  total,
  selection,
  onSelect,
  selecting,
  selectedCount,
  onToggleSelecting,
}: {
  index: LibraryIndex;
  total: number;
  selection: string;
  onSelect: (selection: string) => void;
  selecting: boolean;
  selectedCount: number;
  onToggleSelecting: () => void;
}) {
  return (
    <section className="mx-3 mt-3 overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--surface)] shadow-[var(--shadow-sm)] sm:mx-5 sm:mt-4">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--line)] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">{t.library}</h2>
          <p className="mt-0.5 text-[11px] text-[var(--muted)]">
            {t.libraryHint}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-[var(--surface-2)] px-2.5 py-1 font-mono text-[10px] text-[var(--muted)]">
            {selecting ? t.selected(selectedCount) : total}
          </span>
          <button
            type="button"
            onClick={onToggleSelecting}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              selecting
                ? "bg-[var(--ink)] text-[var(--bg)]"
                : "border border-[var(--line)] text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
            }`}
          >
            {selecting ? t.finishSelecting : t.selectItems}
          </button>
        </div>
      </div>
      <nav className="scrollbar-none flex items-start gap-2 overflow-x-auto p-3 sm:p-4">
        <div className="flex w-40 shrink-0 flex-col gap-1">
          <LibraryButton
            active={selection === "all"}
            label={t.allItems}
            count={total}
            icon="▦"
            onClick={() => onSelect("all")}
          />
          <LibraryButton
            active={selection === "unfiled"}
            label={t.unfiled}
            count={index.unfiledCount}
            icon="◌"
            emphasized={index.unfiledCount > 0}
            onClick={() => onSelect("unfiled")}
          />
        </div>

        {index.rootFolders.length > 0 && (
          <LibraryGroup
            title={t.rootFolders}
            folders={index.rootFolders}
            project={null}
            selection={selection}
            onSelect={onSelect}
          />
        )}

        {index.projects.map((group) => (
          <div
            key={group.project}
            className="w-52 shrink-0 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1.5"
          >
            <LibraryButton
              active={selection === projectSelection(group.project!)}
              label={group.project!}
              count={group.count}
              icon="◆"
              onClick={() => onSelect(projectSelection(group.project!))}
            />
            {group.folders.map((folder) => (
              <LibraryFolderButton
                key={folder.path}
                folder={folder}
                active={
                  selection === folderSelection(group.project, folder.path)
                }
                onClick={() =>
                  onSelect(folderSelection(group.project, folder.path))
                }
              />
            ))}
          </div>
        ))}
      </nav>
    </section>
  );
}

function LibraryGroup({
  title,
  folders,
  project,
  selection,
  onSelect,
}: {
  title: string;
  folders: LibraryFolderNode[];
  project: string | null;
  selection: string;
  onSelect: (selection: string) => void;
}) {
  return (
    <div className="w-52 shrink-0 rounded-xl border border-[var(--line)] bg-[var(--surface-muted)] p-1.5">
      <p className="px-2 py-1.5 text-xs font-semibold">{title}</p>
      {folders.map((folder) => (
        <LibraryFolderButton
          key={folder.path}
          folder={folder}
          active={selection === folderSelection(project, folder.path)}
          onClick={() => onSelect(folderSelection(project, folder.path))}
        />
      ))}
    </div>
  );
}

function LibraryFolderButton({
  folder,
  active,
  onClick,
}: {
  folder: LibraryFolderNode;
  active: boolean;
  onClick: () => void;
}) {
  const label = folder.path.split("/").at(-1) ?? folder.path;
  return (
    <LibraryButton
      active={active}
      label={label}
      count={folder.count}
      icon="⌞"
      onClick={onClick}
      indent={folder.depth}
    />
  );
}

function LibraryButton({
  active,
  label,
  count,
  icon,
  onClick,
  emphasized = false,
  indent = 0,
}: {
  active: boolean;
  label: string;
  count: number;
  icon: string;
  onClick: () => void;
  emphasized?: boolean;
  indent?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex min-h-9 w-full items-center gap-2 rounded-lg pr-2 text-left text-xs transition-colors ${
        active
          ? "bg-[var(--ink)] font-semibold text-[var(--bg)]"
          : emphasized
            ? "bg-[var(--accent-soft)] font-semibold text-[var(--accent)] hover:brightness-95"
            : "text-[var(--muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--ink)]"
      }`}
      style={{ paddingLeft: `${0.5 + Math.min(indent, 4) * 0.75}rem` }}
    >
      <span aria-hidden="true" className="w-3 shrink-0 text-center opacity-70">
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="font-mono text-[9px] opacity-65">{count}</span>
    </button>
  );
}
