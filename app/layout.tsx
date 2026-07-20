import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HomeBuy Agent",
  description: "AI-assisted home search and affordability ranking"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
