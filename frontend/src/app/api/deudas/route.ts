import { NextResponse } from 'next/server';
import { getLatestCorte, getGeneralStats, getTaxpayersSummary, getGlobalEvolution } from '@/lib/queries';

export async function GET() {
  try {
    const latestCorte = getLatestCorte();
    if (!latestCorte) {
      return NextResponse.json({
        latestCorte: null,
        stats: { totalCapital: 0, totalResarcitorio: 0, totalPunitorio: 0, totalDebt: 0, activeObligationsCount: 0, taxpayersCount: 0 },
        taxpayersSummary: [],
        evolution: []
      });
    }

    const stats = getGeneralStats(latestCorte);
    const taxpayersSummary = getTaxpayersSummary(latestCorte);
    const evolution = getGlobalEvolution();

    return NextResponse.json({
      latestCorte,
      stats,
      taxpayersSummary,
      evolution
    });
  } catch (error: any) {
    console.error('Error fetching debt details:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
