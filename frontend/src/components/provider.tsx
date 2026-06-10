"use client"



import { ReactNode } from "react"

import { AuthProvider } from "@/lib/auth-context"



export default function ProviderComponent({ children }: { children: ReactNode }) {
    return <AuthProvider>{children}</AuthProvider>
}
