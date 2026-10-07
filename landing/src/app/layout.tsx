import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import "lenis/dist/lenis.css";
import "./globals.css";

import SmoothScroll from "@/components/smooth-scroll";
import { site } from "@/content/site";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: site.title,
  description: site.description,
  applicationName: site.name,
  openGraph: { title: site.title, description: site.description, siteName: site.name, type: "website" },
  twitter: { card: "summary_large_image", title: site.title, description: site.description },
};

export const viewport: Viewport = { themeColor: "#08090a", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  );
}
