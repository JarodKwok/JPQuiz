import type { Metadata } from "next";
import "./globals.css";
import AppShell from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "大家的日语 AI陪练版",
  description: "《大家的日语》初级1 AI陪练——词汇、语法、课文、例句全覆盖",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🌸</text></svg>",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
