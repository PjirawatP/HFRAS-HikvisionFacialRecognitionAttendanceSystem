"use client"



import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react"

import { UserCredentials, SignUpData, User, AuthResponse, SignUpResponse } from "@/types/auth"
import { apiClient } from "@/lib/api-client"



interface AuthContextType {
    user: User | null
    authLoading: boolean
    signIn: (credentials: UserCredentials) => Promise<AuthResponse>
    signUp: (data: SignUpData) => Promise<SignUpResponse>
    signOut: () => Promise<void>
    refetchUser: () => Promise<void>
}



const AuthContext = createContext<AuthContextType | undefined>(undefined)



export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null)
    const [authLoading, setAuthLoading] = useState<boolean>(true)


    const fetchUser = useCallback(async () => {
        try {
            const userData = await apiClient.getMe()

            setUser(userData)
        } catch {
            setUser(null)
        } finally {
            setAuthLoading(false)
        }
    }, [])

    useEffect(() => {
        fetchUser()
    }, [fetchUser])


    const signIn = async (credentials: UserCredentials) => {
        const result = await apiClient.signIn(credentials)

        await fetchUser()

        return result
    }



    const signUp = async (data: SignUpData): Promise<SignUpResponse> => {
        return await apiClient.signUp(data)
    }



    const signOut = async () => {
        await apiClient.signOut()

        setUser(null)
    }


    const refetchUser = async () => {
        await fetchUser()
    }


    return (
        <AuthContext.Provider
            value={{ user, authLoading: authLoading, signIn, signUp, signOut, refetchUser }}
        >
            {children}
        </AuthContext.Provider>
    )
}



export function useAuth() {
    const context = useContext(AuthContext)

    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider")
    }

    return context
}