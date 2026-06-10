"use client"



import Link from "next/link"

import { ArrowLeft, ArrowRight } from "lucide-react"
import { useCallback, useRef, useState } from "react"

import styles from "@/styles/pages/sign-in.module.css"   // ใช้ style เดียวกับ sign-in

import ToastComponent from "@/components/toast"

import { ToastState, ToastType } from "@/types/toast"



export default function ForgotPasswordPage() {
    const isMountedRef = useRef(true)
    const [toast, setToast] = useState<ToastState | null>(null)
    const [username, setUsername] = useState("")
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    const showToast = useCallback((message: string, type: ToastType) => {
        if (isMountedRef.current) setToast({ message, type })
    }, [])

    const hideToast = useCallback(() => {
        if (isMountedRef.current) setToast(null)
    }, [])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (username.trim().length < 3) {
            showToast("กรุณากรอกชื่อผู้ใช้งานให้ถูกต้อง", "error")
            return
        }

        setLoading(true)

        try {
            const res = await fetch("/api/auth/forgot-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username: username.trim() }),
            })

            // ตอบ success เสมอ ไม่ว่า username จะมีอยู่หรือไม่
            // เพื่อป้องกัน username enumeration
            if (!res.ok && res.status !== 200) {
                // ถ้า 500 ถึงจะ error
                throw new Error("เกิดข้อผิดพลาด กรุณาลองใหม่")
            }

            setSubmitted(true)
        } catch (err) {
            showToast(err instanceof Error ? err.message : "เกิดข้อผิดพลาด กรุณาลองใหม่", "error")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.pageContainer}>
            {toast && <ToastComponent message={toast.message} type={toast.type} onClose={hideToast} />}

            <div className={styles.content}>

                {!submitted ? (
                    <>
                        <div className={styles.header}>
                            <h2 className={styles.title}>ลืมรหัสผ่าน</h2>
                            <p className={styles.subTitle}>กรอกชื่อผู้ใช้งานเพื่อส่งคำขอรีเซ็ตรหัสผ่าน</p>
                        </div>

                        <form className={styles.form} onSubmit={handleSubmit}>
                            <div className={styles.formGroup}>
                                <label className={styles.labelLeft}>
                                    ชื่อผู้ใช้งาน <span className={styles.required}>*</span>
                                </label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={e => setUsername(e.target.value)}
                                    placeholder="กรอกชื่อผู้ใช้งานของคุณ"
                                    disabled={loading}
                                    required
                                    autoComplete="username"
                                    maxLength={50}
                                />
                            </div>

                            <button
                                type="submit"
                                className={styles.submitButton}
                                disabled={loading}
                            >
                                {loading ? (
                                    <>
                                        <span className={styles.spinner} />
                                        กำลังส่งคำขอ...
                                    </>
                                ) : (
                                    <>
                                        ส่งคำขอรีเซ็ตรหัสผ่าน
                                        {/* <span className={styles.submitButtonIcon}>
                                            <ArrowRight size={16} />
                                        </span> */}
                                    </>
                                )}
                            </button>
                        </form>

                        <div className={styles.divider}>
                            <span>หรือ</span>
                        </div>
                    </>
                ) : (
                    <div className={styles.header}>
                        <h2 className={styles.title}>ส่งคำขอสำเร็จ</h2>
                        <p className={styles.subTitle}>
                            คำขอรีเซ็ตรหัสผ่านถูกส่งแล้ว
                            <br />
                            กรุณาติดต่อ <strong>ผู้ดูแลระบบ</strong> เพื่อเปิดใช้งานบัญชีของคุณ
                        </p>
                    </div>
                )}

                <p className={styles.signUpText}>
                    กลับไปยัง{" "}
                    <Link href="/sign-in" className={styles.signUpLink}>
                        เข้าสู่ระบบ?
                    </Link>
                </p>
            </div>
        </div>
    )
}