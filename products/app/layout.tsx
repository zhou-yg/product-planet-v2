import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "产品星球 2.0",
  description: "Markdown 文件管理平台",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className="h-screen overflow-hidden bg-zinc-50 text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
