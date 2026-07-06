"use client";

import { useEffect } from "react";

interface ToastProps {
  message: string;
  variant?: "success" | "error";
  duration?: number;
  onClose: () => void;
}

/** Notificación transitoria (auto-descarta), reutilizable en cualquier página. */
export function Toast({ message, variant = "success", duration = 3500, onClose }: ToastProps) {
  useEffect(() => {
    const t = setTimeout(onClose, duration);
    return () => clearTimeout(t);
  }, [onClose, duration]);

  const isError = variant === "error";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-fade-in rounded-xl border px-4 py-3 text-sm font-medium shadow-lift ${
        isError ? "border-danger/30 bg-danger-soft text-danger-ink" : "border-ok/30 bg-ok-soft text-ok-ink"
      }`}
    >
      {message}
    </div>
  );
}
