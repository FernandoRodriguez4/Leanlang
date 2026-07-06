"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

function initials(email: string | null): string {
  if (!email) return "··";
  const name = email.split("@")[0];
  const parts = name.split(/[.\-_]/).filter(Boolean);
  const chars = parts.length >= 2 ? parts[0][0] + parts[1][0] : name.slice(0, 2);
  return chars.toUpperCase();
}

export function UserMenu() {
  const { email, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onEsc);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onEsc); };
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Menú de usuario"
        className="flex items-center gap-2 rounded-xl border border-line bg-surface py-1 pl-1 pr-2 shadow-sm transition hover:border-blueprint-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint-500"
      >
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-blueprint-600 text-[11px] font-bold text-white">
          {initials(email)}
        </span>
        <span className="hidden max-w-[12ch] truncate text-sm font-medium text-ink/80 sm:inline">{email ?? "cuenta"}</span>
        <span aria-hidden className={`text-ink/40 transition ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-60 origin-top-right animate-fade-in rounded-2xl border border-line bg-surface p-1.5 shadow-lift">
          <div className="border-b border-line px-3 py-2.5">
            <p className="text-xs text-ink/50">Sesión iniciada como</p>
            <p className="truncate text-sm font-medium text-ink">{email ?? "—"}</p>
          </div>
          <nav className="py-1.5">
            <MenuLink href="/dashboard" onClick={() => setOpen(false)} icon="M3 7l9-4 9 4-9 4-9-4Zm0 5 9 4 9-4M3 17l9 4 9-4">Mis proyectos</MenuLink>
            <MenuLink href="/projects/new" onClick={() => setOpen(false)} icon="M12 5v14M5 12h14">Nuevo proyecto</MenuLink>
          </nav>
          <div className="border-t border-line pt-1.5">
            <button
              role="menuitem"
              onClick={() => { logout(); router.replace("/login"); }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-desire transition hover:bg-desire-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint-500"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, onClick, icon, children }: { href: string; onClick: () => void; icon: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-ink/80 transition hover:bg-paper hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint-500"
    >
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d={icon} />
      </svg>
      {children}
    </Link>
  );
}
