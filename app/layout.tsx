import type { Metadata } from "next"
import localFont from "next/font/local"
import { Providers } from "./ui/providers"
import "./globals.css"

const serif = localFont({
  src: [
    { path: "./fonts/instrument-serif.woff2", weight: "400", style: "normal" },
    { path: "./fonts/instrument-serif-italic.woff2", weight: "400", style: "italic" },
  ],
  variable: "--font-serif",
})
const sans = localFont({ src: "./fonts/geist.woff2", weight: "100 900", variable: "--font-sans" })
const mono = localFont({ src: "./fonts/geist-mono.woff2", weight: "100 900", variable: "--font-mono" })

export const metadata: Metadata = {
  title: "Sartoria",
  description: "Dal bozzetto al video: render 3D, immagini prodotto, indossato e UGC con la stessa identità del capo.",
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
