import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import QueryAssistant from "@/components/QueryAssistant";
import { getLatestCorte, getTaxpayersSummary } from "@/lib/queries";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Portal de Deudas - Monitoreo Tributario Premium",
  description: "Dashboard inteligente y auditoría del estado de deudas y saldos históricos de contribuyentes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Obtener datos del servidor
  const latestCorte = getLatestCorte();
  const taxpayers = latestCorte ? getTaxpayersSummary(latestCorte) : [];

  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-[var(--bg-main)] text-[var(--text-primary)]">
        <div className="dashboard-container">
          <div className="sidebar-layout">
            <Sidebar taxpayers={taxpayers} latestCorte={latestCorte} />
            <main className="flex flex-col gap-6 overflow-x-hidden min-h-full">
              {children}
            </main>
          </div>
        </div>
        <QueryAssistant />
      </body>
    </html>
  );
}
