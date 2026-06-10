import { UserCredentials, SignUpData, AuthResponse, User, SignUpResponse } from "@/types/auth"



class ApiClient {
    private async request<T>(
        url: string,
        options: RequestInit = {}
    ): Promise<T> {
        const res = await fetch(url, {
            ...options,
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...(options.headers || {})
            }
        })

        if (!res.ok) {
            let message = "request failed"

            try {
                const error = await res.json();

                message = error.detail || error.message || message
            } catch { }

            throw new Error(message)
        }

        return res.json()
    }


    signIn(credentials: UserCredentials): Promise<AuthResponse> {
        return this.request<AuthResponse>("/api/auth/sign-in", {
            method: "POST",
            body: JSON.stringify(credentials)
        })
    }


    signUp(data: SignUpData): Promise<SignUpResponse> {
        return this.request<SignUpResponse>("/api/auth/sign-up", {
            method: "POST",
            body: JSON.stringify(data)
        })
    }


    signOut(): Promise<void> {
        return this.request<void>("/api/auth/sign-out", {
            method: "POST"
        })
    }


    getMe(): Promise<User> {
        return this.request<User>("/api/auth/get-me");
    }
}



export const apiClient = new ApiClient()