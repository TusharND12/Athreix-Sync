import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Outfit } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: '--font-mono' });
const outfit = Outfit({ subsets: ["latin"], variable: '--font-display' });

export const metadata: Metadata = {
  title: "AthreixSync | AI Automation Studio",
  description: "An AI automation studio building custom agents, AI SaaS platforms, internal tools, and production-grade ML for teams that move fast.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} ${outfit.variable} ${inter.className} min-h-screen antialiased bg-[#0a0a0d] selection:bg-[#ff5b1f]/30`}>
        {children}
      </body>
    </html>
  );
}
