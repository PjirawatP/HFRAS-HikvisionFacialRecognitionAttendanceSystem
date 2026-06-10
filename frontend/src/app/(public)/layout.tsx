"use client"



import { useRouter } from "next/navigation"
import { useEffect } from "react"

import { useAuth } from "@/lib/auth-context"
import { UserRole } from "@/types/auth"



export default function PublicLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const { user, authLoading: loading } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (loading) return

        if (!user) {
            router.replace("/sign-in")
            return
        }
    }, [user, loading, router])

    if (loading || !user) return null

    return <>{children}</>
}
