import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Candidate Search recruiter search",
  description: "Search candidates by describing them in plain English.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
