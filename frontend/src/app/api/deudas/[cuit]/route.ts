import { NextResponse } from 'next/server';
import { getLatestCorte, getTaxpayerDetails } from '@/lib/queries';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cuit: string }> }
) {
  try {
    const { cuit } = await params;
    const latestCorte = getLatestCorte();

    if (!latestCorte) {
      return NextResponse.json({ error: 'No hay datos disponibles' }, { status: 404 });
    }

    const data = getTaxpayerDetails(cuit, latestCorte);
    if (!data) {
      return NextResponse.json({ error: 'Contribuyente no encontrado' }, { status: 404 });
    }

    return NextResponse.json({
      latestCorte,
      ...data
    });
  } catch (error: any) {
    console.error('Error fetching taxpayer details:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
