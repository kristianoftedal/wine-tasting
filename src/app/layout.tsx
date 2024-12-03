import type { Metadata } from "next";
import "./globals.css";
import "beercss";
import "material-dynamic-colors";

export const metadata: Metadata = {
  title: "Vinklubb",
  description: "lag en vinklubb idag!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="dark">
        {children}
      </body>
    </html>
  );
}
