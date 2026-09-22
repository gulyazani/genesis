import { revalidatePath } from "next/cache";

export function bustCatalogCaches(listingId?: string) {
  try {
    revalidatePath("/");
    revalidatePath("/stock");
    if (listingId) {
      revalidatePath(`/listings/${listingId}`);
      revalidatePath(`/checkout/${listingId}`);
    }
  } catch {
    /* watcher / bot dışında Next cache yok */
  }
}
