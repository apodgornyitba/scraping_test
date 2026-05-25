import { NextResponse } from 'next/server';
import { getAllTaxpayers } from '@/lib/queries';

export async function GET() {
  try {
    const rows = getAllTaxpayers();
    return NextResponse.json(rows);
  } catch (error: any) {
    console.error('Error fetching taxpayers:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
