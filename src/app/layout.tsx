import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AthreixSync | Share Like The Future Is Already Here",
  description: "The world's smartest, fastest, and most futuristic file sharing ecosystem where files move seamlessly between people, devices, and teams using AI, peer-to-peer networking, and spatial computing concepts.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.className} min-h-screen antialiased bg-[#050505] selection:bg-purple-500/30`}>
        {children}
      </body>
    </html>
  );
}
