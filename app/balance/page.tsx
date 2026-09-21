import { Suspense } from "react";
import { BalancePage } from "@/components/balance-page";

export default function BalanceRoute() {
  return (
    <Suspense
      fallback={
        <div className="px-4 py-10 text-center text-sm text-white/45">
          Bakiye yükleniyor…
        </div>
      }
    >
      <BalancePage />
    </Suspense>
  );
}
