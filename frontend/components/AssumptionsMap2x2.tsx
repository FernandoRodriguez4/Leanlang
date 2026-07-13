"use client";

import { useRef, useState } from "react";
import type { Prioritization } from "@/lib/types";

const W = 440, H = 380, pad = 38;
const x = (e: number) => pad + e * (W - 2 * pad);
const y = (imp: number) => H - pad - imp * (H - 2 * pad);
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// Mapa 2x2: X = evidencia (izq sin → der con), Y = importancia (abajo → arriba).
export function AssumptionsMap2x2({
  items,
  editable = false,
  onMove,
}: {
  items: Prioritization[];
  editable?: boolean;
  onMove?: (id: string, importance: number, evidence: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const halfW = (W - 2 * pad) / 2;
  const halfH = (H - 2 * pad) / 2;

  function valFromEvent(clientX: number, clientY: number) {
    const rect = svgRef.current!.getBoundingClientRect();
    const sx = ((clientX - rect.left) / rect.width) * W;
    const sy = ((clientY - rect.top) / rect.height) * H;
    return {
      evidence: clamp01((sx - pad) / (W - 2 * pad)),
      importance: clamp01(1 - (sy - pad) / (H - 2 * pad)),
    };
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragId || !onMove) return;
    const { importance, evidence } = valFromEvent(e.clientX, e.clientY);
    onMove(dragId, importance, evidence);
  }

  function nudge(p: Prioritization, di: number, de: number) {
    onMove?.(p.hypothesis_id, clamp01(p.importance + di), clamp01(p.evidence + de));
  }

  return (
    <div className="card p-5">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-display font-bold uppercase text-ink">Mapa de supuestos</h3>
        <span className="annot font-bold text-ink/70">importancia × evidencia</span>
      </div>
      <p className="mb-4 text-sm text-ink/60">
        {editable
          ? "Arrastra los puntos (o usa las flechas del teclado) para ajustar la priorización."
          : "Lo importante y sin evidencia (en ámbar) se prueba primero."}
      </p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        className={`mx-auto h-auto w-full max-w-md touch-none ${editable ? "select-none" : ""}`}
        role="img"
        aria-label="Mapa de supuestos 2x2"
        onPointerMove={onPointerMove}
        onPointerUp={() => setDragId(null)}
        onPointerLeave={() => setDragId(null)}
      >
        <defs>
          <pattern id="grid2x2" width="22" height="22" patternUnits="userSpaceOnUse">
            <path d="M22 0H0V22" fill="none" stroke="#c7cdd4" strokeWidth="0.6" opacity="0.7" />
          </pattern>
        </defs>
        <rect x={pad} y={pad} width={W - 2 * pad} height={H - 2 * pad} fill="url(#grid2x2)" />
        <rect x={pad} y={pad} width={halfW} height={halfH} fill="#c9973f" opacity={0.16} stroke="#c9973f" strokeWidth={1} strokeOpacity={0.5} strokeDasharray="4 3" />
        <rect x={pad + 6} y={pad + 6} width={104} height={18} rx={4} fill="#c9973f" />
        <text x={pad + 12} y={pad + 18.5} fontSize={10.5} fontWeight={700} fill="#ffffff" fontFamily="var(--font-mono)" letterSpacing="0.3">PROBAR PRIMERO</text>

        <line x1={W / 2} y1={pad} x2={W / 2} y2={H - pad} stroke="#9aa4b0" strokeWidth={1.5} />
        <line x1={pad} y1={H / 2} x2={W - pad} y2={H / 2} stroke="#9aa4b0" strokeWidth={1.5} />
        <rect x={pad} y={pad} width={W - 2 * pad} height={H - 2 * pad} fill="none" stroke="#9aa4b0" strokeWidth={1.5} />

        <text x={pad} y={H - 14} fontSize={11} fontWeight={600} fill="#111111" opacity={0.7} fontFamily="var(--font-mono)">sin evidencia</text>
        <text x={W - pad} y={H - 14} fontSize={11} fontWeight={600} fill="#111111" opacity={0.7} textAnchor="end" fontFamily="var(--font-mono)">con evidencia</text>
        <text x={pad - 8} y={pad + 2} fontSize={11} fontWeight={600} fill="#111111" opacity={0.7} transform={`rotate(-90 ${pad - 8} ${pad + 2})`} textAnchor="end" fontFamily="var(--font-mono)">muy importante</text>
        <text x={pad - 8} y={H - pad} fontSize={11} fontWeight={600} fill="#111111" opacity={0.7} transform={`rotate(-90 ${pad - 8} ${H - pad})`} fontFamily="var(--font-mono)">poco importante</text>

        {items.map((p) => {
          const cx = x(p.evidence), cy = y(p.importance);
          return (
            <g
              key={p.hypothesis_id}
              className={editable ? "cursor-grab focus:outline-none" : ""}
              tabIndex={editable ? 0 : -1}
              role={editable ? "slider" : undefined}
              aria-label={editable ? `${p.hypothesis_id}: importancia ${p.importance.toFixed(2)}, evidencia ${p.evidence.toFixed(2)}` : undefined}
              onPointerDown={editable ? (e) => { (e.target as Element).setPointerCapture?.(e.pointerId); setDragId(p.hypothesis_id); } : undefined}
              onKeyDown={
                editable
                  ? (e) => {
                      const S = 0.04;
                      if (e.key === "ArrowUp") { e.preventDefault(); nudge(p, S, 0); }
                      else if (e.key === "ArrowDown") { e.preventDefault(); nudge(p, -S, 0); }
                      else if (e.key === "ArrowRight") { e.preventDefault(); nudge(p, 0, S); }
                      else if (e.key === "ArrowLeft") { e.preventDefault(); nudge(p, 0, -S); }
                    }
                  : undefined
              }
            >
              {editable && dragId === p.hypothesis_id && (
                <circle cx={cx} cy={cy} r={20} fill="#0f8a5f" opacity={0.12} />
              )}
              <circle cx={cx} cy={cy} r={14} fill={p.is_riskiest ? "#c9973f" : "#0e8fa8"} stroke="#fff" strokeWidth={3} />
              <text x={cx} y={cy + 3.5} fontSize={10} fontWeight={700} fill="#fff" textAnchor="middle" fontFamily="var(--font-mono)" pointerEvents="none">
                {p.hypothesis_id}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="mt-3 flex items-center justify-center gap-5 border-t border-line pt-3 text-xs">
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink/80"><span className="h-2.5 w-2.5 rounded-full bg-accent-500" /> probar primero</span>
        <span className="inline-flex items-center gap-1.5 font-semibold text-ink/80"><span className="h-2.5 w-2.5 rounded-full bg-feas" /> resto</span>
      </div>
    </div>
  );
}
