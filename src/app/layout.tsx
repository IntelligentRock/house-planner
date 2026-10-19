import type { Metadata, Viewport } from "next";
import { Figtree, Fraunces } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HOUSE_NAME } from "@/lib/constants";
import "./globals.css";

const figtree = Figtree({ variable: "--font-figtree", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz", "SOFT"] });

export const metadata: Metadata = {
  title: { default: HOUSE_NAME, template: `%s · ${HOUSE_NAME}` },
  description: `Bookings for ${HOUSE_NAME}, for family members only.`,
  robots: { index: false, follow: false },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#f6f2ea",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NL" className={`${figtree.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="min-h-full">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster position="bottom-right" theme="light" richColors={false} closeButton />
      </body>
    </html>
  );
}
