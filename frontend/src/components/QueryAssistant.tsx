'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  card?: {
    type: 'stats' | 'taxpayer' | 'list' | 'vencimientos' | 'top_debtor';
    title?: string;
    data: any;
  };
}

export default function QueryAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Bienvenido al **Asistente Tributario de Monitoreo**. Estoy capacitado para realizar búsquedas complejas y proveer detalles analíticos sobre la base de datos relacional consolidada de deudas tributarias.\n\n¿En qué puedo asistirle hoy?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll a la parte inferior del chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  // Formato de moneda
  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Preguntas sugeridas (Completamente sin Emojis)
  const suggestions = [
    { label: 'Deuda consolidada total', query: 'deuda total consolidada' },
    { label: 'Mayor deudor', query: 'quien debe mas' },
    { label: 'Embargos activos', query: 'quien tiene embargos activos' },
    { label: 'Contribuyentes riesgo alto', query: 'quienes tienen riesgo fiscal alto' },
    { label: 'Monotributistas', query: 'monotributo' },
    { label: 'Vencimientos próximos', query: 'vencimientos' }
  ];

  // Enviar consulta
  const handleSend = async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    // Añadir mensaje del usuario
    setMessages((prev) => [
      ...prev,
      { id: userMessageId, sender: 'user', text: queryText }
    ]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query: queryText })
      });

      if (!response.ok) {
        throw new Error('Network error');
      }

      const data = await response.json();
      
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          sender: 'assistant',
          text: data.answer,
          card: data.card
        }
      ]);
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: assistantMessageId,
          sender: 'assistant',
          text: 'Error de conexion al consultar el asistente local. Por favor, verifique que el servidor este en ejecucion.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Renderizador de Markdown simple para negritas y listas
  const renderTextWithMarkdown = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, idx) => {
      let content: React.ReactNode = line;

      // Detectar elementos de lista con guión
      const isListItem = line.trim().startsWith('- ');
      let processedLine = line;
      if (isListItem) {
        processedLine = line.trim().substring(2);
      }

      // Reemplazar negritas **text** con <strong>
      const boldRegex = /\*\*(.*?)\*\*/g;
      const parts = [];
      let lastIndex = 0;
      let match;

      while ((match = boldRegex.exec(processedLine)) !== null) {
        if (match.index > lastIndex) {
          parts.push(processedLine.substring(lastIndex, match.index));
        }
        parts.push(<strong key={match.index} className="text-white font-semibold">{match[1]}</strong>);
        lastIndex = boldRegex.lastIndex;
      }
      if (lastIndex < processedLine.length) {
        parts.push(processedLine.substring(lastIndex));
      }

      // Reemplazar código en línea `code`
      const finalParts = parts.flatMap((part) => {
        if (typeof part !== 'string') return [part];
        
        const codeRegex = /`(.*?)`/g;
        const codeSubparts = [];
        let cLastIndex = 0;
        let cMatch;
        while ((cMatch = codeRegex.exec(part)) !== null) {
          if (cMatch.index > cLastIndex) {
            codeSubparts.push(part.substring(cLastIndex, cMatch.index));
          }
          codeSubparts.push(
            <code key={cMatch.index} className="bg-[rgba(255,255,255,0.06)] px-1.5 py-0.5 rounded font-mono text-[var(--accent-cyan)] text-xs">
              {cMatch[1]}
            </code>
          );
          cLastIndex = codeRegex.lastIndex;
        }
        if (cLastIndex < part.length) {
          codeSubparts.push(part.substring(cLastIndex));
        }
        return codeSubparts;
      });

      content = finalParts.length > 0 ? finalParts : content;

      if (isListItem) {
        return (
          <li key={idx} className="ml-4 list-disc mb-1 text-[var(--text-secondary)] text-[13px] leading-relaxed">
            {content}
          </li>
        );
      }

      return (
        <p key={idx} className={line.trim() === '' ? 'h-2.5' : 'mb-1.5 text-[var(--text-secondary)] text-[13px] leading-relaxed'}>
          {content}
        </p>
      );
    });
  };

  // Renderizador de Tarjetas Tributarias Especiales (Completamente sin Emojis)
  const renderCard = (card: Message['card']) => {
    if (!card) return null;

    switch (card.type) {
      case 'stats':
        return (
          <div className="bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.06)] rounded-xl p-3.5 mt-2.5 flex flex-col gap-2.5">
            <span className="text-[9px] font-bold text-[var(--accent-cyan)] uppercase tracking-wider">Metricas Agregadas</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[rgba(0,0,0,0.15)] p-2 rounded-lg border border-[rgba(255,255,255,0.02)]">
                <span className="text-[8px] text-[var(--text-muted)] block uppercase font-bold">Deuda Consolidada</span>
                <span className="text-sm font-extrabold text-white block mt-0.5">{formatCurrency(card.data.totalDebt)}</span>
              </div>
              <div className="bg-[rgba(0,0,0,0.15)] p-2 rounded-lg border border-[rgba(255,255,255,0.02)]">
                <span className="text-[8px] text-[var(--text-muted)] block uppercase font-bold">Capital Base</span>
                <span className="text-xs font-bold text-white block mt-0.5">{formatCurrency(card.data.totalCapital)}</span>
              </div>
              <div className="bg-[rgba(0,0,0,0.15)] p-2 rounded-lg border border-[rgba(255,255,255,0.02)]">
                <span className="text-[8px] text-[var(--text-muted)] block uppercase font-bold">Int. Resarcitorios</span>
                <span className="text-xs font-bold text-[var(--accent-purple)] block mt-0.5">{formatCurrency(card.data.totalResarcitorio)}</span>
              </div>
              <div className="bg-[rgba(0,0,0,0.15)] p-2 rounded-lg border border-[rgba(255,255,255,0.02)]">
                <span className="text-[8px] text-[var(--text-muted)] block uppercase font-bold">Obligaciones</span>
                <span className="text-xs font-mono font-bold text-[var(--accent-cyan)] block mt-0.5">{card.data.obligaciones}</span>
              </div>
            </div>
            <div className="text-[9px] text-[var(--text-muted)] text-right font-medium">Corte de actualizacion: {card.data.corte}</div>
          </div>
        );

      case 'taxpayer':
        return (
          <div className="bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.06)] rounded-xl p-3.5 mt-2.5 flex flex-col gap-2.5">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-white block">{card.data.nombre}</span>
                <span className="text-[9px] text-[var(--text-muted)] font-mono block mt-0.5">CUIT: {card.data.cuit}</span>
              </div>
              <span className={`badge text-[8px] px-1.5 py-0.2 font-bold uppercase ${
                card.data.riesgo_fiscal.toLowerCase() === 'bajo' ? 'badge-success' :
                card.data.riesgo_fiscal.toLowerCase() === 'medio' ? 'badge-warning' : 'badge-danger'
              }`}>
                {card.data.riesgo_fiscal}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[11px] py-1.5 border-y border-[rgba(255,255,255,0.04)]">
              <div>
                <span className="text-[8px] text-[var(--text-muted)] uppercase block font-bold">Score Fiscal</span>
                <span className="font-semibold text-white">{card.data.score_cumplimiento}/100</span>
              </div>
              <div>
                <span className="text-[8px] text-[var(--text-muted)] uppercase block font-bold">Regimen</span>
                <span className="font-semibold text-white line-clamp-1">{card.data.regimen}</span>
              </div>
            </div>

            {card.data.total > 0 ? (
              <div className="bg-[rgba(239,68,68,0.03)] border border-[rgba(239,68,68,0.1)] p-2 rounded-lg flex justify-between items-center text-xs">
                <div>
                  <span className="text-[8px] text-[var(--text-muted)] block uppercase font-bold">Saldo Deudor</span>
                  <span className="text-xs font-bold text-[var(--accent-red)]">{formatCurrency(card.data.total)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[8px] text-[var(--text-muted)] block uppercase font-bold">Impagos</span>
                  <span className="text-[11px] font-semibold text-white">{card.data.obligaciones} obligac.</span>
                </div>
              </div>
            ) : (
              <div className="bg-[rgba(16,185,129,0.03)] border border-[rgba(16,185,129,0.1)] p-2 rounded-lg text-center">
                <span className="text-xs font-bold text-[var(--accent-green)]">Cuenta al dia</span>
              </div>
            )}

            {card.data.activeDebts && card.data.activeDebts.length > 0 && (
              <div className="flex flex-col gap-1 mt-0.5">
                <span className="text-[8px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Ultimos Periodos</span>
                {card.data.activeDebts.map((d: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-[9px] bg-[rgba(0,0,0,0.15)] px-2 py-1 rounded border border-[rgba(255,255,255,0.01)]">
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-white bg-[rgba(255,255,255,0.02)] px-1 rounded">{d.periodo}</span>
                      <span className="text-[var(--text-secondary)] line-clamp-1 max-w-[140px]">{d.concepto}</span>
                    </div>
                    <span className="font-mono text-[var(--accent-red)] font-bold">{formatCurrency(d.total)}</span>
                  </div>
                ))}
              </div>
            )}

            <Link href={`/contribuyente/${card.data.cuit}`} onClick={() => setIsOpen(false)} className="btn-primary py-1.5 text-center text-xs justify-center rounded-lg mt-0.5 decoration-none font-bold">
              Ver perfil tributario completo
            </Link>
          </div>
        );

      case 'list':
        return (
          <div className="bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.06)] rounded-xl p-3.5 mt-2.5 flex flex-col gap-2">
            <span className="text-[9px] font-bold text-[var(--accent-cyan)] uppercase tracking-wider">{card.title || 'Contribuyentes'}</span>
            <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
              {card.data.map((c: any, idx: number) => (
                <Link
                  href={`/contribuyente/${c.cuit}`}
                  key={idx}
                  onClick={() => setIsOpen(false)}
                  className="flex justify-between items-center p-2 rounded bg-[rgba(255,255,255,0.01)] hover:bg-[rgba(0,242,254,0.03)] border border-[rgba(255,255,255,0.02)] hover:border-[rgba(0,242,254,0.1)] transition-all decoration-none group"
                >
                  <div className="flex flex-col">
                    <span className="text-[11px] font-semibold text-white group-hover:text-[var(--accent-cyan)] transition-colors line-clamp-1">{c.nombre}</span>
                    <span className="text-[9px] text-[var(--text-muted)] font-mono">CUIT: {c.cuit}</span>
                  </div>
                  <div className="text-right flex flex-col items-end gap-0.5">
                    {c.total !== undefined ? (
                      <span className={`text-[11px] font-bold font-mono ${c.total > 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>
                        {c.total > 0 ? formatCurrency(c.total) : 'Al dia'}
                      </span>
                    ) : c.embargos_activos !== undefined ? (
                      <span className="badge text-[8px] badge-danger px-1 py-0.2">
                        {c.embargos_activos} embargo(s)
                      </span>
                    ) : null}
                    <span className={`text-[8px] px-1 rounded uppercase font-bold ${
                      c.riesgo_fiscal?.toLowerCase() === 'bajo' ? 'bg-[rgba(16,185,129,0.05)] text-[var(--accent-green)]' :
                      c.riesgo_fiscal?.toLowerCase() === 'medio' ? 'bg-[rgba(249,115,22,0.05)] text-[var(--accent-orange)]' : 'bg-[rgba(239,68,68,0.05)] text-[var(--accent-red)]'
                    }`}>
                      {c.riesgo_fiscal}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        );

      case 'top_debtor':
        return (
          <div className="bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.06)] rounded-xl p-3.5 mt-2.5 flex flex-col gap-2">
            <span className="text-[9px] font-bold text-[var(--accent-red)] uppercase tracking-wider block">Principal Saldo Deudor</span>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-bold text-white block">{card.data.nombre}</span>
                <span className="text-[9px] text-[var(--text-muted)] font-mono block mt-0.5">CUIT: {card.data.cuit}</span>
              </div>
              <span className="badge badge-danger text-[8px] font-bold uppercase">{card.data.riesgo_fiscal}</span>
            </div>
            
            <div className="bg-[rgba(239,68,68,0.03)] border border-[rgba(239,68,68,0.1)] p-2 rounded-lg flex justify-between items-center text-xs">
              <div>
                <span className="text-[9px] text-[var(--text-muted)] block uppercase font-bold">Saldo Consolidado</span>
                <span className="text-xs font-extrabold text-[var(--accent-red)]">{formatCurrency(card.data.total_deuda)}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-[var(--text-muted)] block uppercase font-bold">Obligaciones</span>
                <span className="text-[11px] font-bold text-white">{card.data.cant_deudas} obligac.</span>
              </div>
            </div>

            <Link href={`/contribuyente/${card.data.cuit}`} onClick={() => setIsOpen(false)} className="btn-primary py-1.5 text-center text-xs justify-center rounded-lg mt-0.5 decoration-none font-bold">
              Ingresar al perfil tributario
            </Link>
          </div>
        );

      case 'vencimientos':
        return (
          <div className="bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.06)] rounded-xl p-3.5 mt-2.5 flex flex-col gap-2">
            <span className="text-[9px] font-bold text-[var(--accent-cyan)] uppercase tracking-wider">Vencimientos Activos</span>
            <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto pr-1 custom-scrollbar">
              {card.data.map((v: any, idx: number) => (
                <div key={idx} className="flex flex-col gap-1 p-2 rounded bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.02)] text-[11px]">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white line-clamp-1">{v.contribuyente}</span>
                    <span className="font-mono font-bold text-[var(--accent-red)]">{formatCurrency(v.total)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-[var(--text-muted)]">
                    <span>{v.concepto} (Per. {v.periodo})</span>
                    <span className="font-mono bg-[rgba(255,255,255,0.02)] px-1.5 py-0.2 rounded text-[var(--text-secondary)]">Vence: {v.vencimiento}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Floating Chat Button FAB */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 w-14 h-14 rounded-full bg-gradient-to-tr from-[var(--accent-cyan)] to-[var(--accent-purple)] flex items-center justify-center shadow-[0_0_20px_rgba(0,242,254,0.35)] hover:shadow-[0_0_30px_rgba(0,242,254,0.5)] z-50 cursor-pointer border-none group transform hover:scale-105 active:scale-95 transition-all duration-300"
        title="Asistente Tributario"
      >
        {isOpen ? (
          <span className="text-black text-xl font-bold transition-transform duration-300">✕</span>
        ) : (
          <svg
            className="w-7 h-7 text-black transition-transform duration-300 group-hover:rotate-12"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        )}
        <span className="absolute inset-0 rounded-full border border-[var(--accent-cyan)] opacity-70 animate-ping pointer-events-none" />
      </button>

      {/* Chat Window Panel (Opacity highly optimized to 97%) */}
      {isOpen && (
        <div 
          className="fixed bottom-24 right-6 w-[430px] max-w-[92vw] h-[610px] max-h-[82vh] rounded-2xl glass-panel border border-[rgba(255,255,255,0.08)] shadow-[0_24px_60px_rgba(0,0,0,0.65)] flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-6 duration-300"
          style={{ background: 'rgba(7, 10, 20, 0.98)', backdropFilter: 'blur(28px)', padding: '0px' }} // Padding local a 0 para diseño de contenedores perfectos
        >
          
          {/* Header */}
          <div className="bg-[rgba(12,18,36,0.95)] border-b border-[rgba(255,255,255,0.05)] px-5 py-4.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-gradient-to-tr from-[var(--accent-cyan)] to-[var(--accent-purple)] flex items-center justify-center shadow-[0_0_8px_rgba(0,242,254,0.3)]">
                <span className="text-black text-[10px] font-black">AT</span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-white uppercase tracking-wider m-0">TributariaAI</h3>
                <span className="text-[9px] text-[var(--accent-cyan)] font-extrabold uppercase tracking-widest block mt-0.5">Asistencia de Monitoreo Local</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[var(--text-muted)] hover:text-white bg-transparent border-none cursor-pointer text-sm p-1 rounded hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Messages Scroll Area - Highly Optimized Spacing */}
          <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6.5 custom-scrollbar bg-[rgba(6,9,19,0.35)]">
            {messages.map((m) => {
              const isAssistant = m.sender === 'assistant';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col max-w-[85%] ${
                    isAssistant ? 'self-start items-start' : 'self-end items-end'
                  }`}
                >
                  <div
                    className={`rounded-2xl px-4 py-3 border text-left ${
                      isAssistant
                        ? 'bg-[rgba(15,22,42,0.85)] border-[rgba(255,255,255,0.04)] text-[var(--text-primary)] rounded-tl-sm shadow-md'
                        : 'bg-gradient-to-tr from-[rgba(0,242,254,0.1)] to-[rgba(157,78,221,0.1)] border-[rgba(0,242,254,0.2)] text-[var(--text-primary)] rounded-tr-sm shadow-[0_0_15px_rgba(0,242,254,0.04)]'
                    }`}
                  >
                    {renderTextWithMarkdown(m.text)}
                    {m.card && renderCard(m.card)}
                  </div>
                  <span className="text-[8px] text-[var(--text-muted)] font-bold uppercase tracking-wider mt-1.5 px-1.5">
                    {isAssistant ? 'TributariaAI' : 'Consulta'}
                  </span>
                </div>
              );
            })}

            {/* Chatbot Typing Loader */}
            {isLoading && (
              <div className="self-start flex flex-col items-start max-w-[85%]">
                <div className="bg-[rgba(15,22,42,0.85)] border border-[rgba(255,255,255,0.04)] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 h-10 shadow-md">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-cyan)] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[8px] text-[var(--text-muted)] font-bold uppercase tracking-wider mt-1.5 px-1.5">
                  Procesando Base de Datos...
                </span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions Area - Beautifully Restyled Buttons */}
          <div className="bg-[rgba(12,18,36,0.7)] border-t border-[rgba(255,255,255,0.04)] px-4 py-3 flex gap-2 overflow-x-auto select-none custom-scrollbar">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s.query)}
                className="bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(0,242,254,0.05)] active:bg-[rgba(0,242,254,0.08)] border border-[rgba(255,255,255,0.05)] hover:border-[rgba(0,242,254,0.22)] rounded-lg px-3.5 py-2 text-xs text-[var(--text-secondary)] hover:text-white cursor-pointer transition-all duration-300 shrink-0 font-semibold shadow-sm transform hover:-translate-y-0.5 hover:shadow-[0_0_10px_rgba(0,242,254,0.1)]"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Input Panel - Ultra Premium Unified Input Bar */}
          <div className="bg-[rgba(8,12,24,0.98)] border-t border-[rgba(255,255,255,0.05)] p-4 flex flex-col justify-center">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(input);
              }}
              className="flex items-center gap-2.5 bg-[rgba(6,9,19,0.7)] border border-[rgba(255,255,255,0.06)] focus-within:border-[var(--accent-cyan)] focus-within:shadow-[0_0_15px_rgba(0,242,254,0.1)] rounded-xl px-3 py-1.5 transition-all duration-300 w-full"
            >
              {/* Sleek SVG Search Icon */}
              <svg 
                className="w-4 h-4 text-[var(--text-muted)] pl-0.5 shrink-0" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2.5" 
                viewBox="0 0 24 24" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
              </svg>
              
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Escriba su consulta analitica de deudas..."
                className="flex-1 bg-transparent border-none text-[13px] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none py-1.5"
                disabled={isLoading}
              />
              
              {/* Send Button integrated inside input bar */}
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="w-8 h-8 rounded-lg bg-gradient-to-tr from-[var(--accent-cyan)] to-[var(--accent-purple)] flex items-center justify-center cursor-pointer border-none disabled:opacity-30 disabled:cursor-not-allowed transform active:scale-95 transition-all shrink-0 shadow-[0_0_6px_rgba(0,242,254,0.2)]"
              >
                <svg
                  className="w-4 h-4 text-black"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              </button>
            </form>
          </div>

        </div>
      )}
    </>
  );
}
