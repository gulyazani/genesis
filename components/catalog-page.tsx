"use client";

import { useEffect, useState } from "react";
import { Catalog } from "@/components/catalog";
import { AppShell } from "@/components/shell";
import { apiGet } from "@/lib/api-client";
import type { Listing } from "@/lib/types";

export function CatalogPage({
  listings,
  variant,
  title,
}: {
  listings: Listing[];
  variant: "domains" | "ready";
  title: string;
}) {
  const [items, setItems] = useState(listings);

  useEffect(() => {
    let cancelled = false;
    async function pull() {
      try {
        const data = await apiGet<{ listings: Listing[] }>("/api/listings");
        if (!cancelled && Array.isArray(data.listings)) {
          setItems(data.listings);
        }
      } catch {
        if (!cancelled) setItems(listings);
      }
    }
    void pull();
    const onVisible = () => {
      if (document.visibilityState === "visible") void pull();
    };
    window.addEventListener("focus", pull);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", pull);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [listings]);

  return (
    <AppShell title={title}>
      <Catalog listings={items} variant={variant} />
    </AppShell>
  );
}
