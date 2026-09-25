import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lencord',
  description: 'Plataforma P2P de préstamos colectivos orientada a PyMEs argentinas',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
