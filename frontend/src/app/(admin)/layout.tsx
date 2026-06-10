"use client"



import { useRouter } from "next/navigation"
import { useEffect } from "react"

import LayoutClientComponent from "@/components/layout/layout-client"

import { useAuth } from "@/lib/auth-context"
import { UserRole } from "@/types/auth"



export default function AdminLayout({
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

        if (
            user.role !== UserRole.ADMIN &&
            user.role !== UserRole.SUPERADMIN
        ) {
            router.replace("/")
        }
    }, [user, loading, router])

    if (loading || !user) return null

    return (
        <LayoutClientComponent role={user.role}>
            {children}
        </LayoutClientComponent>
    )
}