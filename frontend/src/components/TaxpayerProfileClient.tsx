'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';

export interface Taxpayer {
  cuit: string;
  usuario: string;
  nombre: string;
  actividad: string;
  regimen: string;
  forma_juridica?: string;
  agencia?: string;
  email?: string;
  domicilio?: string;
  riesgo_fiscal: string;
  score_cumplimiento: number;
  embargos_activos: number;
  mesa_fiscalizacion?: string;
}

export interface ActiveDebt {
  id: number;
  periodo: string;
  concepto: string;
  vencimiento: string;
  capital: number;
  interes_resarcitorio: number;
  interes_punitorio: number;
  total: number;
  estado: string;
  expediente: string;
}

export interface EvolutionPoint {
  corte: string;
  capital: number;
  resarcitorio: number;
  punitorio: number;
  total: number;
  cant_obligaciones: number;
}

export interface HistoryItem {
  periodo: string;
  concepto: string;
  vencimiento: string;
  corte: string;
  capital: number;
  interes_resarcitorio: number;
  interes_punitorio: number;
  total: number;
  estado: string;
  expediente: string;
}

interface TaxpayerProfileClientProps {
  taxpayer: Taxpayer;
  activeDebts: ActiveDebt[];
  evolution: EvolutionPoint[];
  history: HistoryItem[];
  latestCorte: string | null;
}

