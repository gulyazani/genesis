"use client";

import { useEffect, useState } from "react";
import { Catalog } from "@/components/catalog";
import { AppShell } from "@/components/shell";
import { apiGet } from "@/lib/api-client";
import type { Listing } from "@/lib/types";

export function CatalogPage() {
  const [listings, setListings] = useState<Listing[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<{ listings: Listing[] }>("/api/listings")
      .then((data) => setListings(data.listings))
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Katalog yüklenemedi."),
      );
  }, []);

  return (
    <AppShell>
      {error ? (
        <div className="rounded-[22px] bg-red-500/10 px-4 py-8 text-center text-sm text-red-100 ring-1 ring-red-500/20">
          {error}
        </div>
      ) : listings === null ? (
        <div className="rounded-[22px] bg-[#12121a] px-4 py-10 text-center text-sm text-white/45 ring-1 ring-white/6">
          Katalog yükleniyor…
        </div>
      ) : (
        <Catalog listings={listings} />
      )}
    </AppShell>
  );
}
