import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "jelly studio planner",
  description: "Internal production planning prototype for jelly objects"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
