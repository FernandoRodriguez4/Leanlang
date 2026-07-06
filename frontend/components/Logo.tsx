import Link from "next/link";
import { BrandMark } from "./BrandMark";

/** Marca: isotipo de compás/plano + wordmark técnico. */
export function Logo({ small = false, href = "/", invert = false }: { small?: boolean; href?: string; invert?: boolean }) {
  return (
    <Link
      href={href}
      aria-label="Validation Blueprint — inicio"
      className="group inline-flex items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blueprint-500 focus-visible:ring-offset-2"
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-[10px] shadow-sm ${
          invert ? "bg-white/10 text-white ring-1 ring-white/20" : "bg-blueprint-600 text-white"
        }`}
      >
        <BrandMark />
      </span>
      {!small && (
        <span className={`font-display text-[15px] font-bold tracking-tight ${invert ? "text-white" : "text-ink"}`}>
          Validation<span className={invert ? "text-blueprint-400" : "text-blueprint-600"}>Blueprint</span>
        </span>
      )}
    </Link>
  );
}
