import type { Metadata } from "next";
import { DownloadPageContent } from "./DownloadPageContent";

export const metadata: Metadata = {
  title: "Download | DefensDark AI",
  description:
    "Download DefensDark AI for macOS, Windows, Linux, iOS, and Android. AI-powered cyber defense platform at your fingertips.",
  openGraph: {
    title: "Download DefensDark AI",
    description:
      "Download DefensDark AI for macOS, Windows, Linux, iOS, and Android. AI-powered cyber defense platform at your fingertips.",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Download DefensDark AI",
    description:
      "Download DefensDark AI for macOS, Windows, Linux, iOS, and Android. AI-powered cyber defense platform at your fingertips.",
  },
};

export default function DownloadPage() {
  return <DownloadPageContent />;
}
