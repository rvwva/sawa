import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mindlign — Workplace Culture & People Intelligence",
  description:
    "Mindlign helps organisations in Saudi Arabia measure, understand, and improve workplace culture and employee wellbeing.",
  keywords: ["employee wellbeing", "culture assessment", "burnout", "HR analytics", "KSA"],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Cairo:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-gray-50 text-gray-900 antialiased">{children}</body>
    </html>
  );
}
