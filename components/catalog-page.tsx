"use client";

import { Catalog } from "@/components/catalog";
import { AppShell } from "@/components/shell";
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
  return (
    <AppShell title={title}>
      <Catalog listings={listings} variant={variant} />
    </AppShell>
  );
}
