"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { CopyButton } from "@/components/copy-button";
import { AppShell } from "@/components/shell";
import { useSession } from "@/components/session-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiGet, apiPost } from "@/lib/api-client";
import { displayUrl, formatDateTime, formatUsdt, orderStatusLabel } from "@/lib/format";
import type { Listing, Order, Session } from "@/lib/types";

export function OrderPage({ id }: { id: string }) {
  const { session, initData, refresh } = useSession();
  const [order, setOrder] = useState<Order | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState("");
  const [delivery, setDelivery] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const data = await apiGet<{
      order: Order;
      listing: Listing | null;
      session: Session;
    }>(`/api/orders/${id}`, initData);
    setOrder(data.order);
    setListing(data.listing);
    setHint(data.order.txHashHint ?? "");
  }, [id, initData]);

  useEffect(() => {
    load().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Sipariş yüklenemedi."),
    );
    const timer = window.setInterval(() => {
      void load().catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function saveHint() {
    setBusy(true);
    try {
      await apiPost(`/api/orders/${id}/hint`, { txHashHint: hint }, initData);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hash kaydedilemedi.");
    } finally {
      setBusy(false);
    }
  }

  async function mockPay(amount: number, asset = "USDT") {
    setBusy(true);
    setError(null);
    try {
      await apiPost(
        "/api/watcher/mock",
        { amount, asset, txHash: hint || undefined },
        initData,
      );
      await load();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mock ödeme başarısız.");
    } finally {
      setBusy(false);
    }
  }

  const tone =
    order?.status === "paid"
      ? "text-emerald-200"
      : order?.status === "underpaid" || order?.status === "awaiting_admin"
        ? "text-amber-200"
        : order?.status === "expired" || order?.status === "rejected"
          ? "text-red-200"
          : "text-sky-200";

  return (
    <AppShell title="SİPARİŞ">
      <Link
        href="/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50"
      >
        <ArrowLeft className="size-4" />
        Siparişlerim
      </Link>

      {error && !order ? (
        <div className="rounded-[22px] bg-red-500/10 px-4 py-8 text-center text-sm text-red-100">
          {error}
        </div>
      ) : !order ? (
        <div className="rounded-[22px] bg-[#12121a] px-4 py-10 text-center text-sm text-white/45">
          Sipariş yükleniyor…
        </div>
      ) : (
        <div className="space-y-3">
          <section className="rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
            <p className={`text-[11px] font-medium tracking-[0.16em] ${tone}`}>
              {orderStatusLabel(order.status).toUpperCase()}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight">
              {listing ? displayUrl(listing) : order.listingId}
            </h1>
            <p className="mt-4 text-[32px] font-semibold leading-none">
              {formatUsdt(order.amount)}
            </p>
            <p className="mt-3 text-sm text-white/50">
              {order.network} · {order.asset}
            </p>
            <p className="mt-1 text-sm text-white/40">
              Pencere: {formatDateTime(order.createdAt)} —{" "}
              {formatDateTime(order.expiresAt)}
            </p>
            {order.matchedTxId ? (
              <p className="mt-3 break-all font-mono text-xs text-white/45">
                TX {order.matchedTxId}
              </p>
            ) : null}
          </section>

          {order.status === "pending" && order.kind === "listing" ? (
            <section className="rounded-[22px] bg-[#12121a] p-5 text-sm text-white/60">
              Eski doğrudan zincir siparişi — izleme devam ediyor.
            </section>
          ) : null}

          {order.status === "pending" ? (
            <section className="rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
              <p className="text-sm leading-relaxed text-white/70">
                USDT’yi {order.network} ile aşağıdaki adrese gönder. Watcher
                görünce {order.kind === "topup"
                  ? "supershell bakiyeyi onaylar"
                  : "sipariş paid olur"}.
              </p>
              <p className="mt-3 break-all font-mono text-sm">
                {session?.config.wallet ||
                  order.walletAddress ||
                  "Cüzdan henüz ayarlı değil"}
              </p>
              <div className="mt-3">
                <CopyButton
                  value={session?.config.wallet || order.walletAddress}
                  disabled={!session?.config.wallet && !order.walletAddress}
                  label="Adresi kopyala"
                />
              </div>
              <p className="mt-4 text-sm text-amber-100/90">
                Yanlış ağ / token veya süre dışı TX otomatik onaylanmaz.
              </p>
              <div className="mt-4">
                <Input
                  value={hint}
                  onChange={(event) => setHint(event.target.value)}
                  placeholder="TX hash (isteğe bağlı)"
                  className="h-11 rounded-xl border-white/8 bg-black/30 font-mono text-sm"
                />
                <Button
                  variant="secondary"
                  className="mt-2 rounded-full"
                  onClick={saveHint}
                  disabled={busy}
                >
                  Hash’i kaydet
                </Button>
              </div>
            </section>
          ) : null}

          {order.status === "awaiting_admin" ? (
            <section className="rounded-[22px] bg-amber-500/10 p-5 text-sm text-amber-50 ring-1 ring-amber-400/20">
              Transfer görüldü. Bakiye, supershell onaylayınca işlenir.
            </section>
          ) : null}

          {order.status === "paid" ? (
            <section className="rounded-[22px] bg-emerald-500/10 p-5 text-sm text-emerald-50 ring-1 ring-emerald-400/20">
              {order.kind === "topup"
                ? "Onaylandı — bakiye işlendi."
                : order.deliveredAt
                  ? "Satın alındı. İlan stoktan düştü. Giriş bilgileri Telegram’dan iletildi."
                  : "Satın alındı. İlan stoktan düştü. supershell giriş bilgilerini Telegram’dan yollar."}
            </section>
          ) : null}

          {order.status === "underpaid" ? (
            <section className="rounded-[22px] bg-amber-500/10 p-5 text-sm text-amber-50 ring-1 ring-amber-400/20">
              Eksik tutar: gelen {formatUsdt(order.receivedAmount ?? 0)}, beklenen{" "}
              {formatUsdt(order.amount)}. Otomatik paid yok. Kalanı gönder veya
              destek için yaz.
            </section>
          ) : null}

          {order.status === "expired" ? (
            <section className="rounded-[22px] bg-red-500/10 p-5 text-sm text-red-50 ring-1 ring-red-400/20">
              Pencere doldu. İlan yeniden satılık olabilir. Geç TX otomatik
              eşleşmez.
            </section>
          ) : null}

          {session?.config.watcherMock &&
          order.kind === "listing" &&
          order.status === "paid" &&
          !order.deliveredAt ? (
            <section className="rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
              <p className="text-[11px] tracking-[0.16em] text-white/35">
                LOCAL — TESLİMAT
              </p>
              <p className="mt-2 text-sm text-white/60">
                Prod’da bunu bot’tan /teslim ile sen yazarsın. Bilgi diske
                yazılmaz.
              </p>
              <Input
                value={delivery}
                onChange={(event) => setDelivery(event.target.value)}
                placeholder="kullanıcı / şifre / panel"
                className="mt-3 h-11 rounded-xl border-white/8 bg-black/30 text-sm"
              />
              <Button
                className="mt-3 rounded-full bg-white text-black"
                disabled={busy || !delivery.trim()}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await apiPost(
                      `/api/orders/${order.id}/deliver`,
                      { message: delivery },
                      initData,
                    );
                    setDelivery("");
                    await load();
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Teslimat başarısız.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Alıcıya ilet (local)
              </Button>
            </section>
          ) : null}

          {session?.config.watcherMock && order.status === "awaiting_admin" ? (
            <section className="rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
              <p className="text-[11px] tracking-[0.16em] text-white/35">
                LOCAL — NİZAM ONAYI
              </p>
              <p className="mt-2 text-sm text-white/60">
                Prod’da bunu bot’tan /accept ile sen yaparsın.
              </p>
              <Button
                className="mt-3 rounded-full bg-white text-black"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await apiPost(`/api/orders/${order.id}/confirm`, {}, initData);
                    await load();
                    await refresh();
                  } catch (err) {
                    setError(
                      err instanceof Error ? err.message : "Onay başarısız.",
                    );
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Bakiyeyi onayla (local)
              </Button>
            </section>
          ) : null}

          {session?.config.watcherMock &&
          (order.status === "pending" || order.status === "underpaid") ? (
            <section className="rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
              <p className="text-[11px] tracking-[0.16em] text-white/35">
                LOCAL MOCK
              </p>
              <p className="mt-2 text-sm text-white/60">
                TronGrid yok. Eşleşen sahte TX ile watcher’ı dene.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  className="rounded-full bg-white text-black"
                  disabled={busy}
                  onClick={() => mockPay(order.amount)}
                >
                  Eşleşen ödemeyi simüle et
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-full"
                  disabled={busy}
                  onClick={() => mockPay(Math.max(1, Math.round(order.amount * 0.4)))}
                >
                  Eksik tutar
                </Button>
                <Button
                  variant="secondary"
                  className="rounded-full"
                  disabled={busy}
                  onClick={() => mockPay(order.amount, "TRX")}
                >
                  Yanlış token
                </Button>
              </div>
            </section>
          ) : null}

          {error ? <p className="text-sm text-red-200">{error}</p> : null}
        </div>
      )}
    </AppShell>
  );
}
