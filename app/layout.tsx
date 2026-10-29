import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "SellAI",
  description: "AI sales desk for social-commerce vendors",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
