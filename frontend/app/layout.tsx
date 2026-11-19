import type { Metadata } from "next";
import "./globals.css";

// Google AdSense publisher ID. The account is verified on edsol.academy (AdSense
// only accepts the root domain); ads are shown on this site only. Auto ads are
// placed by Google; consent for the EEA, UK and Switzerland comes from Google's
// own consent message (AdSense > Privacy & messaging), which this script loads.
const ADSENSE_CLIENT = "ca-pub-7059764586079379";

export const metadata: Metadata = {
  title: "TalkMate",
  other: { "google-adsense-account": ADSENSE_CLIENT },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* A plain async tag: next/script adds a data-nscript attribute AdSense warns about. */}
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      </head>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
