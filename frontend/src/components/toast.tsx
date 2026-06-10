import { CircleAlert, CircleCheck, CircleX, Info, X } from "lucide-react"
import { useEffect } from "react"

import styles from "@/styles/components/toast.module.css"



interface ToastProps {
    message: string
    type?: "error" | "success" | "warning" | "info"
    onClose: () => void
    duration?: number
}



export default function ToastComponent({ message, type = "error", onClose, duration = 5000 }: ToastProps) {
    useEffect(() => {
        if (duration > 0) {
            const timer = setTimeout(() => {
                onClose()
            }, duration)

            return () => clearTimeout(timer)
        }
    }, [duration, onClose])


    const getIcon = () => {
        switch (type) {
            case "info":
                return <Info className={styles.icon} />
            case "success":
                return <CircleCheck className={styles.icon} />
            case "warning":
                return <CircleAlert className={styles.icon} />
            case "error":
                return <CircleX className={styles.icon} />
        }
    }


    return (
        <div className={styles.toastOverlay}>
            <div className={`${styles.toast} ${styles[type]}`}>
                <div className={styles.progressBar}>
                    <div className={styles.progressFill} />
                </div>

                <div className={styles.toastIcon}>
                    {getIcon()}
                </div>

                <div className={styles.toastMessage}>
                    {message}
                </div>

                <button
                    className={styles.toastClose}
                    onClick={onClose}
                    aria-label="ปิด"                >
                    <X className={styles.closeIcon} />
                </button>
            </div>
        </div>
    )
}