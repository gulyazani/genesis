import fs from "node:fs/promises";
import path from "node:path";
import { getServerConfig } from "@/lib/config";
import type { Listing, Order, UsersMap } from "@/lib/types";

type StoreFile = "listings" | "orders" | "users";

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function filePath(name: StoreFile) {
  return path.join(getServerConfig().dataDir, `${name}.json`);
}

async function readJson<T>(name: StoreFile, fallback: T): Promise<T> {
  const p = filePath(name);
  try {
    const raw = await fs.readFile(p, "utf8");
    return JSON.parse(raw) as T;
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, `${JSON.stringify(fallback, null, 2)}\n`);
      return fallback;
    }
    throw error;
  }
}

async function writeJson<T>(name: StoreFile, data: T) {
  const p = filePath(name);
  await fs.mkdir(path.dirname(p), { recursive: true });
  const tmp = `${p}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
  await fs.rename(tmp, p);
}

export function readListings() {
  return enqueue(() => readJson<Listing[]>("listings", []));
}

export function readOrders() {
  return enqueue(() => readJson<Order[]>("orders", []));
}

export function readUsers() {
  return enqueue(() => readJson<UsersMap>("users", {}));
}

export function mutateStore<T>(
  fn: (state: {
    listings: Listing[];
    orders: Order[];
    users: UsersMap;
  }) => Promise<T> | T,
) {
  return enqueue(async () => {
    const listings = await readJson<Listing[]>("listings", []);
    const orders = await readJson<Order[]>("orders", []);
    const users = await readJson<UsersMap>("users", {});
    const result = await fn({ listings, orders, users });
    await writeJson("listings", listings);
    await writeJson("orders", orders);
    await writeJson("users", users);
    return result;
  });
}
