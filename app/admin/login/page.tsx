import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";
import { adminPasswordSet, isAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage() {
  if (await isAdminSession()) redirect("/admin");
  return (
    <div className="mx-auto max-w-md pt-10">
      <p className="text-[11px] tracking-[0.16em] text-white/35">SUPERSHELL</p>
      <h1 className="mt-2 text-2xl font-semibold">Admin giriş</h1>
      <p className="mt-2 text-sm text-white/50">
        İlan ekle / sil. Satış olunca kayıtlı cPanel, WordPress veya link
        alıcıya Telegram’dan gider.
      </p>
      {!adminPasswordSet() ? (
        <p className="mt-6 rounded-2xl bg-amber-500/10 p-4 text-sm text-amber-50">
          VPS `.env` içine `ADMIN_USER` ve `ADMIN_PASSWORD` yaz, container’ı
          yeniden başlat.
        </p>
      ) : (
        <div className="mt-6 rounded-[22px] bg-[#12121a] p-5 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
          <AdminLoginForm />
        </div>
      )}
    </div>
  );
}
