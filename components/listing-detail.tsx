"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { AppShell } from "@/components/shell";
import { Button } from "@/components/ui/button";
import { apiGet } from "@/lib/api-client";
import {
  displayUrl,
  formatUsdt,
  listingMetric,
  statusLabel,
  typeLabel,
} from "@/lib/format";
import type { Listing } from "@/lib/types";

export function ListingDetail({ id }: { id: string }) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ listing: Listing }>(`/api/listings/${id}`)
      .then((data) => setListing(data.listing))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "İlan yüklenemedi."),
      );
  }, [id]);

  return (
    <AppShell title="İLAN">
      <Link
        href="/"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-white/50"
      >
        <ArrowLeft className="size-4" />
        Katalog
      </Link>

      {error ? (
        <div className="rounded-[22px] bg-red-500/10 px-4 py-8 text-center text-sm text-red-100 ring-1 ring-red-500/20">
          {error}
        </div>
      ) : !listing ? (
        <div className="rounded-[22px] bg-[#12121a] px-4 py-10 text-center text-sm text-white/45">
          İlan yükleniyor…
        </div>
      ) : (
        <article className="rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
          <p className="text-[11px] font-medium tracking-[0.16em] text-white/35">
            {typeLabel(listing.type)} · {statusLabel(listing.status)}
          </p>
          <h1 className="mt-2 text-[26px] font-semibold tracking-tight">
            {displayUrl(listing)}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-white/70">
            {listing.description}
          </p>

          {listing.highlights?.length ? (
            <ul className="mt-5 space-y-2 text-sm text-white/75">
              {listing.highlights.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-sky-300" />
                  {item}
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-6">
            <div className="mb-2 flex justify-between text-[11px] tracking-[0.14em] text-white/40">
              <span>{listingMetric(listing).label}</span>
              <span>{listingMetric(listing).value}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-300"
                style={{ width: `${listingMetric(listing).fill}%` }}
              />
            </div>
          </div>

          {listing.deliveryNote ? (
            <p className="mt-5 text-sm text-white/55">{listing.deliveryNote}</p>
          ) : null}

          <div className="mt-6 flex items-end justify-between gap-3">
            <p className="text-[28px] font-semibold leading-none">
              {formatUsdt(listing.price)}
            </p>
            {listing.status === "available" ? (
              <Button
                render={<Link href={`/checkout/${listing.id}`} />}
                className="h-10 rounded-full bg-white px-5 text-black"
              >
                Satın almak istiyorum
              </Button>
            ) : listing.status === "reserved" ? (
              <p className="text-sm text-amber-200">Ödeme bekleniyor — checkout kapalı.</p>
            ) : (
              <p className="text-sm text-white/45">Satıldı — checkout yok.</p>
            )}
          </div>
        </article>
      )}
    </AppShell>
  );
}
