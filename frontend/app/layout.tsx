import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NEUROVERSE AI — 3D Neurosurgical Digital Twin & Interactive Simulation',
  description: 'Browser-based Causal AI surgical digital twin built with Three.js, MONAI, and Pearl Do-Calculus.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#080c14] text-slate-100 antialiased overflow-hidden select-none">
        {children}
      </body>
    </html>
  );
}
