import type { Metadata } from "next";
import Link from "next/link";
import { TimezoneProvider } from "@/components/timezone-context";
import { TimezonePicker } from "@/components/timezone-picker";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://pipefitter.fajardwnugroho.com"),
  title: "Pipefitter - Lightweight Data Pipeline",
  description: "Lightweight Data Pipeline orchestration, built for your growth data team",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon-candidate.svg", type: "image/svg+xml" },
    ],
  },
  openGraph: {
    title: "Pipefitter - Lightweight Data Pipeline",
    description: "Lightweight Data Pipeline orchestration, built for your growth data team",
    url: "https://pipefitter.fajardwnugroho.com",
    siteName: "Pipefitter",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pipefitter - Lightweight Data Pipeline",
    description: "Lightweight Data Pipeline orchestration, built for your growth data team",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <TimezoneProvider>
          <header className="flex items-center justify-between border-b px-4 py-2">
            <nav className="flex items-center gap-6">
              <Link href="/" className="text-lg font-bold tracking-tight">
                Pipefitter
              </Link>
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                Dashboard
              </Link>
              <Link
                href="/runs"
                className="text-sm text-muted-foreground hover:text-primary"
              >
                All Runs
              </Link>
            </nav>
            <TimezonePicker />
          </header>
          <main className="flex-1">{children}</main>
          <footer className="border-t py-4 text-center text-sm text-muted-foreground">
            want this on your team? go visit{" "}
            <a
              href="https://fajardwnugroho.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              fajardwnugroho.com
            </a>
          </footer>
        </TimezoneProvider>
      </body>
    </html>
  );
}
