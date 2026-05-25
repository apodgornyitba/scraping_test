import db from './db';

export interface Taxpayer {
  cuit: string;
  nombre: string;
  usuario: string;
  regimen: string;
  actividad: string;
  riesgo_fiscal: string;
  score_cumplimiento: number;
  embargos_activos: number;
  mesa_fiscalizacion?: string;
  email?: string;
  agencia?: string;
  domicilio?: string;
}

export interface Stats {
  totalCapital: number;
  totalResarcitorio: number;
  totalPunitorio: number;
  totalDebt: number;
  activeObligationsCount: number;
  taxpayersCount: number;
}

export interface TaxpayerSummary extends Taxpayer {
  capital: number;
  resarcitorio: number;
  punitorio: number;
  total: number;
  cant_obligaciones: number;
}

export interface EvolutionPoint {
  corte: string;
  capital: number;
  resarcitorio: number;
  punitorio: number;
  total: number;
}

export function getLatestCorte(): string | null {
  try {
    const row = db.prepare('SELECT MAX(corte) as max_corte FROM deudas_snapshots').get() as { max_corte: string | null };
    return row?.max_corte || null;
  } catch (error) {
    console.error('Error getting latest corte:', error);
    return null;
  }
}

export function getAllTaxpayers(): Taxpayer[] {
  try {
    return db.prepare('SELECT * FROM contribuyentes ORDER BY nombre ASC').all() as Taxpayer[];
  } catch (error) {
    console.error('Error getting all taxpayers:', error);
    return [];
  }
}

export function getGeneralStats(latestCorte: string): Stats {
  try {
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
    const taxpayersCountRow = db.prepare('SELECT COUNT(*) as count FROM contribuyentes').get() as { count: number };

    return {
      totalCapital: stats?.totalCapital || 0,
      totalResarcitorio: stats?.totalResarcitorio || 0,
      totalPunitorio: stats?.totalPunitorio || 0,
      totalDebt: stats?.totalDebt || 0,
      activeObligationsCount: stats?.activeObligationsCount || 0,
      taxpayersCount: taxpayersCountRow?.count || 0
    };
  } catch (error) {
    console.error('Error getting general stats:', error);
    return {
      totalCapital: 0,
      totalResarcitorio: 0,
      totalPunitorio: 0,
      totalDebt: 0,
      activeObligationsCount: 0,
      taxpayersCount: 0
    };
  }
}

export function getTaxpayersSummary(latestCorte: string): TaxpayerSummary[] {
  try {
    const taxpayersSummaryQuery = `
      SELECT 
        c.cuit,
        c.nombre,
        c.usuario,
        c.regimen,
        c.actividad,
        c.riesgo_fiscal,
        c.score_cumplimiento,
        c.embargos_activos,
        SUM(ds.capital) as capital,
        SUM(ds.interes_resarcitorio) as resarcitorio,
        SUM(ds.interes_punitorio) as punitorio,
        SUM(ds.total) as total,
        COUNT(DISTINCT d.id) as cant_obligaciones
      FROM contribuyentes c
      LEFT JOIN deudas d ON c.cuit = d.cuit
      LEFT JOIN deudas_snapshots ds ON d.id = ds.deuda_id AND ds.corte = ?
      GROUP BY c.cuit
      ORDER BY total DESC
    `;
    const rows = db.prepare(taxpayersSummaryQuery).all(latestCorte) as any[];
    return rows.map(t => ({
      ...t,
      capital: t.capital || 0,
      resarcitorio: t.resarcitorio || 0,
      punitorio: t.punitorio || 0,
      total: t.total || 0,
      cant_obligaciones: t.total > 0 ? t.cant_obligaciones : 0
    }));
  } catch (error) {
    console.error('Error getting taxpayers summary:', error);
    return [];
  }
}

export function getGlobalEvolution(): EvolutionPoint[] {
  try {
    const evolutionQuery = `
      SELECT 
        ds.corte,
        SUM(ds.capital) as capital,
        SUM(ds.interes_resarcitorio) as resarcitorio,
        SUM(ds.interes_punitorio) as punitorio,
        SUM(ds.total) as total
      FROM deudas_snapshots ds
      GROUP BY ds.corte
      ORDER BY ds.corte ASC
    `;
    return db.prepare(evolutionQuery).all() as EvolutionPoint[];
  } catch (error) {
    console.error('Error getting global evolution:', error);
    return [];
  }
}

export function getTaxpayerDetails(cuit: string, latestCorte: string) {
  try {
    const taxpayer = db.prepare('SELECT * FROM contribuyentes WHERE cuit = ?').get(cuit) as Taxpayer;
    if (!taxpayer) return null;

    const activeDebtsQuery = `
      SELECT 
        d.id,
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
      WHERE d.cuit = ? AND ds.corte = ?
      ORDER BY d.periodo DESC, d.concepto ASC
    `;
    const activeDebts = db.prepare(activeDebtsQuery).all(cuit, latestCorte) as any[];

    const evolutionQuery = `
      SELECT 
        ds.corte,
        SUM(ds.capital) as capital,
        SUM(ds.interes_resarcitorio) as resarcitorio,
        SUM(ds.interes_punitorio) as punitorio,
        SUM(ds.total) as total,
        COUNT(DISTINCT d.id) as cant_obligaciones
      FROM deudas_snapshots ds
      JOIN deudas d ON ds.deuda_id = d.id
      WHERE d.cuit = ?
      GROUP BY ds.corte
      ORDER BY ds.corte ASC
    `;
    const evolution = db.prepare(evolutionQuery).all(cuit) as any[];

    const historyQuery = `
      SELECT 
        d.periodo,
        d.concepto,
        d.vencimiento,
        ds.corte,
        ds.capital,
        ds.interes_resarcitorio,
        ds.interes_punitorio,
        ds.total,
        ds.estado,
        ds.expediente
      FROM deudas d
      JOIN deudas_snapshots ds ON d.id = ds.deuda_id
      WHERE d.cuit = ?
      ORDER BY ds.corte DESC, d.periodo DESC
    `;
    const history = db.prepare(historyQuery).all(cuit) as any[];

    return {
      taxpayer,
      activeDebts,
      evolution,
      history
    };
  } catch (error) {
    console.error('Error getting taxpayer details:', error);
    return null;
  }
}
