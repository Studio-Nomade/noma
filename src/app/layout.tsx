import type { Metadata } from "next";
import { DM_Sans, Poppins } from "next/font/google";
import { AmbientBackground } from "@/components/layout/ambient-background";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Noma · Studio Nomade",
    template: "%s · Noma",
  },
  description:
    "Plataforma interna de Studio Nomade. Clientes, proyectos, briefs, propuestas y servicios en un solo lugar.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning: next-themes escribe la clase del tema en <html>
    // antes de la hidratación; sin esto React reporta el mismatch.
    <html
      lang="es"
      suppressHydrationWarning
      className={`${dmSans.variable} ${poppins.variable} h-full antialiased`}
    >
      <body className="text-foreground flex min-h-full flex-col">
        <ThemeProvider>
          <AmbientBackground />
          <TooltipProvider>{children}</TooltipProvider>
          <Toaster position="top-right" />
        </ThemeProvider>
      </body>
    </html>
  );
}
