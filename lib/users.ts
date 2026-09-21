import { addUsdt } from "@/lib/money";
import { mutateStore, readUsers } from "@/lib/store";
import type { UserRecord, UsersMap } from "@/lib/types";

export function ensureUserRecord(users: UsersMap, telegramUserId: string) {
  const id = String(telegramUserId);
  const existing = users[id];
  if (existing) return existing;
  const now = new Date().toISOString();
  const created: UserRecord = {
    telegramUserId: id,
    balanceUsdt: 0,
    createdAt: now,
    updatedAt: now,
  };
  users[id] = created;
  return created;
}

export function creditUser(users: UsersMap, telegramUserId: string, amount: number) {
  const user = ensureUserRecord(users, telegramUserId);
  user.balanceUsdt = addUsdt(user.balanceUsdt, amount);
  user.updatedAt = new Date().toISOString();
  return user;
}

export async function getOrCreateUser(telegramUserId: string) {
  return mutateStore(({ users }) => ({ ...ensureUserRecord(users, telegramUserId) }));
}

export async function getUserBalance(telegramUserId: string) {
  const users = await readUsers();
  return users[String(telegramUserId)]?.balanceUsdt ?? 0;
}
