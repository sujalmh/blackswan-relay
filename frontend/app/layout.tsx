import type { Metadata } from "next";
import { Instrument_Serif, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-instrument-serif",
  display: "swap",
});

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BlackSwan Relay — recapitalize without the signal",
  description:
    "Private rescue-yield market on Sepolia. Commitments via private mempool, aggregate proof sum≥T, explorer shows only RescueTargetMet + hashes. No amounts leak.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${instrumentSerif.variable} ${geistSans.variable} ${geistMono.variable} min-h-screen bg-[#FFFCF5] font-sans text-[#0F0F10] antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
