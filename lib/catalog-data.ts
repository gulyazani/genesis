import { expireOverdueOrders, getListing } from "@/lib/orders";
import { readListings } from "@/lib/store";
import { ensureWatcher } from "@/lib/watcher";

export async function loadCatalog() {
  ensureWatcher();
  await expireOverdueOrders();
  return readListings();
}

export async function loadListing(id: string) {
  ensureWatcher();
  await expireOverdueOrders();
  return getListing(id);
}
