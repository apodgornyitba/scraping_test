import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getLatestCorte } from '@/lib/queries';

// Helper de Formateo
const formatCurrency = (val: number) => {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(val);
};

// Remover acentos y normalizar
const normalizeText = (text: string): string => {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
};

export async function POST(req: Request) {
  try {
    const { query } = await req.json();
    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    const normQuery = normalizeText(query);
    const latestCorte = getLatestCorte() || '2025-06';

    // Obtener todos los contribuyentes para cruzar nombres
    const contribuyentes = db.prepare('SELECT * FROM contribuyentes').all() as any[];

    // 1. Detección de Búsqueda por Contribuyente Específico (Nombre o CUIT)
    let matchedTaxpayer = null;
    for (const c of contribuyentes) {
      const normNombre = normalizeText(c.nombre);
      const normUsuario = normalizeText(c.usuario);
      const cuitLimpio = c.cuit.replace(/-/g, '');
      
      // Si la consulta contiene el CUIT o partes distintivas del nombre
      if (
        normQuery.includes(cuitLimpio) ||
        normQuery.includes(c.cuit) ||
        (normNombre.split(' ').some(namePart => namePart.length > 2 && normQuery.includes(namePart))) ||
        normQuery.includes(normUsuario)
      ) {
        matchedTaxpayer = c;
        break;
      }
    }

    if (matchedTaxpayer) {
      // Obtener resumen de deudas activas para este contribuyente
      const activeDebtsQuery = `
        SELECT 
          d.periodo,
          d.concepto,
          d.vencimiento,
          ds.capital,
          ds.interes_resarcitorio,
          ds.interes_punitorio,
          ds.total,
          ds.estado,
          ds.expediente
        FROM deudas d
        JOIN deudas_snapshots ds ON d.id = ds.deuda_id
        WHERE d.cuit = ? AND ds.corte = ? AND ds.total > 0
        ORDER BY d.periodo DESC
      `;
      const activeDebts = db.prepare(activeDebtsQuery).all(matchedTaxpayer.cuit, latestCorte) as any[];

      const totalQuery = `
        SELECT 
          SUM(ds.capital) as capital,
          SUM(ds.interes_resarcitorio) as resarcitorio,
          SUM(ds.interes_punitorio) as punitorio,
          SUM(ds.total) as total,
          COUNT(DISTINCT d.id) as cant_obligaciones
        FROM deudas d
        JOIN deudas_snapshots ds ON d.id = ds.deuda_id
        WHERE d.cuit = ? AND ds.corte = ? AND ds.total > 0
      `;
      const totals = db.prepare(totalQuery).get(matchedTaxpayer.cuit, latestCorte) as any;

      const totalAmount = totals?.total || 0;
      const capitalAmount = totals?.capital || 0;
      const resarcitorioAmount = totals?.resarcitorio || 0;
      const punitorioAmount = totals?.punitorio || 0;
      const cantObligaciones = totals?.cant_obligaciones || 0;

      let answer = `Aquí tienes el perfil y el estado de cuenta consolidado para **${matchedTaxpayer.nombre}** (CUIT: \`${matchedTaxpayer.cuit}\`).\n\n`;
      
      if (totalAmount > 0) {
        answer += `Actualmente posee una **deuda consolidada de ${formatCurrency(totalAmount)}** distribuida en **${cantObligaciones} obligaciones activas** al corte de ${latestCorte}.\n\n`;
        answer += `**Desglose Tributario:**\n`;
        answer += `- 🧾 **Capital Puro**: ${formatCurrency(capitalAmount)}\n`;
        answer += `- ⚡ **Intereses Resarcitorios**: ${formatCurrency(resarcitorioAmount)}\n`;
        if (punitorioAmount > 0) {
          answer += `- ⚖️ **Intereses Punitorios**: ${formatCurrency(punitorioAmount)}\n`;
        }
        answer += `\n**Datos de Contacto e Inscripción:**\n`;
        answer += `- **Régimen**: ${matchedTaxpayer.regimen}\n`;
        answer += `- **Actividad**: ${matchedTaxpayer.actividad}\n`;
        answer += `- **Score de Cumplimiento**: \`${matchedTaxpayer.score_cumplimiento}/100\`\n`;
        answer += `- **Riesgo Fiscal**: **${matchedTaxpayer.riesgo_fiscal.toUpperCase()}**\n`;
        if (matchedTaxpayer.email) answer += `- **Email**: \`${matchedTaxpayer.email}\`\n`;
        if (matchedTaxpayer.domicilio) answer += `- **Domicilio**: ${matchedTaxpayer.domicilio}\n`;
      } else {
        answer += `🎉 ¡Excelente! **${matchedTaxpayer.nombre}** se encuentra al día y **no registra deuda tributaria activa** en el último corte de ${latestCorte}.\n\n`;
        answer += `**Detalles del perfil:**\n`;
        answer += `- **Régimen**: ${matchedTaxpayer.regimen}\n`;
        answer += `- **Riesgo Fiscal**: **${matchedTaxpayer.riesgo_fiscal.toUpperCase()}** (Score de cumplimiento: \`${matchedTaxpayer.score_cumplimiento}/100\`)\n`;
      }

      return NextResponse.json({
        intent: 'taxpayer_search',
        answer,
        card: {
          type: 'taxpayer',
          data: {
            ...matchedTaxpayer,
            total: totalAmount,
            capital: capitalAmount,
            resarcitorio: resarcitorioAmount,
            punitorio: punitorioAmount,
            obligaciones: cantObligaciones,
            activeDebts: activeDebts.slice(0, 5) // Mostrar máximo las últimas 5 deudas activas
          }
        }
      });
    }

    // 2. Detección de Deuda Total Consolidada / General
    if (
      normQuery.includes('deuda total') || 
      normQuery.includes('deuda consolidada') || 
      normQuery.includes('cuanto deba') || 
      normQuery.includes('cuanto se debe') ||
      normQuery.includes('general') ||
      normQuery.includes('agregada')
    ) {
      const statsQuery = `
        SELECT 
          SUM(ds.capital) as totalCapital,
          SUM(ds.interes_resarcitorio) as totalResarcitorio,
          SUM(ds.interes_punitorio) as totalPunitorio,
          SUM(ds.total) as totalDebt,
          COUNT(DISTINCT d.id) as activeObligationsCount
        FROM deudas_snapshots ds
        JOIN deudas d ON ds.deuda_id = d.id
        WHERE ds.corte = ? AND ds.total > 0
      `;
      const stats = db.prepare(statsQuery).get(latestCorte) as any;
      const countRow = db.prepare('SELECT COUNT(*) as count FROM contribuyentes').get() as { count: number };

      const totalDebt = stats?.totalDebt || 0;
      const totalCapital = stats?.totalCapital || 0;
      const totalResarcitorio = stats?.totalResarcitorio || 0;
      const totalPunitorio = stats?.totalPunitorio || 0;
      const activeObligations = stats?.activeObligationsCount || 0;

      const answer = `El **saldo total de deuda consolidada** administrado en la plataforma al corte de **${latestCorte}** es de **${formatCurrency(totalDebt)}**.\n\n` +
        `**Resumen General del Sistema:**\n` +
        `- 👥 **Contribuyentes en seguimiento**: **${countRow.count}**\n` +
        `- 📦 **Obligaciones con deuda activa**: **${activeObligations}**\n\n` +
        `**Composición Tributaria Consolidad:**\n` +
        `- 📊 **Capital de origen**: ${formatCurrency(totalCapital)}\n` +
        `- ⚡ **Intereses Resarcitorios**: ${formatCurrency(totalResarcitorio)}\n` +
        `- ⚖️ **Intereses Punitorios**: ${formatCurrency(totalPunitorio)}`;

      return NextResponse.json({
        intent: 'total_debt',
        answer,
        card: {
          type: 'stats',
          data: {
            totalDebt,
            totalCapital,
            totalResarcitorio,
            totalPunitorio,
            obligaciones: activeObligations,
            contribuyentes: countRow.count,
            corte: latestCorte
          }
        }
      });
    }

    // 3. Detección de Máximo Deudor / Mayor Deuda
    if (
      normQuery.includes('deudor principal') || 
      normQuery.includes('mayor deudor') || 
      normQuery.includes('mas debe') || 
      normQuery.includes('debe mas') ||
      normQuery.includes('maxima deuda')
    ) {
      const topDebtorQuery = `
        SELECT 
          c.cuit,
          c.nombre,
          c.regimen,
          c.riesgo_fiscal,
          SUM(ds.total) as total_deuda,
          COUNT(DISTINCT d.id) as cant_deudas
        FROM contribuyentes c
        JOIN deudas d ON c.cuit = d.cuit
        JOIN deudas_snapshots ds ON d.id = ds.deuda_id
        WHERE ds.corte = ? AND ds.total > 0
        GROUP BY c.cuit
        ORDER BY total_deuda DESC
        LIMIT 1
      `;
      const top = db.prepare(topDebtorQuery).get(latestCorte) as any;

      if (top) {
        const answer = `El **principal deudor consolidado** registrado en la base de datos es **${top.nombre}** (CUIT: \`${top.cuit}\`), con una deuda total activa de **${formatCurrency(top.total_deuda)}** distribuida en **${top.cant_deudas} obligaciones** vencidas.\n\n` +
          `**Detalles Clave:**\n` +
          `- **Régimen**: ${top.regimen}\n` +
          `- **Riesgo Fiscal**: **${top.riesgo_fiscal.toUpperCase()}**\n\n` +
          `_Puedes hacer clic en su nombre en la lista lateral para ingresar a su perfil y ver su evolución histórica de deudas de 30 meses._`;

        return NextResponse.json({
          intent: 'top_debtor',
          answer,
          card: {
            type: 'top_debtor',
            data: top
          }
        });
      }
    }

    // 4. Detección de Embargos
    if (
      normQuery.includes('embargo') || 
      normQuery.includes('embargados') || 
      normQuery.includes('apremio')
    ) {
      const embargosQuery = `
        SELECT cuit, nombre, usuario, regimen, riesgo_fiscal, embargos_activos 
        FROM contribuyentes 
        WHERE embargos_activos > 0
        ORDER BY embargos_activos DESC
      `;
      const list = db.prepare(embargosQuery).all() as any[];
      const count = list.reduce((acc, curr) => acc + curr.embargos_activos, 0);

      let answer = `Se han detectado **${list.length} contribuyentes con embargos activos** preventivos en el sistema, acumulando un total de **${count} medidas cautelares** vigentes:\n\n`;
      list.forEach((c) => {
        answer += `- 🛑 **${c.nombre}** (${c.regimen}) posee **${c.embargos_activos}** embargo(s) activos. (Riesgo: ${c.riesgo_fiscal.toUpperCase()})\n`;
      });

      return NextResponse.json({
        intent: 'embargos',
        answer,
        card: {
          type: 'list',
          title: 'Embargos Activos de Apremio',
          data: list
        }
      });
    }

    // 5. Detección de Riesgo Fiscal Alto / General
    if (
      normQuery.includes('riesgo') || 
      normQuery.includes('riesgo fiscal')
    ) {
      let riskFilter = '';
      if (normQuery.includes('alto')) riskFilter = 'alto';
      else if (normQuery.includes('medio')) riskFilter = 'medio';
      else if (normQuery.includes('bajo')) riskFilter = 'bajo';

      let riskQuery = `
        SELECT 
          c.cuit,
          c.nombre,
          c.regimen,
          c.riesgo_fiscal,
          SUM(ds.total) as total
        FROM contribuyentes c
        LEFT JOIN deudas d ON c.cuit = d.cuit
        LEFT JOIN deudas_snapshots ds ON d.id = ds.deuda_id AND ds.corte = ?
        ${riskFilter ? 'WHERE LOWER(c.riesgo_fiscal) = ?' : ''}
        GROUP BY c.cuit
        ORDER BY total DESC
      `;
      
      const list = riskFilter 
        ? db.prepare(riskQuery).all(latestCorte, riskFilter) 
        : db.prepare(riskQuery).all(latestCorte);

      let answer = riskFilter
        ? `Se encontraron **${list.length} contribuyentes** clasificados con **Riesgo Fiscal ${riskFilter.toUpperCase()}**:\n\n`
        : `Aquí está el resumen del **Riesgo Fiscal** y saldos consolidados de todos los contribuyentes:\n\n`;

      list.forEach((c: any) => {
        answer += `- 👤 **${c.nombre}** (Riesgo: **${c.riesgo_fiscal.toUpperCase()}**): Deuda total consolidada de **${formatCurrency(c.total || 0)}**\n`;
      });

      return NextResponse.json({
        intent: 'risk',
        answer,
        card: {
          type: 'list',
          title: riskFilter ? `Riesgo Fiscal ${riskFilter.toUpperCase()}` : 'Riesgo Fiscal Consolidado',
          data: list
        }
      });
    }

    // 6. Monotributo vs Responsable Inscripto
    if (
      normQuery.includes('monotributo') || 
      normQuery.includes('monotributistas') || 
      normQuery.includes('responsable inscripto') ||
      normQuery.includes('inscripto') ||
      normQuery.includes('responsables')
    ) {
      const isMono = normQuery.includes('monotributo') || normQuery.includes('monotributistas');
      const regimeFilter = isMono ? '%monotributo%' : '%inscripto%';

      const regimeQuery = `
        SELECT 
          c.cuit,
          c.nombre,
          c.regimen,
          c.riesgo_fiscal,
          SUM(ds.total) as total
        FROM contribuyentes c
        LEFT JOIN deudas d ON c.cuit = d.cuit
        LEFT JOIN deudas_snapshots ds ON d.id = ds.deuda_id AND ds.corte = ?
        WHERE LOWER(c.regimen) LIKE ?
        GROUP BY c.cuit
        ORDER BY total DESC
      `;
      const list = db.prepare(regimeQuery).all(latestCorte, regimeFilter) as any[];

      let answer = `Se encontraron **${list.length} contribuyentes** bajo el régimen de **${isMono ? 'Monotributo' : 'Responsable Inscripto'}**:\n\n`;
      list.forEach((c) => {
        answer += `- 👤 **${c.nombre}** (Riesgo: ${c.riesgo_fiscal.toUpperCase()}): Deuda de **${formatCurrency(c.total || 0)}**\n`;
      });

      return NextResponse.json({
        intent: 'regime',
        answer,
        card: {
          type: 'list',
          title: isMono ? 'Monotributistas' : 'Responsables Inscriptos',
          data: list
        }
      });
    }

    // 7. Próximos Vencimientos u Obligaciones Vencidas
    if (
      normQuery.includes('vence') || 
      normQuery.includes('vencimiento') || 
      normQuery.includes('obligaciones') ||
      normQuery.includes('vencidas')
    ) {
      const vencimientosQuery = `
        SELECT 
          c.nombre as contribuyente,
          d.periodo,
          d.concepto,
          d.vencimiento,
          ds.total,
          ds.estado
        FROM deudas d
        JOIN deudas_snapshots ds ON d.id = ds.deuda_id
        JOIN contribuyentes c ON d.cuit = c.cuit
        WHERE ds.corte = ? AND ds.total > 0
        ORDER BY d.vencimiento ASC
        LIMIT 8
      `;
      const list = db.prepare(vencimientosQuery).all(latestCorte) as any[];

      let answer = `Aquí tienes una lista de las **próximas obligaciones vencidas / activas con deuda** al corte ${latestCorte} ordenadas cronológicamente:\n\n`;
      list.forEach((v) => {
        answer += `- 🗓️ **${v.vencimiento}** - **${v.contribuyente}**: ${v.concepto} (Per. ${v.periodo}) - **${formatCurrency(v.total)}** [${v.estado}]\n`;
      });

      return NextResponse.json({
        intent: 'vencimientos',
        answer,
        card: {
          type: 'vencimientos',
          data: list
        }
      });
    }

    // Respuesta por defecto si no encaja en las anteriores intenciones NLP
    const defaultAnswer = `Hola, soy tu **Asistente Tributario ARCA**. Puedo ayudarte a realizar consultas complejas sobre la base de datos relacional de deudas consolidadas al corte **${latestCorte}** de forma inmediata.\n\n` +
      `**Puedes preguntarme cosas como:**\n` +
      `- 💰 *"¿Cuánto es la deuda total consolidada?"* o *"deuda general"*\n` +
      `- 👤 *"Deuda de Leandro Dominguez"* o *"datos de Camila"* (búsqueda por nombre)\n` +
      `- 🛑 *"¿Quiénes tienen embargos activos?"*\n` +
      `- 🚨 *"quien tiene mayor deuda"* o *"deudor principal"*\n` +
      `- ⚡ *"quiénes tienen riesgo fiscal alto"* o *"riesgo fiscal general"*\n` +
      `- 📋 *"Monotributistas"* o *"Responsables Inscriptos"*\n` +
      `- 🗓️ *"Vencimientos próximos"*\n\n` +
      `¡Escribe tu pregunta o haz clic en alguno de los botones rápidos de abajo!`;

    return NextResponse.json({
      intent: 'unknown',
      answer: defaultAnswer
    });

  } catch (error: any) {
    console.error('Error in interactive assistant:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
