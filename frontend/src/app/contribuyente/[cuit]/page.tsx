import React from 'react';
import { notFound } from 'next/navigation';
import { getLatestCorte, getTaxpayerDetails } from '@/lib/queries';
import TaxpayerProfileClient from '@/components/TaxpayerProfileClient';

interface TaxpayerPageProps {
  params: Promise<{
    cuit: string;
  }>;
}

export const dynamic = 'force-dynamic';

export default async function TaxpayerPage({ params }: TaxpayerPageProps) {
  const { cuit } = await params;
  const latestCorte = getLatestCorte();

  if (!latestCorte) {
    return (
      <div className="glass-panel p-8 text-center flex flex-col items-center justify-center min-h-[300px]">
        <h2 className="text-xl font-bold text-white mb-2">No hay datos en la Base de Datos</h2>
        <p className="text-[var(--text-muted)] max-w-md">
          El scraper aún se encuentra en ejecución o no se han guardado registros en la base de datos `arca.db`.
        </p>
      </div>
    );
  }

  const details = getTaxpayerDetails(cuit, latestCorte);

  if (!details) {
    notFound();
  }

  return (
    <TaxpayerProfileClient
      taxpayer={details.taxpayer}
      activeDebts={details.activeDebts}
      evolution={details.evolution}
      history={details.history}
      latestCorte={latestCorte}
    />
  );
}
