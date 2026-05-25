import React from 'react';
import Link from 'next/link';
import { getLatestCorte, getGeneralStats, getTaxpayersSummary, getGlobalEvolution } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const latestCorte = getLatestCorte();
  
  if (!latestCorte) {
    return (
      <div className="glass-panel p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
        <h2 className="text-xl font-bold text-white mb-2">No hay datos en la Base de Datos</h2>
        <p className="text-[var(--text-muted)] max-w-md mb-6">
          El scraper aún se encuentra en ejecución o no se han guardado registros en la base de datos `arca.db`.
        </p>
        <div className="animate-spin w-8 h-8 border-2 border-[var(--accent-cyan)] border-t-transparent rounded-full" />
      </div>
    );
  }

  const stats = getGeneralStats(latestCorte);
  const taxpayers = getTaxpayersSummary(latestCorte);
  const evolution = getGlobalEvolution();

  // Helper de Formateo
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Helper de Porcentaje
  const getPercentage = (part: number, total: number) => {
    if (!total) return '0%';
    return `${Math.round((part / total) * 100)}%`;
  };

  // --- CÁLCULO DE COORDENADAS PARA GRÁFICO SVG ---
  const chartWidth = 900;
  const chartHeight = 250;
  const paddingX = 50;
  const paddingY = 30;

  const maxTotal = Math.max(...evolution.map((e) => e.total), 100000);
  const points = evolution.map((item, index) => {
    const x = paddingX + (index / (evolution.length - 1 || 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - (item.total / maxTotal) * (chartHeight - paddingY * 2);
    return { x, y, ...item };
  });

  // Generar cadena de ruta para la línea principal
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  // Generar cadena de ruta para el área degradada
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
    : '';

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Dashboard Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight m-0 uppercase flex items-center gap-2">
            Panel de Deudas Consolidadas <span className="text-xs bg-[rgba(0,242,254,0.1)] border border-[rgba(0,242,254,0.2)] text-[var(--accent-cyan)] font-extrabold px-2.5 py-1 rounded">Consolidado</span>
          </h1>
          <p className="text-sm text-[var(--text-muted)] m-0 mt-1">
            Análisis agregado de 30 meses de historia tributaria para todas las cuentas activas en ARCA.
          </p>
        </div>
        <div className="flex items-center gap-3 bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.04)] px-4 py-2 rounded-xl text-xs">
          <div>
            <span className="text-[var(--text-muted)] font-medium">Última Actualización:</span>
            <span className="text-[var(--accent-cyan)] font-bold ml-1.5 uppercase">{latestCorte}</span>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Total Debt */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-br from-[var(--accent-cyan)] to-transparent opacity-5 rounded-full pointer-events-none transition-transform duration-500 group-hover:scale-125" />
          <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider block">Deuda Total Activa</span>
          <span className="text-3xl font-black text-white block mt-2 tracking-tight group-hover:text-[var(--accent-cyan)] transition-colors">
            {formatCurrency(stats.totalDebt)}
          </span>
          <div className="flex items-center gap-2 mt-4 pt-3 border-t border-[rgba(255,255,255,0.04)] text-xs">
            <span className="badge badge-danger">CON CORRIENTE</span>
            <span className="text-[var(--text-muted)]">Todos los contribuyentes</span>
          </div>
        </div>

        {/* Capital */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider block">Capital Puro</span>
          <span className="text-3xl font-black text-white block mt-2 tracking-tight">
            {formatCurrency(stats.totalCapital)}
          </span>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[rgba(255,255,255,0.04)] text-xs">
            <span className="text-[var(--text-muted)]">Porcentaje del Total:</span>
            <span className="font-bold text-[var(--accent-cyan)]">{getPercentage(stats.totalCapital, stats.totalDebt)}</span>
          </div>
        </div>

        {/* Intereses Resarcitorios */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider block">Intereses Resarcitorios</span>
          <span className="text-3xl font-black text-white block mt-2 tracking-tight">
            {formatCurrency(stats.totalResarcitorio)}
          </span>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[rgba(255,255,255,0.04)] text-xs">
            <span className="text-[var(--text-muted)]">Porcentaje del Total:</span>
            <span className="font-bold text-[var(--accent-purple)]">{getPercentage(stats.totalResarcitorio, stats.totalDebt)}</span>
          </div>
        </div>

        {/* Intereses Punitorios */}
        <div className="glass-panel p-5 relative overflow-hidden group">
          <span className="text-xs text-[var(--text-muted)] font-bold uppercase tracking-wider block">Intereses Punitorios</span>
          <span className="text-3xl font-black text-white block mt-2 tracking-tight">
            {formatCurrency(stats.totalPunitorio)}
          </span>
          <div className="flex items-center justify-between mt-4 pt-3 border-t border-[rgba(255,255,255,0.04)] text-xs">
            <span className="text-[var(--text-muted)]">Porcentaje del Total:</span>
            <span className="font-bold text-[var(--accent-red)]">{getPercentage(stats.totalPunitorio, stats.totalDebt)}</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Overview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Evolutionary Line Chart */}
        <div className="glass-panel p-5 lg:col-span-2 flex flex-col gap-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-base font-bold text-white uppercase tracking-tight m-0">
                Evolución Histórica de Deuda
              </h3>
              <p className="text-xs text-[var(--text-muted)] m-0 mt-0.5">
                Curva de crecimiento consolidado acumulativo de saldos del portal.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-cyan)] shadow-[0_0_8px_var(--accent-cyan)]" />
              <span className="text-xs font-semibold text-white font-mono">Deuda Total</span>
            </div>
          </div>

          {/* SVG Custom Line Chart */}
          <div className="relative w-full h-[250px] mt-2 select-none">
            <svg 
              viewBox={`0 0 ${chartWidth} ${chartHeight}`} 
              className="w-full h-full"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent-cyan)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="var(--accent-cyan)" stopOpacity="0.0" />
                </linearGradient>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Grid Lines Y */}
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

              {/* X Axis labels */}
              {evolution.map((item, idx) => {
                if (idx % 4 !== 0 && idx !== evolution.length - 1) return null;
                const x = paddingX + (idx / (evolution.length - 1 || 1)) * (chartWidth - paddingX * 2);
                return (
                  <text 
                    key={idx} 
                    x={x} 
                    y={chartHeight - 10} 
                    textAnchor="middle" 
                    fill="var(--text-muted)" 
                    fontSize="9"
                    fontFamily="monospace"
                  >
                    {item.corte}
                  </text>
                );
              })}

              {/* Gradient Area Fill */}
              {areaPath && <path d={areaPath} fill="url(#chartGradient)" />}

              {/* Glowing Line */}
              {linePath && (
                <path 
                  d={linePath} 
                  fill="none" 
                  stroke="var(--accent-cyan)" 
                  strokeWidth="3.5" 
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glow)"
                />
              )}

              {/* Interactive Dots on hover & active endpoints */}
              {points.map((p, idx) => (
                <g key={idx} className="group/dot cursor-pointer">
                  <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r="4" 
                    fill="var(--bg-main)" 
                    stroke="var(--accent-cyan)" 
                    strokeWidth="2" 
                  />
                  <circle 
                    cx={p.x} 
                    cy={p.y} 
                    r="9" 
                    fill="var(--accent-cyan)" 
                    opacity="0" 
                    className="hover:opacity-20 transition-opacity" 
                  />
                  {/* Small Tooltip trigger box */}
                  <title>{`${p.corte}: ${formatCurrency(p.total)}`}</title>
                </g>
              ))}
            </svg>
          </div>
        </div>

        {/* Global Summary & Insights */}
        <div className="glass-panel p-5 flex flex-col justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-tight m-0">
              Estado de Auditoría
            </h3>
            <p className="text-xs text-[var(--text-muted)] m-0 mt-0.5">
              Estadísticas consolidadas operativas del proceso.
            </p>
          </div>

          <div className="flex flex-col gap-4 my-2">
            <div className="flex justify-between items-center py-2.5 border-b border-[rgba(255,255,255,0.04)]">
              <span className="text-xs text-[var(--text-muted)] font-semibold">Total Contribuyentes</span>
              <span className="text-sm font-bold text-white">{stats.taxpayersCount}</span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-[rgba(255,255,255,0.04)]">
              <span className="text-xs text-[var(--text-muted)] font-semibold">Cuentas con Obligaciones</span>
              <span className="text-sm font-bold text-[var(--accent-red)]">
                {taxpayers.filter((t) => t.total > 0).length} de {stats.taxpayersCount}
              </span>
            </div>
            <div className="flex justify-between items-center py-2.5 border-b border-[rgba(255,255,255,0.04)]">
              <span className="text-xs text-[var(--text-muted)] font-semibold">Obligaciones Activas</span>
              <span className="text-sm font-bold text-[var(--accent-cyan)] font-mono">{stats.activeObligationsCount}</span>
            </div>
            <div className="flex justify-between items-center py-2.5">
              <span className="text-xs text-[var(--text-muted)] font-semibold">Promedio de Deuda</span>
              <span className="text-sm font-bold text-white font-mono">
                {formatCurrency(stats.totalDebt / (taxpayers.filter((t) => t.total > 0).length || 1))}
              </span>
            </div>
          </div>

          {/* Quick Warning Card */}
          <div className="bg-[rgba(239,68,68,0.08)] border border-[rgba(239,68,68,0.2)] rounded-xl p-3.5 flex items-start gap-3">
            <span className="text-[var(--accent-red)] text-base">⚠️</span>
            <div>
              <span className="text-xs font-bold text-white block">Acciones de Apremio</span>
              <span className="text-[11px] text-[var(--text-muted)] block mt-0.5 leading-normal">
                Existen {taxpayers.reduce((acc, curr) => acc + curr.embargos_activos, 0)} embargos preventivos vigentes cargados en la base de datos relacional.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Taxpayers Ranking Grid */}
      <div className="glass-panel p-5">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
          <div>
            <h3 className="text-base font-bold text-white uppercase tracking-tight m-0">
              Ranking de Deuda por Contribuyente
            </h3>
            <p className="text-xs text-[var(--text-muted)] m-0 mt-0.5">
              Resumen ordenado de mayor a menor saldo consolidado al {latestCorte}.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Contribuyente</th>
                <th>CUIT</th>
                <th>Régimen / Actividad</th>
                <th>Riesgo</th>
                <th className="text-right">Obligaciones</th>
                <th className="text-right">Deuda Consolidada</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {taxpayers.map((t) => (
                <tr key={t.cuit}>
                  <td className="font-semibold text-white">
                    <Link href={`/contribuyente/${t.cuit}`} className="hover:text-[var(--accent-cyan)] transition-colors decoration-none">
                      {t.nombre}
                    </Link>
                  </td>
                  <td className="font-mono text-xs text-[var(--text-muted)]">{t.cuit}</td>
                  <td>
                    <div className="flex flex-col">
                      <span className="text-xs text-white font-medium">{t.regimen}</span>
                      <span className="text-[10px] text-[var(--text-muted)]">{t.actividad}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        t.riesgo_fiscal.toLowerCase() === 'bajo' ? 'bg-[var(--accent-green)]' : 
                        t.riesgo_fiscal.toLowerCase() === 'medio' ? 'bg-[var(--accent-orange)]' : 'bg-[var(--accent-red)]'
                      }`} />
                      <span className="text-xs font-bold uppercase text-[var(--text-primary)]">{t.riesgo_fiscal}</span>
                    </div>
                  </td>
                  <td className="text-right font-mono text-xs font-bold">{t.cant_obligaciones}</td>
                  <td className="text-right font-mono font-bold">
                    <span className={t.total > 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}>
                      {formatCurrency(t.total)}
                    </span>
                  </td>
                  <td className="text-right">
                    <Link href={`/contribuyente/${t.cuit}`} className="btn-primary py-1 px-3.5 text-xs rounded-lg">
                      Ver Perfil
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
