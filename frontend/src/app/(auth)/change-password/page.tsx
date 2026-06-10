"use client"



import { ArrowRight, Eye, EyeClosed } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useRef, useState } from "react"


import styles from "@/styles/pages/sign-in.module.css"

import ToastComponent from "@/components/toast"

import { useAuth } from "@/lib/auth-context"
import { ToastState, ToastType } from "@/types/toast"



export default function ChangePasswordPage() {
    const { signOut: logout } = useAuth()
    const router = useRouter()

    const isMountedRef = useRef(true)
    const [toast, setToast] = useState<ToastState | null>(null)
    const [loading, setLoading] = useState(false)
    const [showOld, setShowOld] = useState(false)
    const [showNew, setShowNew] = useState(false)
    const [form, setForm] = useState({
        old_password: "",
        new_password: "",
        confirm_password: "",
    })

    const showToast = useCallback((message: string, type: ToastType) => {
        if (isMountedRef.current) setToast({ message, type })
    }, [])

    const hideToast = useCallback(() => {
        if (isMountedRef.current) setToast(null)
    }, [])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(p => ({ ...p, [e.target.name]: e.target.value }))
    }

    const validate = (): boolean => {
        if (form.old_password.length < 6) {
            showToast("กรุณากรอกรหัสผ่านเดิม", "error")
            return false
        }
        if (form.new_password.length < 6) {
            showToast("รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร", "error")
            return false
        }
        if (form.new_password === form.old_password) {
            showToast("รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม", "error")
            return false
        }
        if (form.new_password !== form.confirm_password) {
            showToast("รหัสผ่านใหม่ไม่ตรงกัน", "error")
            return false
        }
        return true
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!validate()) return

        setLoading(true)
        try {
            const res = await fetch("/api/auth/change-password", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    old_password: form.old_password,
                    new_password: form.new_password,
                }),
            })

            if (!res.ok) {
                const err = await res.json().catch(() => ({}))
                throw new Error(err.detail || err.message || "เปลี่ยนรหัสผ่านไม่สำเร็จ")
            }

            showToast("เปลี่ยนรหัสผ่านสำเร็จ กรุณาเข้าสู่ระบบใหม่", "success")

            // logout แล้ว redirect หลัง toast หายไป
            setTimeout(async () => {
                await logout()
                router.replace("/sign-in")
            }, 1500)
        } catch (err) {
            showToast(err instanceof Error ? err.message : "เกิดข้อผิดพลาด", "error")
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className={styles.pageContainer}>
            {toast && <ToastComponent message={toast.message} type={toast.type} onClose={hideToast} />}

            <div className={styles.content}>
                <div className={styles.header}>
                    <h2 className={styles.title}>เปลี่ยนรหัสผ่าน</h2>
                    <p className={styles.subTitle}>กรอกรหัสผ่านเดิมและรหัสผ่านใหม่ของคุณ</p>
                </div>

                <form className={styles.form} onSubmit={handleSubmit}>
                    {/* รหัสผ่านเดิม */}
                    <div className={styles.formGroup}>
                        <label className={styles.labelLeft}>
                            รหัสผ่านเดิม <span className={styles.required}>*</span>
                        </label>
                        <div className={styles.passwordInput}>
                            <input
                                name="old_password"
                                type={showOld ? "text" : "password"}
                                value={form.old_password}
                                onChange={handleChange}
                                placeholder="กรอกรหัสผ่านเดิม"
                                disabled={loading}
                                required
                                autoComplete="current-password"
                            />
                            <button type="button" className={styles.eyeButton} onClick={() => setShowOld(p => !p)}>
                                {showOld ? <Eye className={styles.eyeIcon} /> : <EyeClosed className={styles.eyeIcon} />}
                            </button>
                        </div>
                    </div>

                    {/* รหัสผ่านใหม่ */}
                    <div className={styles.formGroup}>
                        <label className={styles.labelLeft}>
                            รหัสผ่านใหม่ <span className={styles.required}>*</span>
                        </label>
                        <div className={styles.passwordInput}>
                            <input
                                name="new_password"
                                type={showNew ? "text" : "password"}
                                value={form.new_password}
                                onChange={handleChange}
                                placeholder="อย่างน้อย 6 ตัวอักษร"
                                disabled={loading}
                                required
                                minLength={6}
                                autoComplete="new-password"
                            />
                            <button type="button" className={styles.eyeButton} onClick={() => setShowNew(p => !p)}>
                                {showNew ? <Eye className={styles.eyeIcon} /> : <EyeClosed className={styles.eyeIcon} />}
                            </button>
                        </div>
                    </div>

                    {/* ยืนยันรหัสผ่านใหม่ */}
                    <div className={styles.formGroup}>
                        <label className={styles.labelLeft}>
                            ยืนยันรหัสผ่านใหม่ <span className={styles.required}>*</span>
                        </label>
                        <div className={styles.passwordInput}>
                            <input
                                name="confirm_password"
                                type={showNew ? "text" : "password"}
                                value={form.confirm_password}
                                onChange={handleChange}
                                placeholder="กรอกรหัสผ่านใหม่อีกครั้ง"
                                disabled={loading}
                                required
                                autoComplete="new-password"
                            />
                        </div>
                    </div>

                    <button type="submit" className={styles.submitButton} disabled={loading}>
                        {loading ? (
                            <>
                                <span className={styles.spinner} />
                                กำลังเปลี่ยนรหัสผ่าน...
                            </>
                        ) : (
                            <>
                                เปลี่ยนรหัสผ่าน
                                <span className={styles.submitButtonIcon}>
                                    <ArrowRight size={16} />
                                </span>
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    )
}