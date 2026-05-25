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
      text: '¡Hola! Soy tu **Asistente Tributario ARCA**. Puedo ayudarte a consultar deudas consolidada, buscar contribuyentes, ver embargos, evaluar riesgos fiscales y más de forma 100% gratuita.\n\n¿En qué te puedo ayudar hoy?'
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

  // Preguntas sugeridas
  const suggestions = [
    { label: '💰 Deuda consolidada total', query: 'deuda total consolidada' },
    { label: '🚨 Quién debe más', query: 'quien debe mas' },
    { label: '🛑 Embargos activos', query: 'quien tiene embargos activos' },
    { label: '👥 Contribuyentes de riesgo alto', query: 'quienes tienen riesgo fiscal alto' },
    { label: '📋 Lista de Monotributistas', query: 'monotributo' },
    { label: '🗓️ Vencimientos próximos', query: 'vencimientos' }
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
          text: '⚠️ Ocurrió un error de conexión al consultar el asistente local. Por favor, asegúrate de que el servidor Next.js esté corriendo.'
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
        // Añadir texto antes de la coincidencia
        if (match.index > lastIndex) {
          parts.push(processedLine.substring(lastIndex, match.index));
        }
        // Añadir texto en negrita
        parts.push(<strong key={match.index} className="text-white font-bold">{match[1]}</strong>);
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
          <li key={idx} className="ml-4 list-disc mb-1.5 text-[var(--text-secondary)] text-sm leading-relaxed">
            {content}
          </li>
        );
      }

      return (
        <p key={idx} className={line.trim() === '' ? 'h-3' : 'mb-2 text-[var(--text-secondary)] text-sm leading-relaxed'}>
          {content}
        </p>
      );
    });
  };

  // Renderizador de Tarjetas Tributarias Especiales (Wow UI)
  const renderCard = (card: Message['card']) => {
    if (!card) return null;

    switch (card.type) {
      case 'stats':
        return (
          <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 mt-2 flex flex-col gap-3">
            <span className="text-[10px] font-bold text-[var(--accent-cyan)] uppercase tracking-wider">Métricas Agregadas</span>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-[rgba(0,0,0,0.2)] p-2.5 rounded-lg border border-[rgba(255,255,255,0.02)]">
                <span className="text-[9px] text-[var(--text-muted)] block uppercase font-bold">Deuda Consolidada</span>
                <span className="text-base font-extrabold text-white block mt-0.5">{formatCurrency(card.data.totalDebt)}</span>
              </div>
              <div className="bg-[rgba(0,0,0,0.2)] p-2.5 rounded-lg border border-[rgba(255,255,255,0.02)]">
                <span className="text-[9px] text-[var(--text-muted)] block uppercase font-bold">Capital Base</span>
                <span className="text-sm font-bold text-white block mt-0.5">{formatCurrency(card.data.totalCapital)}</span>
              </div>
              <div className="bg-[rgba(0,0,0,0.2)] p-2.5 rounded-lg border border-[rgba(255,255,255,0.02)]">
                <span className="text-[9px] text-[var(--text-muted)] block uppercase font-bold">Int. Resarcitorios</span>
                <span className="text-sm font-bold text-[var(--accent-purple)] block mt-0.5">{formatCurrency(card.data.totalResarcitorio)}</span>
              </div>
              <div className="bg-[rgba(0,0,0,0.2)] p-2.5 rounded-lg border border-[rgba(255,255,255,0.02)]">
                <span className="text-[9px] text-[var(--text-muted)] block uppercase font-bold">Obligaciones</span>
                <span className="text-sm font-mono font-bold text-[var(--accent-cyan)] block mt-0.5">{card.data.obligaciones}</span>
              </div>
            </div>
            <div className="text-[10px] text-[var(--text-muted)] text-right font-medium">Al corte de {card.data.corte}</div>
          </div>
        );

      case 'taxpayer':
        return (
          <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 mt-2 flex flex-col gap-3">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-sm font-bold text-white block">{card.data.nombre}</span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">CUIT: {card.data.cuit}</span>
              </div>
              <span className={`badge text-[9px] px-2 py-0.5 font-bold uppercase ${
                card.data.riesgo_fiscal.toLowerCase() === 'bajo' ? 'badge-success' :
                card.data.riesgo_fiscal.toLowerCase() === 'medio' ? 'badge-warning' : 'badge-danger'
              }`}>
                {card.data.riesgo_fiscal}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-[rgba(255,255,255,0.04)]">
              <div>
                <span className="text-[9px] text-[var(--text-muted)] uppercase block font-bold">Score Fiscal</span>
                <span className="font-bold text-white">{card.data.score_cumplimiento}/100</span>
              </div>
              <div>
                <span className="text-[9px] text-[var(--text-muted)] uppercase block font-bold">Régimen</span>
                <span className="font-bold text-white line-clamp-1">{card.data.regimen}</span>
              </div>
            </div>

            {card.data.total > 0 ? (
              <div className="bg-[rgba(239,68,68,0.04)] border border-[rgba(239,68,68,0.12)] p-2.5 rounded-lg flex justify-between items-center">
                <div>
                  <span className="text-[9px] text-[var(--text-muted)] block uppercase font-bold">Saldo deudor</span>
                  <span className="text-sm font-extrabold text-[var(--accent-red)]">{formatCurrency(card.data.total)}</span>
                </div>
                <div className="text-right">
                  <span className="text-[9px] text-[var(--text-muted)] block uppercase font-bold">Períodos impagos</span>
                  <span className="text-xs font-bold text-white">{card.data.obligaciones} obligac.</span>
                </div>
              </div>
            ) : (
              <div className="bg-[rgba(16,185,129,0.04)] border border-[rgba(16,185,129,0.12)] p-2.5 rounded-lg text-center">
                <span className="text-xs font-bold text-[var(--accent-green)]">🎉 Al día sin deudas</span>
              </div>
            )}

            {card.data.activeDebts && card.data.activeDebts.length > 0 && (
              <div className="flex flex-col gap-1.5 mt-1">
                <span className="text-[9px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Últimos periodos impagos</span>
                {card.data.activeDebts.map((d: any, idx: number) => (
                  <div key={idx} className="flex justify-between items-center text-[10px] bg-[rgba(0,0,0,0.15)] px-2.5 py-1.5 rounded border border-[rgba(255,255,255,0.02)]">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-white bg-[rgba(255,255,255,0.04)] px-1 rounded">{d.periodo}</span>
                      <span className="text-[var(--text-secondary)] line-clamp-1 max-w-[120px]">{d.concepto}</span>
                    </div>
                    <span className="font-mono text-[var(--accent-red)] font-bold">{formatCurrency(d.total)}</span>
                  </div>
                ))}
              </div>
            )}

            <Link href={`/contribuyente/${card.data.cuit}`} onClick={() => setIsOpen(false)} className="btn-primary py-2 text-center text-xs justify-center rounded-lg mt-1 decoration-none">
              Ver perfil consolidado completo
            </Link>
          </div>
        );

      case 'list':
        return (
          <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 mt-2 flex flex-col gap-2">
            <span className="text-[10px] font-bold text-[var(--accent-cyan)] uppercase tracking-wider">{card.title || 'Contribuyentes'}</span>
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
              {card.data.map((c: any, idx: number) => (
                <Link
                  href={`/contribuyente/${c.cuit}`}
                  key={idx}
                  onClick={() => setIsOpen(false)}
                  className="flex justify-between items-center p-2 rounded bg-[rgba(255,255,255,0.01)] hover:bg-[rgba(0,242,254,0.03)] border border-[rgba(255,255,255,0.03)] hover:border-[rgba(0,242,254,0.12)] transition-all decoration-none group"
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-semibold text-white group-hover:text-[var(--accent-cyan)] transition-colors line-clamp-1">{c.nombre}</span>
                    <span className="text-[9px] text-[var(--text-muted)] font-mono">CUIT: {c.cuit}</span>
                  </div>
                  <div className="text-right flex flex-col items-end gap-1">
                    {c.total !== undefined ? (
                      <span className={`text-xs font-bold font-mono ${c.total > 0 ? 'text-[var(--accent-red)]' : 'text-[var(--accent-green)]'}`}>
                        {c.total > 0 ? formatCurrency(c.total) : 'Sin Deuda'}
                      </span>
                    ) : c.embargos_activos !== undefined ? (
                      <span className="badge text-[8px] badge-danger px-1.5 py-0.2">
                        {c.embargos_activos} embargo(s)
                      </span>
                    ) : null}
                    <span className={`text-[8px] px-1 rounded uppercase font-bold ${
                      c.riesgo_fiscal?.toLowerCase() === 'bajo' ? 'bg-[rgba(16,185,129,0.1)] text-[var(--accent-green)]' :
                      c.riesgo_fiscal?.toLowerCase() === 'medio' ? 'bg-[rgba(249,115,22,0.1)] text-[var(--accent-orange)]' : 'bg-[rgba(239,68,68,0.1)] text-[var(--accent-red)]'
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
          <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 mt-2 flex flex-col gap-2.5">
            <span className="text-[10px] font-bold text-[var(--accent-red)] uppercase tracking-wider block">🚨 Principal Saldo Deudor</span>
            <div className="flex justify-between items-start">
              <div>
                <span className="text-sm font-bold text-white block">{card.data.nombre}</span>
                <span className="text-[10px] text-[var(--text-muted)] font-mono block mt-0.5">CUIT: {card.data.cuit}</span>
              </div>
              <span className="badge badge-danger text-[9px] font-bold uppercase">{card.data.riesgo_fiscal}</span>
            </div>
            
            <div className="bg-[rgba(239,68,68,0.04)] border border-[rgba(239,68,68,0.12)] p-2.5 rounded-lg flex justify-between items-center text-xs">
              <div>
                <span className="text-[9px] text-[var(--text-muted)] block uppercase font-bold">Saldo Consolidado</span>
                <span className="text-base font-extrabold text-[var(--accent-red)]">{formatCurrency(card.data.total_deuda)}</span>
              </div>
              <div className="text-right">
                <span className="text-[9px] text-[var(--text-muted)] block uppercase font-bold">Obligaciones impagas</span>
                <span className="font-bold text-white">{card.data.cant_deudas} obligac.</span>
              </div>
            </div>

            <Link href={`/contribuyente/${card.data.cuit}`} onClick={() => setIsOpen(false)} className="btn-primary py-2 text-center text-xs justify-center rounded-lg mt-1 decoration-none">
              Ingresar al perfil tributario
            </Link>
          </div>
        );

      case 'vencimientos':
        return (
          <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] rounded-xl p-4 mt-2 flex flex-col gap-2">
            <span className="text-[10px] font-bold text-[var(--accent-cyan)] uppercase tracking-wider">Cronograma de Vencimientos</span>
            <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
              {card.data.map((v: any, idx: number) => (
                <div key={idx} className="flex flex-col gap-1 p-2 rounded bg-[rgba(255,255,255,0.01)] border border-[rgba(255,255,255,0.03)] text-xs">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-white line-clamp-1">{v.contribuyente}</span>
                    <span className="font-mono font-bold text-[var(--accent-red)]">{formatCurrency(v.total)}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] text-[var(--text-muted)]">
                    <span>{v.concepto} (Per. {v.periodo})</span>
                    <span className="font-mono bg-[rgba(255,255,255,0.03)] px-1.5 py-0.2 rounded text-[var(--text-secondary)]">Vence: {v.vencimiento}</span>
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
        title="Asistente Tributario AI"
      >
        {isOpen ? (
          <span className="text-black text-2xl font-bold transition-transform duration-300">✕</span>
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
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
        )}
        {/* Glow pulsing ring around FAB */}
        <span className="absolute inset-0 rounded-full border border-[var(--accent-cyan)] opacity-70 animate-ping pointer-events-none" />
      </button>

      {/* Chat Window Panel */}
      {isOpen && (
        <div 
          className="fixed bottom-24 right-6 w-[420px] max-w-[92vw] h-[600px] max-h-[80vh] rounded-2xl glass-panel border border-[rgba(255,255,255,0.08)] shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-6 duration-300"
          style={{ background: 'rgba(9, 13, 26, 0.97)', backdropFilter: 'blur(24px)' }}
        >
          
          {/* Header */}
          <div className="bg-[rgba(15,22,42,0.6)] border-b border-[rgba(255,255,255,0.06)] px-5 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-6 h-6 rounded bg-gradient-to-tr from-[var(--accent-cyan)] to-[var(--accent-purple)] flex items-center justify-center">
                <span className="text-black text-xs font-bold">AI</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-white m-0">TributariaAI</h3>
                <span className="text-[10px] text-[var(--accent-cyan)] font-bold uppercase tracking-wider block mt-0.5">Asistente Local Gratuito</span>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-[var(--text-muted)] hover:text-white bg-transparent border-none cursor-pointer text-sm p-1 rounded hover:bg-[rgba(255,255,255,0.03)] transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Messages scroll area */}
          <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-4 custom-scrollbar bg-[rgba(6,9,19,0.25)]">
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
                    className={`rounded-2xl px-4 py-3 border ${
                      isAssistant
                        ? 'bg-[rgba(15,22,42,0.7)] border-[rgba(255,255,255,0.04)] text-[var(--text-primary)] rounded-tl-sm'
                        : 'bg-gradient-to-tr from-[rgba(0,242,254,0.12)] to-[rgba(157,78,221,0.12)] border-[rgba(0,242,254,0.24)] text-[var(--text-primary)] rounded-tr-sm shadow-[0_0_12px_rgba(0,242,254,0.05)]'
                    }`}
                  >
                    {renderTextWithMarkdown(m.text)}
                    {m.card && renderCard(m.card)}
                  </div>
                  <span className="text-[9px] text-[var(--text-muted)] font-medium mt-1 uppercase tracking-wider px-1">
                    {isAssistant ? 'TributariaAI' : 'Tú'}
                  </span>
                </div>
              );
            })}

            {/* Chatbot Typing Loader */}
            {isLoading && (
              <div className="self-start flex flex-col items-start max-w-[85%]">
                <div className="bg-[rgba(15,22,42,0.7)] border border-[rgba(255,255,255,0.04)] rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5 h-10">
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-cyan)] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-cyan)] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-cyan)] animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-[9px] text-[var(--text-muted)] font-medium mt-1 uppercase tracking-wider px-1">
                  Procesando Base de Datos...
                </span>
              </div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Quick suggestions area */}
          <div className="bg-[rgba(15,22,42,0.4)] border-t border-[rgba(255,255,255,0.04)] px-4 py-3 flex gap-2 overflow-x-auto select-none custom-scrollbar">
            {suggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(s.query)}
                className="bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(0,242,254,0.06)] active:bg-[rgba(0,242,254,0.1)] border border-[rgba(255,255,255,0.05)] hover:border-[rgba(0,242,254,0.2)] rounded-full px-3 py-1.5 text-xs text-[var(--text-secondary)] hover:text-white cursor-pointer transition-all shrink-0 font-medium"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Input field */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
            className="bg-[rgba(15,22,42,0.85)] border-t border-[rgba(255,255,255,0.06)] p-3.5 flex gap-2.5 items-center"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pregúntame sobre deudores, embargos o montos..."
              className="flex-1 bg-[rgba(6,9,19,0.8)] border border-[rgba(255,255,255,0.08)] rounded-xl px-4 py-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--accent-cyan)] focus:shadow-[0_0_12px_rgba(0,242,254,0.15)] transition-all duration-300"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--accent-cyan)] to-[var(--accent-purple)] flex items-center justify-center cursor-pointer border-none disabled:opacity-40 disabled:cursor-not-allowed transform hover:scale-102 active:scale-98 transition-all shrink-0 shadow-[0_0_8px_rgba(0,242,254,0.15)]"
            >
              <svg
                className="w-5 h-5 text-black"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M14 5l7 7m0 0l-7 7m7-7H3"
                />
              </svg>
            </button>
          </form>

        </div>
      )}
    </>
  );
}
