import type { Metadata, Viewport } from "next";
import { Besley, DM_Mono } from "next/font/google";
import "./globals.css";

const display = Besley({ subsets: ["latin", "latin-ext"], weight: ["400"], variable: "--font-display" });
const body = DM_Mono({ subsets: ["latin", "latin-ext"], weight: ["400", "500"], variable: "--font-body" });

export const metadata: Metadata = {
  title: "Mandarin lessons",
  description: "Lesson notes, homework and vocabulary",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#f5d6a0" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>{children}</body>
    </html>
  );
}
