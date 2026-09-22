"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { AppShell } from "@/components/shell";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost } from "@/lib/api-client";
import { formatUsdt } from "@/lib/format";
import type { Order } from "@/lib/types";

const PRESETS = [25, 50, 100, 250, 500];

export function BalancePage() {
  const router = useRouter();
  const search = useSearchParams();
  const suggested = Number(search.get("amount") ?? "");
  const { session, initData, refresh } = useSession();
  const [amount, setAmount] = useState(
    Number.isFinite(suggested) && suggested > 0 ? String(suggested) : "50",
  );
  const [hint, setHint] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const wallet = session?.config.wallet ?? "";
  const windowMin = session?.config.watchWindowMin ?? 120;
  const parsed = useMemo(() => Number(amount.replace(",", ".")), [amount]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<{ order: Order }>(
        "/api/topups",
        { amount: parsed, txHashHint: hint || undefined },
        initData,
      );
      await refresh();
      router.push(`/orders/${result.order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yükleme açılamadı.");
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="BAKİYE">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50"
      >
        <ArrowLeft className="size-4" />
        Katalog
      </Link>

      <div className="space-y-3">
        <section className="rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
          <p className="text-[11px] tracking-[0.16em] text-white/35">BAKİYE</p>
          <p className="mt-2 text-[32px] font-semibold leading-none">
            {formatUsdt(session?.balanceUsdt ?? 0)}
          </p>
          <p className="mt-3 text-sm text-white/50">
            Giriş yok — Telegram Mini App kimliğin. USDT TRC-20 gönder; Nizam
            onaylayınca bakiye işlenir. İlanı bakiyeden al.
          </p>
        </section>

        <section className="rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
          <p className="text-[11px] tracking-[0.16em] text-white/35">TUTAR</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(String(value))}
                className={`rounded-full px-3.5 py-2 text-[13px] font-medium ring-1 ${
                  Number(amount) === value
                    ? "bg-white/10 text-white ring-white/15"
                    : "bg-black/20 text-white/60 ring-white/6"
                }`}
              >
                {value}
              </button>
            ))}
          </div>
          <Input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            inputMode="decimal"
            placeholder="USDT"
            className="mt-3 h-11 rounded-xl border-white/8 bg-black/30"
          />
        </section>

        <section className="rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
          <p className="text-[11px] tracking-[0.16em] text-white/35">CÜZDAN</p>
          {wallet ? (
            <p className="mt-2 break-all font-mono text-[15px]">{wallet}</p>
          ) : (
            <p className="mt-2 text-sm text-amber-100">
              Cüzdan henüz ayarlı değil. Local mock ile yine yükleyebilirsin.
            </p>
          )}
          <div className="mt-3">
            <CopyButton value={wallet} disabled={!wallet} label="Adresi kopyala" />
          </div>
          <p className="mt-4 text-sm leading-relaxed text-amber-100/90">
            Yalnızca {session?.config.network ?? "TRC-20"} ·{" "}
            {session?.config.asset ?? "USDT"}. Pencere {windowMin} dakika. TX
            görünce Nizam onaylar — otomatik bakiye yok. Geç veya yanlış token
            eşleşmez.
          </p>
          <Input
            value={hint}
            onChange={(event) => setHint(event.target.value)}
            placeholder="TX hash (isteğe bağlı)"
            className="mt-3 h-11 rounded-xl border-white/8 bg-black/30 font-mono text-sm"
          />
        </section>

        {error ? <p className="text-sm text-red-200">{error}</p> : null}

        <Button
          className="h-12 w-full rounded-full bg-white text-black"
          disabled={submitting || session?.mode === "blocked"}
          onClick={submit}
        >
          {submitting ? "Yükleme açılıyor…" : "Bakiye yüklemeyi başlat"}
        </Button>
      </div>
    </AppShell>
  );
}
