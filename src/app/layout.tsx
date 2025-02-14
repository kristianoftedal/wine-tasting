import "beercss";
import "beercss/dist/cdn/beer";
import "material-dynamic-colors";
import type { Metadata } from "next";
import "./globals.css";
import { Provider } from "./provider";

export const metadata: Metadata = {
  title: "Smak på vin",
  description: "smak på en vin idag!",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  debugger;
  return (
    <html lang="en">
      <Provider>
        <body className="light">
          <main className="responsive">{children}</main>
        </body>
      </Provider>
    </html>
  );
}
