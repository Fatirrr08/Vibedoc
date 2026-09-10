import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VibeDoc - AI Architecture & Spec Generator for Vibe Coding",
  description:
    "Ubah ide mentah menjadi spesifikasi teknis dan panduan arsitektur Markdown siap pakai untuk AI Coding Assistant.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="antialiased min-h-screen bg-[#090d16] text-slate-100 selection:bg-indigo-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
