import { UserRole } from "./auth"



export interface UserData {
    id: number
    username: string
    role: UserRole
    is_active: boolean
    is_locked: boolean
    reset_requested_at: string
    locked_at: string
    created_at: string
    updated_at: string
}



export interface UserFormData {
    id?: number
    username: string
    password?: string
    role: string
    is_active?: boolean
}