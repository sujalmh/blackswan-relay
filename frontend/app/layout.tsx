import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlackSwan Relay — recapitalize without the signal",
  description: "Private rescue-yield market on Sepolia. Commitments via private mempool, aggregate proof sum≥T, explorer shows only RescueTargetMet + hashes.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#fafafb] text-zinc-900">
        {children}
      </body>
    </html>
  );
}
