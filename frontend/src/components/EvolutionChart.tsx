'use client';

import React, { useState } from 'react';

export interface EvolutionPoint {
  corte: string;
  capital: number;
  resarcitorio: number;
  punitorio: number;
  total: number;
}

interface EvolutionChartProps {
  evolution: EvolutionPoint[];
}

export default function EvolutionChart({ evolution }: EvolutionChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  // Helper de Formateo
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(val);
  };

  const chartWidth = 900;
  const chartHeight = 270;
  const paddingX = 75; // Aumentado para dar espacio al eje Y
  const paddingY = 40; // Aumentado para dar espacio al eje X

  const maxTotal = Math.max(...evolution.map((e) => e.total), 100000);
  const points = evolution.map((item, index) => {
    const x = paddingX + (index / (evolution.length - 1 || 1)) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - (item.total / maxTotal) * (chartHeight - paddingY * 2);
    return { x, y, ...item };
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = points.length > 0 
    ? `${linePath} L ${points[points.length - 1].x} ${chartHeight - paddingY} L ${points[0].x} ${chartHeight - paddingY} Z`
    : '';

  const handleMouseMove = (e: React.MouseEvent, index: number) => {
    // Posicionar tooltip relativo al contenedor SVG
    setTooltipPos({
      x: points[index].x,
      y: points[index].y - 10
    });
    setHoveredIndex(index);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  return (
    <div className="relative w-full">
      {/* SVG Chart */}
      <div className="relative w-full h-[270px] mt-2 select-none">
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
                  stroke="rgba(255, 255, 255, 0.04)" 
                  strokeDasharray="4 4" 
                />
                <text 
                  x={paddingX - 15} 
                  y={y + 4} 
                  textAnchor="end" 
                  fill="var(--text-secondary)" 
                  fontSize="12" // Aumentado de 9
                  fontWeight="600"
                  fontFamily="monospace"
                >
                  {formatCurrency(gridValue)}
                </text>
              </g>
            );
          })}

          {/* X Axis labels */}
          {evolution.map((item, idx) => {
            if (idx % 3 !== 0 && idx !== evolution.length - 1) return null; // Mostrar etiquetas cada 3 meses
            const x = paddingX + (idx / (evolution.length - 1 || 1)) * (chartWidth - paddingX * 2);
            return (
              <text 
                key={idx} 
                x={x} 
                y={chartHeight - 12} // Ajustado para dar más margen inferior
                textAnchor="middle" 
                fill="var(--text-secondary)" 
                fontSize="12" // Aumentado de 9
                fontWeight="600"
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
              strokeWidth="4.5" 
              strokeLinecap="round"
              strokeLinejoin="round"
              filter="url(#glow)"
            />
          )}

          {/* Interactive Dots */}
          {points.map((p, idx) => {
            const isHovered = hoveredIndex === idx;
            return (
              <g 
                key={idx} 
                onMouseMove={(e) => handleMouseMove(e, idx)}
                onMouseLeave={handleMouseLeave}
                className="cursor-pointer"
              >
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r={isHovered ? "8.5" : "5"} 
                  fill="var(--bg-main)" 
                  stroke={isHovered ? "var(--accent-cyan)" : "var(--accent-cyan)"} 
                  strokeWidth={isHovered ? "4" : "2.5"} 
                  style={{ transition: 'r 0.15s ease, stroke-width 0.15s ease' }}
                />
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r="22" 
                  fill="transparent" 
                />
              </g>
            );
          })}
        </svg>
      </div>

      {/* Floating Rich Tooltip */}
      {hoveredIndex !== null && (
        <div 
          className="absolute z-30 bg-[rgba(9,13,26,0.98)] border border-[rgba(0,242,254,0.35)] shadow-[0_12px_36px_rgba(0,0,0,0.6)] rounded-xl p-4.5 pointer-events-none transform -translate-x-1/2 -translate-y-full animate-in fade-in zoom-in-95 duration-150"
          style={{ 
            left: `${(tooltipPos.x / chartWidth) * 100}%`, 
            top: `${(tooltipPos.y / chartHeight) * 100}%`,
            width: '260px',
            marginTop: '-5px'
          }}
        >
          <div className="pb-2 mb-2 border-b border-[rgba(255,255,255,0.06)]">
            <span className="text-[10px] text-[var(--accent-cyan)] font-extrabold uppercase tracking-widest">
              Periodo {points[hoveredIndex].corte}
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[var(--text-secondary)] font-bold">Deuda Consolidada:</span>
              <span className="font-black text-white font-mono">{formatCurrency(points[hoveredIndex].total)}</span>
            </div>
            <div className="flex justify-between items-center text-xs pl-2 border-l-2 border-[var(--accent-cyan)]">
              <span className="text-[var(--text-muted)] font-medium">Capital Base:</span>
              <span className="font-bold text-[var(--text-primary)] font-mono">{formatCurrency(points[hoveredIndex].capital)}</span>
            </div>
            <div className="flex justify-between items-center text-xs pl-2 border-l-2 border-[var(--accent-purple)]">
              <span className="text-[var(--text-muted)] font-medium">Int. Resarcitorios:</span>
              <span className="font-bold text-[var(--accent-purple)] font-mono">{formatCurrency(points[hoveredIndex].resarcitorio)}</span>
            </div>
            <div className="flex justify-between items-center text-xs pl-2 border-l-2 border-[var(--accent-red)]">
              <span className="text-[var(--text-muted)] font-medium">Int. Punitorios:</span>
              <span className="font-bold text-[var(--accent-red)] font-mono">{formatCurrency(points[hoveredIndex].punitorio)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
