import type { ReactNode } from "react";
import { Archivo, Familjen_Grotesk } from "next/font/google";
import "./globals.css";

const display = Familjen_Grotesk({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const body = Archivo({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata = {
  title: "SellAI",
  description: "AI sales desk for social-commerce vendors",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${display.variable} ${body.variable}`}
    >
      <body className="font-(family-name:--font-body) antialiased bg-bground">
        {children}
      </body>
    </html>
  );
}
