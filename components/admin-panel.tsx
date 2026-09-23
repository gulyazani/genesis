"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatUsdt, orderStatusLabel, statusLabel } from "@/lib/format";
import type { AdminListingRow, DeliveryMethod, ListingType, Order } from "@/lib/types";

const METHODS: { id: DeliveryMethod; label: string; hint: string }[] = [
  {
    id: "cpanel",
    label: "cPanel",
    hint: "Panel adresi, kullanıcı ve şifre. Satış olunca alıcıya gider.",
  },
  {
    id: "wordpress",
    label: "WordPress",
    hint: "wp-admin adresi, kullanıcı ve şifre. Satış olunca alıcıya gider.",
  },
  {
    id: "link",
    label: "Tek link",
    hint: "Tek URL. Satış olunca bu link Telegram’dan gider.",
  },
];

function methodName(method: DeliveryMethod) {
  if (method === "cpanel") return "cPanel";
  if (method === "wordpress") return "WordPress";
  return "Link";
}

export function AdminPanel() {
  const router = useRouter();
  const [rows, setRows] = useState<AdminListingRow[] | null>(null);
  const [topups, setTopups] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [price, setPrice] = useState("100");
  const [authorityScore, setAuthorityScore] = useState("");
  const [type, setType] = useState<ListingType>("domain");
  const [method, setMethod] = useState<DeliveryMethod>("cpanel");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/listings");
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    const data = (await res.json()) as { listings?: AdminListingRow[]; error?: string };
    if (!res.ok) {
      setError(data.error ?? "Liste alınamadı.");
      setRows([]);
      return;
    }
    setRows(data.listings ?? []);
    const top = await fetch("/api/admin/topups");
    if (top.ok) {
      const payload = (await top.json()) as { topups?: Order[] };
      setTopups(payload.topups ?? []);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function addListing(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setFormError(null);
    try {
      const res = await fetch("/api/admin/listings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          url,
          price: Number(price.replace(",", ".")),
          authorityScore: Number(authorityScore.replace(",", ".")),
          type,
          method,
          username,
          password,
          loginUrl: method === "link" ? loginUrl || url : loginUrl,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setFormError(data.error ?? "Eklenemedi.");
        setSaving(false);
        return;
      }
      setTitle("");
      setUrl("");
      setAuthorityScore("");
      setUsername("");
      setPassword("");
      setLoginUrl("");
      await load();
      setSaving(false);
    } catch {
      setFormError("Sunucuya ulaşılamadı.");
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Bu ilanı silmek istiyor musun?")) return;
    const res = await fetch(`/api/admin/listings/${id}`, { method: "DELETE" });
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "Silinemedi.");
      return;
    }
    await load();
  }

  async function actTopup(id: string, action: "paid" | "expire") {
    setActing(id);
    const res = await fetch(`/api/admin/topups/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setActing(null);
    if (res.status === 401) {
      router.replace("/admin/login");
      return;
    }
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      setError(data.error ?? "İşlem olmadı.");
      return;
    }
    await load();
  }

  function canDecide(status: Order["status"]) {
    return (
      status === "pending" ||
      status === "awaiting_admin" ||
      status === "underpaid"
    );
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-white/35">SUPERSHELL</p>
          <h1 className="text-2xl font-semibold">Admin panel</h1>
        </div>
        <Button variant="secondary" className="rounded-full" onClick={logout}>
          Çıkış
        </Button>
      </div>

      <section className="space-y-3 rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
        <div>
          <p className="text-[11px] tracking-[0.16em] text-white/35">YATIRIMLAR</p>
          <p className="mt-1 text-sm text-white/45">
            USDT gelince Onayla — bakiye yazılır. Telegram’da da{" "}
            <code className="text-white/70">/accept ord_...</code> çalışır.
          </p>
        </div>
        {topups === null ? (
          <p className="text-sm text-white/45">Yükleniyor…</p>
        ) : topups.length === 0 ? (
          <p className="text-sm text-white/45">Bekleyen yükleme yok.</p>
        ) : (
          <ul className="space-y-3">
            {topups.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="font-medium">{formatUsdt(item.amount)}</p>
                  <p className="mt-1 break-all text-sm text-white/45">
                    {orderStatusLabel(item.status)} · {item.telegramName || item.telegramUserId}
                  </p>
                  <p className="mt-1 break-all font-mono text-[11px] text-white/35">
                    {item.id}
                    {item.matchedTxId ? ` · TX ${item.matchedTxId}` : ""}
                  </p>
                </div>
                {canDecide(item.status) ? (
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="rounded-full"
                      disabled={acting === item.id}
                      onClick={() => void actTopup(item.id, "paid")}
                    >
                      Onayla
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      className="rounded-full"
                      disabled={acting === item.id}
                      onClick={() => void actTopup(item.id, "expire")}
                    >
                      Reddet
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        onSubmit={addListing}
        className="space-y-4 rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
      >
        <p className="text-[11px] tracking-[0.16em] text-white/35">İLAN EKLE</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs text-white/45">Domain / site</label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="ornek.com"
              className="h-11 rounded-xl border-white/8 bg-black/30"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-white/45">Fiyat (USDT)</label>
            <Input
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              inputMode="decimal"
              className="h-11 rounded-xl border-white/8 bg-black/30"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-white/45">
              Authority score (0–100)
            </label>
            <Input
              value={authorityScore}
              onChange={(event) => setAuthorityScore(event.target.value)}
              inputMode="numeric"
              placeholder="42"
              className="h-11 rounded-xl border-white/8 bg-black/30"
              required
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs text-white/45">Tür</label>
            <select
              value={type}
              onChange={(event) => setType(event.target.value as ListingType)}
              className="h-11 w-full rounded-xl border border-white/8 bg-black/30 px-3 text-sm"
            >
              <option value="domain">Domain</option>
              <option value="website">Site</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs text-white/45">Site adresi</label>
            <Input
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://ornek.com"
              className="h-11 rounded-xl border-white/8 bg-black/30"
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs text-white/45">Teslim yöntemi</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {METHODS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setMethod(item.id)}
                className={`rounded-2xl px-3 py-3 text-left text-sm ring-1 ${
                  method === item.id
                    ? "bg-white/10 text-white ring-white/20"
                    : "bg-black/20 text-white/60 ring-white/8"
                }`}
              >
                <span className="font-medium">{item.label}</span>
                <span className="mt-1 block text-[11px] leading-snug text-white/40">
                  {item.hint}
                </span>
              </button>
            ))}
          </div>
        </div>

        {method === "link" ? (
          <div>
            <label className="mb-1.5 block text-xs text-white/45">Teslimat linki</label>
            <Input
              value={loginUrl}
              onChange={(event) => setLoginUrl(event.target.value)}
              placeholder="https://…"
              className="h-11 rounded-xl border-white/8 bg-black/30"
              required
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs text-white/45">
                {method === "cpanel" ? "cPanel adresi" : "WordPress / wp-admin"}
              </label>
              <Input
                value={loginUrl}
                onChange={(event) => setLoginUrl(event.target.value)}
                placeholder={
                  method === "cpanel"
                    ? "https://ornek.com:2083"
                    : "https://ornek.com/wp-admin"
                }
                className="h-11 rounded-xl border-white/8 bg-black/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-white/45">Kullanıcı</label>
              <Input
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="off"
                className="h-11 rounded-xl border-white/8 bg-black/30"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-white/45">Şifre</label>
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                className="h-11 rounded-xl border-white/8 bg-black/30"
                required
              />
            </div>
          </div>
        )}

        {formError ? <p className="text-sm text-red-300">{formError}</p> : null}
        <Button type="submit" className="h-11 rounded-full" disabled={saving}>
          {saving ? "Ekleniyor…" : "İlanı kaydet"}
        </Button>
      </form>

      <section className="rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
        <p className="text-[11px] tracking-[0.16em] text-white/35">İLANLAR</p>
        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
        {rows === null ? (
          <p className="mt-4 text-sm text-white/45">Yükleniyor…</p>
        ) : rows.length === 0 ? (
          <p className="mt-4 text-sm text-white/45">Henüz ilan yok. Yukarıdan ekle.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {rows.map((item) => (
              <li
                key={item.id}
                className="flex flex-col gap-3 rounded-2xl bg-black/25 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{item.title}</p>
                  <p className="mt-1 text-sm text-white/45">
                    {formatUsdt(item.price)} · AS{" "}
                    {item.authorityScore ?? "—"} · {statusLabel(item.status)} ·{" "}
                    {item.delivery ? methodName(item.delivery.method) : "teslimat yok"}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  className="rounded-full"
                  onClick={() => void remove(item.id)}
                >
                  Sil
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
