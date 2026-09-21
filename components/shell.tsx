"use client";

import Link from "next/link";
import { ClipboardList, Hexagon } from "lucide-react";
import { useSession } from "@/components/session-provider";
import { cn } from "@/lib/utils";

export function AppShell({
  children,
  title = "KATALOG",
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const { session, loading } = useSession();
  const mode = session?.mode;
  const blocked = mode === "blocked";

  return (
    <div className="mx-auto flex min-h-full w-full max-w-lg flex-1 flex-col px-4 pb-10 pt-3 sm:px-5">
      <header className="mb-4 flex items-center justify-between gap-3">
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-white/5 ring-1 ring-white/10">
            <Hexagon className="size-4 text-sky-300" strokeWidth={2.2} />
          </span>
          <span className="truncate text-[15px] font-medium tracking-tight">
            sellshell
            <span className="mx-1.5 text-white/25">{"//"}</span>
            <span className="text-white/45">{title}</span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] font-medium tracking-wide text-white/70 ring-1 ring-white/10">
            USDT · TRC-20
          </span>
          <Link
            href="/orders"
            aria-label="Siparişlerim"
            className="grid size-8 place-items-center rounded-lg bg-white/5 ring-1 ring-white/10 text-white/80"
          >
            <ClipboardList className="size-4" />
          </Link>
        </div>
      </header>

      {loading ? null : blocked ? (
        <div className="mb-4 rounded-2xl bg-amber-400/10 px-3.5 py-3 text-sm text-amber-100 ring-1 ring-amber-400/20">
          Bu uygulamayı Telegram bot üzerinden açın. Mini App kimliği doğrulanmadı.
        </div>
      ) : mode === "demo" ? (
        <div className="mb-4 rounded-2xl bg-sky-400/10 px-3.5 py-3 text-sm text-sky-100/90 ring-1 ring-sky-400/15">
          Yerel demo — Telegram doğrulaması kapalı. Prod’da bot üzerinden açın.
        </div>
      ) : null}

      <div className={cn(blocked && "pointer-events-none opacity-40")}>
        {children}
      </div>
    </div>
  );
}
