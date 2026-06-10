export type ToastType = "info" | "success" | "warning" | "error"



export interface ToastState {
    message: string
    type: ToastType
}