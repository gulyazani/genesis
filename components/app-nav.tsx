"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardList, Globe, ListChecks, Wallet } from "lucide-react";

const ITEMS = [
  { href: "/", label: "Domainler", icon: Globe },
  { href: "/stock", label: "Satışa hazır", icon: ListChecks },
  { href: "/orders", label: "Siparişlerim", icon: ClipboardList },
  { href: "/balance", label: "Bakiye yükle", icon: Wallet },
] as const;

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky bottom-0 z-20 -mx-4 mt-8 border-t border-white/8 bg-[#07070b]/95 px-2 py-2 backdrop-blur sm:-mx-5">
      <ul className="grid grid-cols-4 gap-1">
        {ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium ${
                  active ? "bg-white/8 text-white" : "text-white/45"
                }`}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
