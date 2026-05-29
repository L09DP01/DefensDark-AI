import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { GlobalStateProvider } from "./contexts/GlobalState";
import { ConvexClientProvider } from "@/components/ConvexClientProvider";
import { TodoBlockProvider } from "./contexts/TodoBlockContext";
import { PostHogProvider } from "./providers";
import { DataStreamProvider } from "./components/DataStreamProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const APP_NAME = "DefensDark AI";
const APP_DEFAULT_TITLE = "DefensDark AI - AI-Powered Cyber Defense Platform";
const APP_TITLE_TEMPLATE = "%s | DefensDark AI";
const APP_DESCRIPTION =
  "DefensDark AI is an AI-powered cyber defense platform that helps you secure systems, scan targets, analyze vulnerabilities, and write reports faster.";

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: "%s",
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  keywords: [
    "defensdark-ai",
    "defensdark ai",
    "cyber defense platform",
    "pentestgpt",
    "pentest ai",
    "penetration testing tool",
    "penetration testing ai",
    "hacking ai",
    "pentesting ai",
    "pentest automation",
    "security assessment ai",
    "vulnerability scanner ai",
    "offensive security ai",
    "red team ai",
    "cybersecurity ai assistant",
    "bug bounty ai",
    "pentest gpt",
    "security ai",
  ],
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
    images: [
      {
        url: "https://defensdark-ai.co/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "DefensDark AI",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: {
      default: APP_DEFAULT_TITLE,
      template: APP_TITLE_TEMPLATE,
    },
    description: APP_DESCRIPTION,
    images: [
      {
        url: "https://defensdark-ai.co/icon-512x512.png",
        width: 512,
        height: 512,
        alt: "DefensDark AI",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const content = (
    <GlobalStateProvider>
      <PostHogProvider>
        <DataStreamProvider>
          <TodoBlockProvider>
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
          </TodoBlockProvider>
        </DataStreamProvider>
      </PostHogProvider>
    </GlobalStateProvider>
  );

  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <head>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased h-full`}
      >
        <ConvexClientProvider>{content}</ConvexClientProvider>
      </body>
    </html>
  );
}
