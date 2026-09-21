"use client";

import Link from "next/link";
import { Link2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayUrl, formatUsdt, listingMetric, typeLabel } from "@/lib/format";
import type { Listing } from "@/lib/types";

export function ListingCard({ listing }: { listing: Listing }) {
  const metric = listingMetric(listing);
  const sold = listing.status === "sold";
  const reserved = listing.status === "reserved";
  const href = `/listings/${listing.id}`;

  return (
    <article className="rounded-[22px] bg-[#12121a] p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <Link href={href} className="min-w-0">
          <h2 className="truncate text-[22px] font-medium leading-tight tracking-tight text-white">
            {displayUrl(listing)}
          </h2>
        </Link>
        <Link
          href={href}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-white/35 hover:bg-white/5 hover:text-white/70"
          aria-label="İlanı aç"
        >
          <Link2 className="size-4" />
        </Link>
      </div>

      <div className="mt-6">
        <div className="mb-2 flex items-end justify-between text-[11px] font-medium tracking-[0.14em] text-white/40">
          <span>{metric.label}</span>
          <span className="text-lg font-semibold tracking-tight text-white/90">
            {metric.value}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
          <div
            className="h-full rounded-full bg-gradient-to-r from-sky-600 to-sky-300"
            style={{ width: `${sold ? 100 : metric.fill}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[12px] font-medium text-white/55">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-sky-300/80" />
          {sold ? "SATILDI" : typeLabel(listing.type)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Link2 className="size-3.5 text-white/35" />
          {listing.registrar ??
            (listing.pageCount ? `${listing.pageCount} sayfa` : "Teslimat sohbet")}
        </span>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-[28px] font-semibold leading-none tracking-tight">
            {new Intl.NumberFormat("tr-TR").format(listing.price)}
            <span className="ml-1 text-[11px] font-medium tracking-wider text-white/40">
              USDT
            </span>
          </p>
        </div>
        {sold ? (
          <Button
            disabled
            className="h-10 rounded-full bg-white/10 px-5 text-white/50"
          >
            SATILDI
          </Button>
        ) : reserved ? (
          <Button
            render={<Link href={href} />}
            className="h-10 rounded-full bg-amber-200 px-5 text-black hover:bg-amber-100"
          >
            BEKLENİYOR
          </Button>
        ) : (
          <Button
            render={<Link href={`/checkout/${listing.id}`} />}
            className="h-10 rounded-full bg-white px-5 text-black hover:bg-white/90"
          >
            <Plus className="size-4" />
            SATIN AL
          </Button>
        )}
      </div>
      <p className="sr-only">{formatUsdt(listing.price)}</p>
    </article>
  );
}
