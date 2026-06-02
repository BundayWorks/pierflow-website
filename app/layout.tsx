import type { Metadata } from "next";
import { Inter, Inter_Tight, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import {
  ConditionalNav,
  ConditionalFooter,
  ConditionalMainPadding,
} from "@/components/layout/ConditionalChrome";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const interTight = Inter_Tight({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pierflow — The connectivity layer for healthcare in Africa",
  description:
    "AI-native health data infrastructure. Move data, coverage, payments, records, and referrals across every player in African healthcare.",
  metadataBase: new URL("https://www.pierflow.com"),
  openGraph: {
    title: "Pierflow",
    description:
      "The connectivity layer for healthcare in Africa. AI-native API-first health data infrastructure.",
    url: "https://www.pierflow.com",
    siteName: "Pierflow",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${interTight.variable} ${jetbrains.variable} font-sans antialiased bg-white text-textl-primary`}
      >
        <ConditionalNav />
        <ConditionalMainPadding>{children}</ConditionalMainPadding>
        <ConditionalFooter />
        <Script id="ms-clarity" strategy="afterInteractive">
          {`(function(c,l,a,r,i,t,y){
            c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
            t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
            y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "x0ehm4tne8");`}
        </Script>
      </body>
    </html>
  );
}
