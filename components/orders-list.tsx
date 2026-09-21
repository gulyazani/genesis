"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/shell";
import { useSession } from "@/components/session-provider";
import { apiGet } from "@/lib/api-client";
import { formatUsdt, orderStatusLabel } from "@/lib/format";
import type { Order } from "@/lib/types";

export function OrdersList() {
  const { initData } = useSession();
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ orders: Order[] }>("/api/orders", initData)
      .then((data) => setOrders(data.orders))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Siparişler yüklenemedi."),
      );
  }, [initData]);

  return (
    <AppShell title="SİPARİŞLER">
      {error ? (
        <div className="rounded-[22px] bg-red-500/10 px-4 py-8 text-center text-sm text-red-100">
          {error}
        </div>
      ) : orders === null ? (
        <div className="rounded-[22px] bg-[#12121a] px-4 py-10 text-center text-sm text-white/45">
          Siparişler yükleniyor…
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-[22px] bg-[#12121a] px-4 py-10 text-center text-sm text-white/55 ring-1 ring-white/6">
          Henüz siparişin yok.
          <div className="mt-4">
            <Link href="/" className="text-sky-300 underline-offset-4 hover:underline">
              Kataloğa dön
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <Link
              key={order.id}
              href={`/orders/${order.id}`}
              className="block rounded-[18px] bg-[#12121a] px-4 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">
                  {order.kind === "topup"
                    ? "Bakiye yükleme"
                    : order.listingId || "Sipariş"}
                </p>
                <p className="text-sm text-white/50">{formatUsdt(order.amount)}</p>
              </div>
              <p className="mt-1 text-xs text-white/40">
                {orderStatusLabel(order.status)} · {order.id}
              </p>
            </Link>
          ))}
        </div>
      )}
    </AppShell>
  );
}
