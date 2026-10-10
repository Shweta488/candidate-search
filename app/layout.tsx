import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { SessionProvider } from "@/client/session";
import "./globals.css";

// next/font downloads the font at build time and serves it from this app.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: { default: "Candidate Search recruiter search", template: "%s · Candidate Search" },
  description: "Search candidates by describing them in plain English.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={geist.variable}>
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
