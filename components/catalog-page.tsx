"use client";

import { Catalog } from "@/components/catalog";
import { AppShell } from "@/components/shell";
import type { Listing } from "@/lib/types";

export function CatalogPage({ listings }: { listings: Listing[] }) {
  return (
    <AppShell>
      <Catalog listings={listings} />
    </AppShell>
  );
}