export default function TaxpayerProfileClient({
  taxpayer,
  activeDebts,
  evolution,
  history,
  latestCorte,
}: TaxpayerProfileClientProps) {
  const [activeTab, setActiveTab] = useState<'debts' | 'evolution' | 'history'>('debts');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('period-desc');

  // Formato de moneda
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Totales en el corte actual
  const currentTotalStats = useMemo(() => {
    return activeDebts.reduce(
      (acc, d) => {
        acc.capital += d.capital;
        acc.resarcitorio += d.interes_resarcitorio;
        acc.punitorio += d.interes_punitorio;
        acc.total += d.total;
        return acc;
      },
      { capital: 0, resarcitorio: 0, punitorio: 0, total: 0 }
    );
  }, [activeDebts]);

  // Generar lista de 30 meses programáticamente (Ene 2023 a Jun 2025)
  const monthCells = useMemo(() => {
    const list: string[] = [];
    const startY = 2023, startM = 1, endY = 2025, endM = 6;
    let y = startY, m = startM;
    while (y < endY || (y === endY && m <= endM)) {
      list.push(`${y}-${String(m).padStart(2, '0')}`);
      m++;
      if (m > 12) {
        m = 1;
        y++;
      }
    }
    return list;
  }, []);

  // Agrupar deudas activas por periodo (para el Heatmap)
  const debtsByPeriodMap = useMemo(() => {
    const map = new Map<string, { total: number; count: number }>();
    activeDebts.forEach((d) => {
      const p = d.periodo; // formato 'YYYY-MM'
      const existing = map.get(p) || { total: 0, count: 0 };
      if (d.total > 0) {
        map.set(p, {
          total: existing.total + d.total,
          count: existing.count + 1,
        });
      }
    });
    return map;
  }, [activeDebts]);

  // Filtrado y ordenamiento de Deudas Activas
  const filteredDebts = useMemo(() => {
    let result = [...activeDebts];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (d) =>
          d.concepto.toLowerCase().includes(q) ||
          d.periodo.includes(q) ||
          d.estado.toLowerCase().includes(q) ||
          d.expediente.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== 'ALL') {
      result = result.filter((d) => d.estado === statusFilter);
    }

    // Ordenar
    result.sort((a, b) => {
      if (sortBy === 'period-desc') return b.periodo.localeCompare(a.periodo);
      if (sortBy === 'period-asc') return a.periodo.localeCompare(b.periodo);
      if (sortBy === 'debt-desc') return b.total - a.total;
      if (sortBy === 'debt-asc') return a.total - b.total;
      if (sortBy === 'capital-desc') return b.capital - a.capital;
      return 0;
    });

    return result;
  }, [activeDebts, searchTerm, statusFilter, sortBy]);

  // Filtrado de Historial Completo
  const filteredHistory = useMemo(() => {
    let result = [...history];

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      result = result.filter(
        (h) =>
          h.concepto.toLowerCase().includes(q) ||
          h.periodo.includes(q) ||
          h.corte.includes(q) ||
          h.estado.toLowerCase().includes(q)
      );
    }

    return result;
  }, [history, searchTerm]);

  // Coordenadas del gráfico de tendencia del contribuyente
  const chartWidth = 900;
  const chartHeight = 220;
  const paddingX = 50;
  const paddingY = 25;

  const maxTotal = Math.max(...evolution.map((e) => e.total), 50000);
  const chartPoints = evolution.map((item, index) => {
    const x = paddingX + (index / (evolution.length - 1 || 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - (item.total / maxTotal) * (chartHeight - paddingY * 2);
    return { x, y, ...item };
  });

  const linePath = chartPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = chartPoints.length > 0 
    ? `${linePath} L ${chartPoints[chartPoints.length - 1].x} ${chartHeight - paddingY} L ${chartPoints[0].x} ${chartHeight - paddingY} Z`
    : '';

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s.includes('SIN DEUDA')) return 'badge-success';
    if (s.includes('IMPAGO')) return 'badge-danger';
    if (s.includes('CON DEUDA')) return 'badge-warning';
    return 'badge-info';
  };

  const getScoreColorClass = (score: number) => {
    if (score >= 80) return 'text-[var(--accent-green)]';
    if (score >= 60) return 'text-[var(--accent-orange)]';
    return 'text-[var(--accent-red)]';
  };

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Detail Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link 
            href="/" 
            className="btn-primary py-2 px-3 text-xs rounded-xl flex items-center justify-center font-bold"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: 'white' }}
          >
            ← Volver
          </Link>
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight m-0 uppercase flex items-center gap-2">
              {taxpayer.nombre}
            </h1>
            <p className="text-xs text-[var(--text-muted)] m-0 mt-0.5 font-mono">
              CUIT: {taxpayer.cuit} | Usuario: {taxpayer.usuario}
            </p>
          </div>
        </div>
        <span className={`badge py-1.5 px-3.5 text-xs font-extrabold uppercase tracking-wider ${
          taxpayer.regimen.toLowerCase().includes('monotributo') ? 'badge-success' : 'badge-info'
        }`}>
          {taxpayer.regimen}
        </span>
      </div>

      {/* Mini Profile Info & KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        {/* Total Owed Card */}
        <div className="glass-panel p-5 relative overflow-hidden group col-span-1">
          <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider block">Deuda Total al {latestCorte}</span>
          <span className="text-3xl font-black text-white block mt-2 tracking-tight group-hover:text-[var(--accent-red)] transition-colors">
            {formatCurrency(currentTotalStats.total)}
          </span>
          <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-[rgba(255,255,255,0.04)] text-xs">
            <span className={`w-2 h-2 rounded-full ${currentTotalStats.total > 0 ? 'bg-[var(--accent-red)] animate-pulse' : 'bg-[var(--accent-green)]'}`} />
            <span className="text-[var(--text-muted)] font-medium">Estado General:</span>
            <span className={`font-bold ${currentTotalStats.total > 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>
              {currentTotalStats.total > 0 ? 'CON SALDO' : 'AL DÍA'}
            </span>
          </div>
        </div>

        {/* Capital vs Intereses */}
        <div className="glass-panel p-5 col-span-1 flex flex-col justify-between">
          <div className="flex justify-between items-center text-xs">
            <span className="text-[var(--text-muted)] font-bold uppercase">Capital Puro</span>
            <span className="text-white font-mono font-semibold">{formatCurrency(currentTotalStats.capital)}</span>
          </div>
          <div className="flex justify-between items-center text-xs pt-2 border-t border-[rgba(255,255,255,0.03)] mt-2">
            <span className="text-[var(--text-muted)] font-bold uppercase">Int. Resarcitorios</span>
            <span className="text-white font-mono font-semibold">{formatCurrency(currentTotalStats.resarcitorio)}</span>
          </div>
          <div className="flex justify-between items-center text-xs pt-2 border-t border-[rgba(255,255,255,0.03)] mt-2">
            <span className="text-[var(--text-muted)] font-bold uppercase">Int. Punitorios</span>
            <span className="text-white font-mono font-semibold">{formatCurrency(currentTotalStats.punitorio)}</span>
          </div>
        </div>

        {/* Taxpayer Compliance Score */}
        <div className="glass-panel p-5 col-span-1 flex items-center justify-between gap-3">
          <div className="flex flex-col">
            <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider">Score Compliance</span>
            <span className="text-xs text-[var(--text-muted)] mt-1.5 leading-normal">Evaluación algorítmica de conducta tributaria general.</span>
          </div>
          <div className="flex items-center justify-center w-16 h-16 rounded-full border-4 border-[rgba(255,255,255,0.04)] relative">
            <span className={`text-lg font-black font-mono ${getScoreColorClass(taxpayer.score_cumplimiento)}`}>
              {taxpayer.score_cumplimiento}
            </span>
          </div>
        </div>

        {/* Fiscal Risk Level */}
        <div className="glass-panel p-5 col-span-1 flex flex-col justify-between">
          <div>
            <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider block">Riesgo Fiscal / Embargos</span>
            <div className="flex justify-between items-center mt-2.5">
              <div className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${
                  taxpayer.riesgo_fiscal.toLowerCase() === 'bajo' ? 'bg-[var(--accent-green)]' : 
                  taxpayer.riesgo_fiscal.toLowerCase() === 'medio' ? 'bg-[var(--accent-orange)]' : 'bg-[var(--accent-red)]'
                }`} />
                <span className="text-sm font-black uppercase text-white">{taxpayer.riesgo_fiscal}</span>
              </div>
              <span className={`badge font-extrabold text-[10px] ${taxpayer.embargos_activos > 0 ? 'badge-danger animate-pulse' : 'badge-success'}`}>
                {taxpayer.embargos_activos} EMBARGOS
              </span>
            </div>
          </div>
          <div className="text-[10px] text-[var(--text-muted)] pt-2 border-t border-[rgba(255,255,255,0.04)] leading-tight">
            Mesa: {taxpayer.mesa_fiscalizacion || 'Sin Asignar'}
          </div>
        </div>
      </div>

      {/* Middle Panels: biographical details & heat map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Full Biographical Details panel */}
        <div className="glass-panel p-5 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-tight m-0 border-b border-[rgba(255,255,255,0.04)] pb-2 mb-3">
              Ficha Técnica
            </h3>
            <div className="flex flex-col gap-3 text-xs">
              <div>
                <span className="text-[var(--text-muted)] block font-semibold">Actividad Declarada</span>
                <span className="text-white block mt-0.5">{taxpayer.actividad}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block font-semibold">Agencia AFIP/ARCA</span>
                <span className="text-white block mt-0.5">{taxpayer.agencia || 'S/D'}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block font-semibold">Correo Electrónico Fiscal</span>
                <span className="text-[var(--accent-cyan)] font-mono block mt-0.5">{taxpayer.email || 'S/D'}</span>
              </div>
              <div>
                <span className="text-[var(--text-muted)] block font-semibold">Domicilio Constituido</span>
                <span className="text-white block mt-0.5 leading-normal">{taxpayer.domicilio || 'S/D'}</span>
              </div>
              {taxpayer.forma_juridica && (
                <div>
                  <span className="text-[var(--text-muted)] block font-semibold">Forma Jurídica</span>
                  <span className="text-white block mt-0.5">{taxpayer.forma_juridica}</span>
                </div>
              )}
            </div>
          </div>

          <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] rounded-xl p-3.5 text-xs text-[var(--text-muted)]">
            Cuentas con saldo activo: <strong className="text-white font-mono">{activeDebts.filter(d=>d.total>0).length}</strong> / obligaciones totales de la auditoría.
          </div>
        </div>

        {/* 30-Month Obligation Heat Calendar */}
        <div className="glass-panel p-5 lg:col-span-2 flex flex-col gap-4">
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-tight m-0">
              Matriz de Obligaciones (Calor Histórico)
            </h3>
            <p className="text-xs text-[var(--text-muted)] m-0 mt-0.5">
              Estado mensual cronológico de deudas período por período.
            </p>
          </div>

          <div className="calendar-grid mt-2">
            {monthCells.map((month) => {
              const data = debtsByPeriodMap.get(month);
              const hasDebt = data && data.total > 0;
              const [year, mNum] = month.split('-');
              const monthLabel = new Date(Number(year), Number(mNum) - 1).toLocaleDateString('es-AR', { month: 'short' });
              
              return (
                <div
                  key={month}
                  className={`calendar-cell ${hasDebt ? 'has-debt' : ''}`}
                  title={hasDebt ? `${month}: ${data.count} oblig. (${formatCurrency(data.total)})` : `${month}: Sin saldo`}
                >
                  <span className="block text-[10px] text-[var(--text-muted)] font-semibold uppercase font-mono">{monthLabel}</span>
                  <span className="block text-xs font-bold text-white font-mono mt-1">{year.substring(2)}</span>
                  {hasDebt && (
                    <span className="block w-1.5 h-1.5 rounded-full bg-[var(--accent-red)] mx-auto mt-1" />
                  )}
                </div>
              );
            })}
          </div>

          <div className="flex gap-4 mt-2 justify-end text-[10px] text-[var(--text-muted)] font-semibold">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)]" />
              <span>Sin Deuda Consolidada</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-[rgba(239,68,68,0.15)] border border-[rgba(239,68,68,0.3)]" />
              <span>Con Deuda Activa</span>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Tabs Menu */}
      <div className="flex border-b border-[rgba(255,255,255,0.06)] gap-6 text-sm">
        <button
          onClick={() => setActiveTab('debts')}
          className={`pb-2.5 font-bold uppercase tracking-wider bg-transparent border-none cursor-pointer text-xs transition-all relative ${
            activeTab === 'debts' ? 'text-[var(--accent-cyan)] font-extrabold' : 'text-[var(--text-muted)] hover:text-white'
          }`}
        >
          Deudas Activas ({activeDebts.length})
          {activeTab === 'debts' && (
            <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-[var(--accent-cyan)] shadow-[0_0_8px_var(--accent-cyan)]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('evolution')}
          className={`pb-2.5 font-bold uppercase tracking-wider bg-transparent border-none cursor-pointer text-xs transition-all relative ${
            activeTab === 'evolution' ? 'text-[var(--accent-cyan)] font-extrabold' : 'text-[var(--text-muted)] hover:text-white'
          }`}
        >
          Evolución del Contribuyente
          {activeTab === 'evolution' && (
            <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-[var(--accent-cyan)] shadow-[0_0_8px_var(--accent-cyan)]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`pb-2.5 font-bold uppercase tracking-wider bg-transparent border-none cursor-pointer text-xs transition-all relative ${
            activeTab === 'history' ? 'text-[var(--accent-cyan)] font-extrabold' : 'text-[var(--text-muted)] hover:text-white'
          }`}
        >
          Historial de Cortes ({history.length})
          {activeTab === 'history' && (
            <div className="absolute left-0 right-0 bottom-0 h-0.5 bg-[var(--accent-cyan)] shadow-[0_0_8px_var(--accent-cyan)]" />
          )}
        </button>
      </div>

      {/* Tabs Content */}
      <div className="w-full">
        {/* TAB 1: Deudas Activas */}
        {activeTab === 'debts' && (
          <div className="glass-panel p-5 flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <div className="flex gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Filtrar obligación o concepto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-[rgba(15,22,42,0.6)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-cyan)] w-full sm:w-64"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="bg-[rgba(15,22,42,0.6)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] cursor-pointer focus:outline-none"
                >
                  <option value="ALL">Todos los Estados</option>
                  <option value="IMPAGO">Impago</option>
                  <option value="CON DEUDA">Con Deuda</option>
                  <option value="SIN DEUDA">Sin Deuda</option>
                </select>
              </div>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-[rgba(15,22,42,0.6)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-xs text-[var(--text-primary)] cursor-pointer focus:outline-none w-full sm:w-auto"
              >
                <option value="period-desc">Periodo: Más Reciente</option>
                <option value="period-asc">Periodo: Más Antiguo</option>
                <option value="debt-desc">Deuda Total: Mayor</option>
                <option value="debt-asc">Deuda Total: Menor</option>
                <option value="capital-desc">Capital: Mayor</option>
              </select>
            </div>

            <div className="overflow-x-auto mt-2">
              {filteredDebts.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                  No se encontraron obligaciones en este corte
                </div>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Concepto / Obligación</th>
                      <th>Periodo</th>
                      <th>Vencimiento</th>
                      <th>Estado</th>
                      <th className="text-right">Capital</th>
                      <th className="text-right">Int. Resarcitorios</th>
                      <th className="text-right">Int. Punitorios</th>
                      <th className="text-right">Total</th>
                      <th>Expediente</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredDebts.map((d) => (
                      <tr key={d.id}>
                        <td className="font-semibold text-white max-w-xs truncate" title={d.concepto}>{d.concepto}</td>
                        <td className="font-mono text-xs text-white">{d.periodo}</td>
                        <td className="font-mono text-xs text-[var(--text-muted)]">{d.vencimiento || '-'}</td>
                        <td>
                          <span className={`badge text-[9px] uppercase tracking-wider ${getStatusBadge(d.estado)}`}>
                            {d.estado || 'IMPACTADO'}
                          </span>
                        </td>
                        <td className="text-right font-mono text-xs">{formatCurrency(d.capital)}</td>
                        <td className="text-right font-mono text-xs text-[var(--text-muted)]">{formatCurrency(d.interes_resarcitorio)}</td>
                        <td className="text-right font-mono text-xs text-[var(--text-muted)]">{formatCurrency(d.interes_punitorio)}</td>
                        <td className="text-right font-mono font-bold text-white">{formatCurrency(d.total)}</td>
                        <td className="font-mono text-xs text-[var(--text-muted)]">{d.expediente || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: Evolución Individual */}
        {activeTab === 'evolution' && (
          <div className="glass-panel p-5 flex flex-col gap-4">
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-tight m-0">
                Línea Temporal de Deuda Personal
              </h3>
              <p className="text-xs text-[var(--text-muted)] m-0 mt-0.5">
                Curva de variación histórica de saldos consolidados registrados.
              </p>
            </div>

            {evolution.length <= 1 ? (
              <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                No hay suficientes datos históricos de cortes cargados para graficar tendencias
              </div>
            ) : (
              <div className="relative w-full h-[220px] mt-2 select-none">
                <svg 
                  viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
                  className="w-full h-full"
                  style={{ overflow: 'visible' }}
                >
                  <defs>
                    <linearGradient id="personalChartGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.0" />
                    </linearGradient>
                    <filter id="personalGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="5" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Y Grid Lines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((val, idx) => {
                    const y = paddingY + val * (chartHeight - paddingY * 2);
                    const gridValue = maxTotal * (1 - val);
                    return (
                      <g key={idx}>
                        <line 
                          x1={paddingX} 
                          y1={y} 
                          x2={chartWidth - paddingX} 
                          y2={y} 
                          stroke="rgba(255, 255, 255, 0.03)" 
                          strokeDasharray="4 4" 
                        />
                        <text 
                          x={paddingX - 10} 
                          y={y + 4} 
                          textAnchor="end" 
                          fill="var(--text-muted)" 
                          fontSize="9"
                          fontFamily="monospace"
                        >
                          {formatCurrency(gridValue)}
                        </text>
                      </g>
                    );
                  })}

                  {/* X Axis Labels */}
                  {evolution.map((item, idx) => {
                    if (idx % 4 !== 0 && idx !== evolution.length - 1) return null;
                    const x = paddingX + (idx / (evolution.length - 1 || 1)) * (chartWidth - paddingX * 2);
                    return (
                      <text 
                        key={idx} 
                        x={x} 
                        y={chartHeight - 8} 
                        textAnchor="middle" 
                        fill="var(--text-muted)" 
                        fontSize="9"
                        fontFamily="monospace"
                      >
                        {item.corte}
                      </text>
                    );
                  })}

                  {/* Area Fill */}
                  {areaPath && <path d={areaPath} fill="url(#personalChartGrad)" />}

                  {/* Line */}
                  {linePath && (
                    <path 
                      d={linePath} 
                      fill="none" 
                      stroke="var(--accent-cyan)" 
                      strokeWidth="3" 
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      filter="url(#personalGlow)"
                    />
                  )}

                  {/* Points */}
                  {chartPoints.map((p, idx) => (
                    <g key={idx} className="group/pdot cursor-pointer">
                      <circle 
                        cx={p.x} 
                        cy={p.y} 
                        r="3.5" 
                        fill="var(--bg-main)" 
                        stroke="var(--accent-cyan)" 
                        strokeWidth="2" 
                      />
                      <title>{`${p.corte}: ${formatCurrency(p.total)} (${p.cant_obligaciones} oblig.)`}</title>
                    </g>
                  ))}
                </svg>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Historial Completo */}
        {activeTab === 'history' && (
          <div className="glass-panel p-5 flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <input
                type="text"
                placeholder="Filtrar por concepto o corte..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[rgba(15,22,42,0.6)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-2 text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-cyan)] w-full sm:w-64"
              />
            </div>

            <div className="overflow-x-auto mt-2">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-8 text-[var(--text-muted)] text-sm">
                  No se encontraron registros históricos
                </div>
              ) : (
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Corte (Fecha Foto)</th>
                      <th>Concepto / Obligación</th>
                      <th>Periodo</th>
                      <th>Estado</th>
                      <th className="text-right">Capital</th>
                      <th className="text-right">Resarcitorio</th>
                      <th className="text-right">Punitorio</th>
                      <th className="text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredHistory.slice(0, 100).map((h, idx) => (
                      <tr key={idx}>
                        <td className="font-mono text-xs font-bold text-[var(--accent-cyan)]">{h.corte}</td>
                        <td className="font-semibold text-white max-w-xs truncate" title={h.concepto}>{h.concepto}</td>
                        <td className="font-mono text-xs text-white">{h.periodo}</td>
                        <td>
                          <span className={`badge text-[9px] uppercase tracking-wider ${getStatusBadge(h.estado)}`}>
                            {h.estado || 'IMPACTADO'}
                          </span>
                        </td>
                        <td className="text-right font-mono text-xs">{formatCurrency(h.capital)}</td>
                        <td className="text-right font-mono text-xs text-[var(--text-muted)]">{formatCurrency(h.interes_resarcitorio)}</td>
                        <td className="text-right font-mono text-xs text-[var(--text-muted)]">{formatCurrency(h.interes_punitorio)}</td>
                        <td className="text-right font-mono font-bold text-white">{formatCurrency(h.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {filteredHistory.length > 100 && (
                <p className="text-center text-xs text-[var(--text-muted)] mt-4">
                  Se muestran los primeros 100 registros históricos de un total de {filteredHistory.length}.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
