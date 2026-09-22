"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/shell";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { apiPost } from "@/lib/api-client";
import { displayUrl, formatUsdt } from "@/lib/format";
import type { Listing, Order } from "@/lib/types";

export function CheckoutPage({
  listing: initial,
}: {
  listing: Listing | null;
}) {
  const router = useRouter();
  const { session, initData, refresh } = useSession();
  const listing = initial;
  const [error, setError] = useState<string | null>(
    initial ? null : "İlan bulunamadı.",
  );
  const [submitting, setSubmitting] = useState(false);

  const balance = session?.balanceUsdt ?? 0;
  const enough = listing ? balance >= listing.price : false;
  const shortfall = listing ? Math.max(0, listing.price - balance) : 0;

  async function submit() {
    if (!listing) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await apiPost<{ order: Order }>(
        "/api/orders",
        { listingId: listing.id },
        initData,
      );
      await refresh();
      router.refresh();
      router.push(`/orders/${result.order.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Satın alınamadı.");
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
            : "Bu ilan için ödeme bekleniyor."}
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
              USD ≡ USDT · bakiyeden. Giriş bilgilerini Nizam Telegram’dan yollar.
            </p>
          </section>

          <section className="rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
            <p className="text-[11px] tracking-[0.16em] text-white/35">BAKİYE</p>
            <p className="mt-2 text-2xl font-semibold">{formatUsdt(balance)}</p>
            {enough ? (
              <p className="mt-2 text-sm text-emerald-200">
                Yeterli — bakiyeden düşülecek.
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-100">
                Eksik {formatUsdt(shortfall)}. Önce Bakiye Yükle.
              </p>
            )}
          </section>

          {error ? <p className="px-1 text-sm text-red-200">{error}</p> : null}

          {enough ? (
            <Button
              className="h-12 w-full rounded-full bg-white text-black"
              onClick={submit}
              disabled={submitting || session?.mode === "blocked"}
            >
              {submitting ? "Ödeniyor…" : "Bakiyeden satın al"}
            </Button>
          ) : (
            <Button
              render={
                <Link href={`/balance?amount=${Math.max(1, Math.ceil(shortfall))}`} />
              }
              className="h-12 w-full rounded-full bg-white text-black"
            >
              Bakiye Yükle
            </Button>
          )}
        </div>
      )}
    </AppShell>
  );
}
