import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HyperFlow Radar",
  description: "GoldRush-powered Hyperliquid smart-money and liquidation radar POC.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
