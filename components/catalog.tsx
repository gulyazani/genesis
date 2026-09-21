"use client";

import { useMemo, useState } from "react";
import { AppWindow, CheckCircle2, Globe, LayoutGrid, Search } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { Input } from "@/components/ui/input";
import type { Listing, ListingStatus, ListingType } from "@/lib/types";

type Filter = "all" | ListingType | "sold";
type SortKey = "price-desc" | "price-asc" | "age-desc";

const FILTERS: { id: Filter; label: string; icon: typeof Globe }[] = [
  { id: "all", label: "Tümü", icon: LayoutGrid },
  { id: "domain", label: "Domain", icon: Globe },
  { id: "website", label: "Site", icon: AppWindow },
  { id: "sold", label: "Satıldı", icon: CheckCircle2 },
];

export function Catalog({ listings }: { listings: Listing[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("price-desc");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = listings.filter((item) => {
      if (filter === "sold" && item.status !== "sold") return false;
      if (filter === "domain" && item.type !== "domain") return false;
      if (filter === "website" && item.type !== "website") return false;
      if (filter !== "sold" && item.status === "sold") return false;
      if (!q) return true;
      const hay = `${item.title} ${item.url ?? ""} ${item.summary} ${item.description}`.toLowerCase();
      return hay.includes(q);
    });
    const rank = (status: ListingStatus) =>
      status === "available" ? 0 : status === "reserved" ? 1 : 2;
    return filtered.sort((a, b) => {
      const byStatus = rank(a.status) - rank(b.status);
      if (byStatus) return byStatus;
      if (sort === "price-asc") return a.price - b.price;
      if (sort === "age-desc") {
        return (b.registeredAt ?? "").localeCompare(a.registeredAt ?? "");
      }
      return b.price - a.price;
    });
  }, [listings, query, filter, sort]);

  const liveCount = listings.filter((item) => item.status !== "sold").length;

  return (
    <div>
      <label className="relative block">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-white/30" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Domain veya site ara…"
          className="h-11 rounded-full border-white/8 bg-[#12121a] pl-10 text-[15px] placeholder:text-white/30"
        />
      </label>

      <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-1">
        {FILTERS.map((item) => {
          const active = filter === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-[13px] font-medium ring-1 ${
                active
                  ? "bg-white/10 text-white ring-white/15"
                  : "bg-[#101018] text-white/55 ring-white/6"
              }`}
            >
              <Icon className="size-3.5" />
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] font-medium tracking-[0.16em] text-white/35">
        <span>{visible.length} KAYIT</span>
        <label className="flex items-center gap-2 tracking-normal text-white/50">
          <span className="hidden sm:inline">Sırala</span>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as SortKey)}
            className="rounded-md bg-transparent text-[12px] tracking-wide text-white/70 outline-none"
          >
            <option value="price-desc">Fiyat (yüksek→düşük)</option>
            <option value="price-asc">Fiyat (düşük→yüksek)</option>
            <option value="age-desc">Kayıt yaşı</option>
          </select>
        </label>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] font-medium tracking-[0.14em] text-white/30">
        <span className="inline-flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-emerald-400" />
          CANLI {liveCount} KAYIT
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-3">
        {visible.length === 0 ? (
          <div className="rounded-[22px] bg-[#12121a] px-4 py-10 text-center text-sm text-white/55 ring-1 ring-white/6">
            {listings.length === 0
              ? "Katalog boş. listings.json’a ilan ekle."
              : "Bu aramaya uyan ilan yok. Filtreleri temizleyip tekrar dene."}
          </div>
        ) : (
          visible.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))
        )}
      </div>
    </div>
  );
}
