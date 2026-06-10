export enum UserRole {
  USER = "user",
  ADMIN = "admin",
  SUPERADMIN = "superadmin"
}



export interface UserCredentials {
  username: string;
  password: string;
}



export interface SignUpFormData {
  username: string
  password: string
  confirm_password: string
}



export interface SignUpResponse {
  id: number
  username: string
  role: UserRole
  is_active: boolean
  is_first_user: boolean
}



export interface SignUpData {
  username: string;
  password: string;
}



export interface User {
  id: number
  username: string
  role: UserRole
  is_active: boolean
  created_at: string
}



export interface AuthResponse {
  access_token?: string
  token_type?: string
  force_password_change?: boolean
}