import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Copy Chain Studio",
  description: "A minimal floating canvas for rewriting copy with AI.",
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
