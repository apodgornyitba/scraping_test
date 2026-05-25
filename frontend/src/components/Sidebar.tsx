'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface TaxpayerSummary {
  cuit: string;
  nombre: string;
  usuario: string;
  regimen: string;
  actividad: string;
  riesgo_fiscal: string;
  score_cumplimiento: number;
  embargos_activos: number;
  capital: number;
  resarcitorio: number;
  punitorio: number;
  total: number;
  cant_obligaciones: number;
}

interface SidebarProps {
  taxpayers: TaxpayerSummary[];
  latestCorte: string | null;
}

export default function Sidebar({ taxpayers, latestCorte }: SidebarProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const pathname = usePathname();

  const filteredTaxpayers = taxpayers.filter((t) =>
    t.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.cuit.includes(searchTerm) ||
    t.usuario.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const getRiskBadgeClass = (risk: string) => {
    switch (risk.toLowerCase()) {
      case 'bajo':
        return 'badge-success';
      case 'medio':
        return 'badge-warning';
      case 'alto':
      default:
        return 'badge-danger';
    }
  };

  return (
    <aside className="glass-panel flex flex-col h-[calc(100vh-2rem)] sticky top-4 p-5 overflow-hidden transition-all duration-300">
      {/* Brand Header */}
      <div className="flex flex-col gap-1 pb-4 mb-4 border-b border-[rgba(255,255,255,0.06)]">
        <Link href="/" className="flex items-center gap-2 group decoration-none">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00f2fe] to-[#9d4edd] flex items-center justify-center shadow-[0_0_15px_rgba(0,242,254,0.3)] group-hover:scale-105 transition-transform">
            <span className="font-bold text-black text-sm">A</span>
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight text-white m-0 flex items-center gap-1.5">
              ARCA <span className="glow-text-cyan text-sm px-1.5 py-0.5 rounded bg-[rgba(0,242,254,0.1)] border border-[rgba(0,242,254,0.2)]">DEUDAS</span>
            </h2>
            <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold m-0">Portal de Monitoreo</p>
          </div>
        </Link>
      </div>

      {/* Search Taxpayer */}
      <div className="mb-4 relative">
        <input
          type="text"
          placeholder="Buscar CUIT, Nombre o Usuario..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[rgba(15,22,42,0.6)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-2.5 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-cyan)] focus:shadow-[0_0_12px_rgba(0,242,254,0.15)] transition-all duration-300"
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-2.5 text-[var(--text-muted)] hover:text-white bg-transparent border-none cursor-pointer text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {/* Stats Mini Banner */}
      <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl p-3 mb-4 flex justify-between items-center text-xs">
        <div>
          <span className="text-[var(--text-muted)] block font-medium">Último Corte</span>
          <span className="text-[var(--accent-cyan)] font-semibold uppercase">{latestCorte || 'S/D'}</span>
        </div>
        <div className="text-right">
          <span className="text-[var(--text-muted)] block font-medium">Contribuyentes</span>
          <span className="text-white font-semibold">{filteredTaxpayers.length} / {taxpayers.length}</span>
        </div>
      </div>

      {/* Taxpayers list scrollable area */}
      <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 custom-scrollbar">
        {filteredTaxpayers.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-muted)] text-sm">
            No se encontraron contribuyentes
          </div>
        ) : (
          filteredTaxpayers.map((t) => {
            const isActive = pathname === `/contribuyente/${t.cuit}`;
            return (
              <Link
                key={t.cuit}
                href={`/contribuyente/${t.cuit}`}
                className={`flex flex-col gap-2 p-3.5 rounded-xl border transition-all duration-300 decoration-none relative overflow-hidden group ${
                  isActive
                    ? 'bg-[rgba(0,242,254,0.08)] border-[var(--accent-cyan)] shadow-[0_0_15px_rgba(0,242,254,0.1)]'
                    : 'bg-[rgba(15,22,42,0.2)] border-[rgba(255,255,255,0.04)] hover:bg-[rgba(23,33,61,0.45)] hover:border-[rgba(255,255,255,0.12)]'
                }`}
              >
                {/* Visual hover border glow accent */}
                <div className={`absolute left-0 top-0 bottom-0 w-1 transition-all duration-300 ${
                  isActive ? 'bg-[var(--accent-cyan)] shadow-[0_0_8px_var(--accent-cyan)]' : 'bg-transparent group-hover:bg-[rgba(255,255,255,0.2)]'
                }`} />

                <div className="flex justify-between items-start pl-1">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white tracking-tight group-hover:text-[var(--accent-cyan)] transition-colors line-clamp-1">
                      {t.nombre}
                    </span>
                    <span className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
                      CUIT: {t.cuit}
                    </span>
                  </div>
                  <span className={`badge text-[9px] px-2 py-0.5 font-bold uppercase tracking-wider ${
                    t.regimen.toLowerCase().includes('monotributo') ? 'badge-success' : 'badge-info'
                  }`}>
                    {t.regimen.toLowerCase().includes('monotributo') ? 'Mono' : 'RI'}
                  </span>
                </div>

                <div className="flex justify-between items-center pl-1 pt-1.5 border-t border-[rgba(255,255,255,0.04)] text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${t.total > 0 ? 'bg-[var(--accent-red)] animate-pulse' : 'bg-[var(--accent-green)]'}`} />
                    <span className={`font-mono font-bold ${t.total > 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>
                      {t.total > 0 ? formatCurrency(t.total) : 'Sin Deuda'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-[var(--text-muted)]">Riesgo</span>
                    <span className={`badge text-[9px] px-1.5 py-0.2 font-bold uppercase ${getRiskBadgeClass(t.riesgo_fiscal)}`}>
                      {t.riesgo_fiscal}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 242, 254, 0.3);
        }
      `}</style>
    </aside>
  );
}
