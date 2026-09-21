"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { AppShell } from "@/components/shell";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiPost } from "@/lib/api-client";
import { displayUrl, formatUsdt } from "@/lib/format";
import type { Listing, Order } from "@/lib/types";

export function CheckoutPage({
  listing: initial,
}: {
  listing: Listing | null;
}) {
  const router = useRouter();
  const { session, initData } = useSession();
  const listing = initial;
  const [error, setError] = useState<string | null>(
    initial ? null : "İlan bulunamadı.",
  );
  const [hint, setHint] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const wallet = session?.config.wallet ?? "";
  const windowMin = session?.config.watchWindowMin ?? 120;

  async function submit() {
    if (!listing) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<{ order: Order }>(
        "/api/orders",
        { listingId: listing.id, txHashHint: hint || undefined },
        initData,
      );
      router.push(`/orders/${result.order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sipariş oluşturulamadı.");
      setSubmitting(false);
    }
  }

  return (
    <AppShell title="ÖDEME">
      <Link
        href={listing ? `/listings/${listing.id}` : "/"}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50"
      >
        <ArrowLeft className="size-4" />
        Geri
      </Link>

      {error && !listing ? (
        <div className="rounded-[22px] bg-red-500/10 px-4 py-8 text-center text-sm text-red-100 ring-1 ring-red-500/20">
          {error}
        </div>
      ) : !listing ? (
        <div className="rounded-[22px] bg-[#12121a] px-4 py-10 text-center text-sm text-white/45">
          Checkout hazırlanıyor…
        </div>
      ) : listing.status !== "available" ? (
        <div className="rounded-[22px] bg-[#12121a] px-4 py-8 text-sm text-white/70 ring-1 ring-white/6">
          {listing.status === "sold"
            ? "Bu ilan satıldı. Checkout kapalı."
            : "Bu ilan için ödeme bekleniyor. Pencere dolunca tekrar açılır."}
          <div className="mt-4">
            <Button render={<Link href="/" />} variant="secondary">
              Kataloğa dön
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <section className="rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
            <p className="text-[11px] tracking-[0.16em] text-white/35">SİPARİŞ</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">
              {displayUrl(listing)}
            </h1>
            <p className="mt-4 text-[32px] font-semibold leading-none">
              {formatUsdt(listing.price)}
            </p>
            <p className="mt-2 text-sm text-white/50">
              USD ≡ USDT · {session?.config.network ?? "TRC-20"} ·{" "}
              {session?.config.asset ?? "USDT"}
            </p>
          </section>

          <section className="rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
            <p className="text-[11px] tracking-[0.16em] text-white/35">CÜZDAN</p>
            {wallet ? (
              <p className="mt-2 break-all font-mono text-[15px] text-white">
                {wallet}
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-100">
                Cüzdan adresi henüz ayarlı değil. Local demo için siparişi açıp
                mock ödemeyi kullan.
              </p>
            )}
            <div className="mt-3">
              <CopyButton value={wallet} disabled={!wallet} label="Adresi kopyala" />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-amber-100/90">
              Yalnızca {session?.config.network ?? "TRC-20"} ağında{" "}
              {session?.config.asset ?? "USDT"} gönder. Başka zincir veya token
              otomatik eşleşmez. İzleme penceresi {windowMin} dakika — geç TX
              paid olmaz.
            </p>
          </section>

          <section className="rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
            <label className="text-[11px] tracking-[0.16em] text-white/35">
              TX HASH (isteğe bağlı)
            </label>
            <Input
              value={hint}
              onChange={(event) => setHint(event.target.value)}
              placeholder="Gönderdiğin işlemin hash’i"
              className="mt-2 h-11 rounded-xl border-white/8 bg-black/30 font-mono text-sm"
            />
            <p className="mt-2 text-xs text-white/40">
              Aynı tutarda iki bekleyen varsa hash, doğru siparişe bağlar.
            </p>
          </section>

          {error ? (
            <p className="px-1 text-sm text-red-200">{error}</p>
          ) : null}

          <Button
            className="h-12 w-full rounded-full bg-white text-black"
            onClick={submit}
            disabled={submitting || session?.mode === "blocked"}
          >
            {submitting ? "Sipariş yazılıyor…" : "Siparişi aç ve izlemeyi başlat"}
          </Button>
        </div>
      )}
    </AppShell>
  );
}
