import type { Metadata, Viewport } from 'next';
import '../src/styles.css';
import '../src/site.css';

export const metadata: Metadata = {
  title: { default: 'GraficAI', template: '%s · GraficAI' },
  description: 'Do manuscrito ao caderno fechado: laudas, cadernos, custo de impressão e o livro composto.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

// Aplica o tema salvo antes da primeira pintura (sem piscar).
const themeScript = `try{var t=localStorage.getItem('graficai-theme');if(t!=='light'&&t!=='dark'){t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
