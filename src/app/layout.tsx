import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "顾问决策系统",
  description: "说出你正在纠结的那件事，8位顾问帮你看清楚",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
