import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8fc",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://zhimai-hr.online"),
  title: "招聘需求监控中心",
  description: "多人共享新增、筛选和编辑招聘需求，并让 AI 助手结合 74 个历史 Offer 与 Cooper 近期信号分析岗位策略。",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "招聘需求监控中心",
    description: "多人共享新增、筛选和编辑需求，结合历史 Offer 与 Cooper 近期信号，向招聘策略 AI 助手提问。",
    images: [{ url: "/og-ai-assistant-v4.png", width: 1734, height: 907, alt: "招聘需求筛选与招聘策略 AI 助手" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "招聘需求监控中心",
    description: "多人共享新增、筛选和编辑需求，结合历史 Offer 与 Cooper 近期信号，向招聘策略 AI 助手提问。",
    images: ["/og-ai-assistant-v4.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
