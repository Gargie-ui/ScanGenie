import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "ScanGenie - Advanced Document Q&A",
  description: "A zero-cost retrieval-augmented generation document chat application.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased dark">
      <head>
        <link href="https://fonts.googleapis.com/css2?family=Geist:wght@100..900&family=Geist+Mono&display=swap" rel="stylesheet"/>
        <link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=block" rel="stylesheet"/>
      </head>
      <body className="min-h-full flex flex-col bg-[#0e0e12] text-on-surface antialiased">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
