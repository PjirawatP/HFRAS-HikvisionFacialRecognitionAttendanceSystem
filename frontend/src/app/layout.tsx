import type { Metadata } from "next"
import { Kanit } from "next/font/google"

import "@/styles/globals.css"

import ProviderComponent from "@/components/provider"



export const kanit = Kanit({
  subsets: ["thai", "latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-heading",
  display: "swap"
})



export const metadata: Metadata = {
  title: "FDAR System",
  description: "Facial detection and recognition system"
}



export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="th">
      <body className={kanit.variable}>
        <ProviderComponent>
          {children}
        </ProviderComponent>
      </body>
    </html>
  )
}