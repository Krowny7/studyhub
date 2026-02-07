import type { ReactNode } from "react";
import Link from "next/link";
import { VisibilityBadge } from "@/components/ContentFolderBlocks";
import { normalizeVisibility, type Visibility } from "@/lib/content/visibility";

export function ContentDetailHeader({
  backHref,
  backLabel,
  title,
  visibility,
  folderName,
  rightSlot
}: {
  backHref: string;
  backLabel: string;
  title: string;
  visibility: Visibility | string | null | undefined;
  folderName?: string | null;
  rightSlot?: ReactNode;
}) {
  const v = normalizeVisibility(visibility);

  return (
    <div className="card p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <Link href={backHref} className="text-sm text-white/80 hover:text-white">
            ← {backLabel}
          </Link>

          <h1 className="mt-2 break-words text-2xl font-semibold">{title}</h1>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <VisibilityBadge visibility={v} />
            <span className="badge badge-neutral">{folderName ? folderName : "(root)"}</span>
          </div>
        </div>

        {rightSlot ? (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
            {rightSlot}
          </div>
        ) : null}
      </div>
    </div>
  );
}
