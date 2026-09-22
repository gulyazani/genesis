export type ListingType = "domain" | "website";
export type ListingStatus = "available" | "reserved" | "sold";
export type ListingTier = "ust" | "orta" | "eko";

export type Listing = {
  id: string;
  type: ListingType;
  title: string;
  url?: string;
  price: number;
  currency: "USD";
  status: ListingStatus;
  tier: ListingTier;
  summary: string;
  description: string;
  highlights?: string[];
  registrar?: string;
  expiresAt?: string;
  registeredAt?: string;
  deliveryNote?: string;
  pageCount?: number;
};

export type OrderStatus =
  | "pending"
  | "awaiting_admin"
  | "paid"
  | "underpaid"
  | "expired"
  | "rejected";

export type OrderKind = "listing" | "topup";

export type Order = {
  id: string;
  kind: OrderKind;
  listingId: string;
  telegramUserId: string;
  telegramName?: string;
  amount: number;
  asset: string;
  network: string;
  walletAddress: string;
  txHashHint?: string;
  matchedTxId?: string;
  receivedAmount?: number;
  status: OrderStatus;
  note?: string;
  deliveredAt?: string;
  createdAt: string;
  expiresAt: string;
};

export type UserRecord = {
  telegramUserId: string;
  balanceUsdt: number;
  createdAt: string;
  updatedAt: string;
};

export type UsersMap = Record<string, UserRecord>;

export type IncomingTx = {
  id: string;
  to: string;
  amount: number;
  asset: string;
  network: string;
  timestamp: number;
};

export type TelegramUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

export type SessionMode = "telegram" | "demo" | "blocked";

export type PublicConfig = {
  wallet: string;
  walletConfigured: boolean;
  asset: string;
  network: string;
  watchWindowMin: number;
  watcherMock: boolean;
  devBypass: boolean;
};

export type Session = {
  user: TelegramUser;
  mode: SessionMode;
  config: PublicConfig;
  balanceUsdt: number;
};
