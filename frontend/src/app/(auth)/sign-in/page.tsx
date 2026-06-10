"use client"



import Link from "next/link"

import { ArrowRight, Eye, EyeClosed } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import styles from "@/styles/pages/sign-in.module.css"

import ToastComponent from "@/components/toast"

import { useAuth } from "@/lib/auth-context"
import { ToastState, ToastType } from "@/types/toast"



// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_SIGN_IN_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000
const STORAGE_KEY_ATTEMPTS = "sia_attempts"
const STORAGE_KEY_LOCKOUT = "sia_lockout_until"



// ─── Helpers ──────────────────────────────────────────────────────────────────
type ErrorClassification = {
    message: string
    /** true = wrong credentials (count against user), false = account/server issue */
    isUserFault: boolean
}


function classifyError(err: unknown): ErrorClassification {
    if (err instanceof Error) {
        const msg = err.message.toLowerCase()

        if (msg.includes("not yet activated") || msg.includes("403"))
            return {
                message: "บัญชียังไม่ได้รับการเปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ",
                isUserFault: false,
            }

        if (msg.includes("locked"))
            return {
                message: "บัญชีถูกล็อค กรุณาติดต่อผู้ดูแลระบบ",
                isUserFault: false,
            }

        if (
            msg.includes("500") ||
            msg.includes("502") ||
            msg.includes("503") ||
            msg.includes("server error") ||
            msg.includes("network")
        )
            return {
                message: "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ กรุณาลองใหม่ภายหลัง",
                isUserFault: false,
            }
    }

    return {
        message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
        isUserFault: true,
    }
}


function validateForm(username: string, password: string): string | null {
    if (username.length < 3 || username.length > 50)
        return "ชื่อผู้ใช้ต้องมีความยาว 3-50 ตัวอักษร"
    if (!/^[a-zA-Z0-9_]+$/.test(username))
        return "ชื่อผู้ใช้สามารถใช้ได้เฉพาะตัวอักษร ตัวเลข และ _"
    if (password.length < 6)
        return "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร"
    return null
}


function formatTime(ms: number): string {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, "0")}`
}



// ─── Persistent lockout helpers ───────────────────────────────────────────────
function getLockoutRemaining(): number {
    try {
        const until = Number(localStorage.getItem(STORAGE_KEY_LOCKOUT) ?? 0)
        const remaining = until - Date.now()
        return remaining > 0 ? remaining : 0
    } catch {
        return 0
    }
}


function getStoredAttempts(): number {
    try {
        // Clear attempts if lockout has already expired
        if (getLockoutRemaining() === 0) {
            const until = Number(localStorage.getItem(STORAGE_KEY_LOCKOUT) ?? 0)
            if (until > 0 && until <= Date.now()) clearLockout()
        }
        return Number(localStorage.getItem(STORAGE_KEY_ATTEMPTS) ?? 0)
    } catch {
        return 0
    }
}


function setLockout() {
    try {
        localStorage.setItem(STORAGE_KEY_LOCKOUT, String(Date.now() + LOCKOUT_DURATION_MS))
        localStorage.setItem(STORAGE_KEY_ATTEMPTS, String(MAX_SIGN_IN_ATTEMPTS))
    } catch { }
}


function clearLockout() {
    try {
        localStorage.removeItem(STORAGE_KEY_LOCKOUT)
        localStorage.removeItem(STORAGE_KEY_ATTEMPTS)
    } catch { }
}


function incrementStoredAttempts(): number {
    try {
        const next = getStoredAttempts() + 1
        localStorage.setItem(STORAGE_KEY_ATTEMPTS, String(next))
        return next
    } catch {
        return 1
    }
}



export default function SignInPage() {
    const { signIn } = useAuth()
    const router = useRouter()

    // Tracks if component is still mounted to prevent setState after unmount
    const isMountedRef = useRef(true)
    const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

    const [toast, setToast] = useState<ToastState | null>(null)
    const [formData, setFormData] = useState({ username: "", password: "" })
    const [loading, setLoading] = useState(false)
    const [showPassword, setShowPassword] = useState(false)

    // Lockout state — initialised from localStorage so it survives refresh
    const [remainingTime, setRemainingTime] = useState<number>(() => getLockoutRemaining())

    const isLocked = remainingTime > 0

    // ── Cleanup on unmount ──────────────────────────────────────────────────────
    useEffect(() => {
        isMountedRef.current = true
        return () => {
            isMountedRef.current = false
            if (redirectTimerRef.current) clearTimeout(redirectTimerRef.current)
            if (countdownRef.current) clearInterval(countdownRef.current)
        }
    }, [])

    // ── Countdown ticker ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isLocked) return

        countdownRef.current = setInterval(() => {
            const remaining = getLockoutRemaining()
            if (!isMountedRef.current) return

            setRemainingTime(remaining)

            if (remaining <= 0) {
                clearLockout()
                clearInterval(countdownRef.current!)
                countdownRef.current = null
            }
        }, 1000)

        return () => {
            if (countdownRef.current) clearInterval(countdownRef.current)
        }
    }, [isLocked])

    // ── Toast helpers ───────────────────────────────────────────────────────────
    const showToast = useCallback((message: string, type: ToastType) => {
        if (isMountedRef.current) setToast({ message, type })
    }, [])

    const hideToast = useCallback(() => {
        if (isMountedRef.current) setToast(null)
    }, [])

    // ── Input change ────────────────────────────────────────────────────────────
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormData(prev => ({ ...prev, [name]: value }))
    }

    // ── Submit ──────────────────────────────────────────────────────────────────
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (isLocked) {
            showToast(
                `คุณพยายามเข้าสู่ระบบหลายครั้งเกินไป กรุณารออีก ${formatTime(remainingTime)}`,
                "error"
            )
            return
        }

        const validationError = validateForm(formData.username, formData.password)
        if (validationError) {
            showToast(validationError, "error")
            return
        }

        setLoading(true)

        try {
            const result = await signIn({
                username: formData.username,
                password: formData.password,
            })

            // Success → clear any stored attempts
            clearLockout()

            if (result.force_password_change) {
                showToast("กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานระบบ", "success")
                redirectTimerRef.current = setTimeout(() => {
                    if (isMountedRef.current) router.replace("/change-password")
                }, 1000)
            } else {
                showToast("เข้าสู่ระบบสำเร็จ", "success")
                redirectTimerRef.current = setTimeout(() => {
                    if (isMountedRef.current) router.push("/")
                }, 1000)
            }
        } catch (err) {
            const { message, isUserFault } = classifyError(err)

            if (isUserFault) {
                const newAttempts = incrementStoredAttempts()

                if (newAttempts >= MAX_SIGN_IN_ATTEMPTS) {
                    setLockout()
                    setRemainingTime(LOCKOUT_DURATION_MS)
                    showToast("คุณพยายามลงชื่อเข้าใช้ผิดหลายครั้งเกินไป กรุณารอ 15 นาที", "error")
                } else {
                    showToast(
                        `${message} (เหลืออีก ${MAX_SIGN_IN_ATTEMPTS - newAttempts} ครั้ง)`,
                        "error"
                    )
                }
            } else {
                showToast(message, "error")
            }
        } finally {
            if (isMountedRef.current) setLoading(false)
        }
    }

    // ── Render ──────────────────────────────────────────────────────────────────
    return (
        <div className={styles.pageContainer}>
            {toast && <ToastComponent {...toast} onClose={hideToast} />}

            <div className={styles.content}>
                <div className={styles.header}>
                    <h1 className={styles.title}>เข้าสู่ระบบ</h1>
                    <p className={styles.subTitle}>กรอกชื่อผู้ใช้งานและรหัสผ่านเพื่อเข้าสู่ระบบ</p>
                </div>

                <form onSubmit={handleSubmit} className={styles.form} noValidate>
                    {/* Username */}
                    <div className={styles.formGroup}>
                        <div className={styles.formGroupHeader}>
                            <label htmlFor="username" className={styles.labelLeft}>
                                ชื่อผู้ใช้งาน<span className={styles.required}>*</span>
                            </label>
                            {isLocked && (
                                <label className={`${styles.labelRight} ${styles.remainingTimeText}`} role="alert">
                                    ระบบถูกล็อก เหลืออีก {formatTime(remainingTime)}
                                </label>
                            )}
                        </div>
                        <input
                            id="username"
                            name="username"
                            type="text"
                            autoComplete="username"
                            value={formData.username}
                            placeholder="ตัวอักษร ตัวเลข และ _ เท่านั้น"
                            onChange={handleInputChange}
                            disabled={isLocked || loading}
                            maxLength={50}
                        />
                    </div>

                    {/* Password */}
                    <div className={styles.formGroup}>
                        <div className={styles.formGroupHeader}>
                            <label htmlFor="password" className={styles.labelLeft}>
                                รหัสผ่าน<span className={styles.required}>*</span>
                            </label>
                            <Link href="/forgot-password" className={styles.forgotLink}>
                                ลืมรหัสผ่าน?
                            </Link>
                        </div>
                        <div className={styles.passwordInput}>
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? "text" : "password"}
                                autoComplete="current-password"
                                value={formData.password}
                                placeholder="กรอกรหัสผ่าน"
                                onChange={handleInputChange}
                                disabled={isLocked || loading}
                            />
                            <button
                                type="button"
                                className={styles.eyeButton}
                                onClick={() => setShowPassword(p => !p)}
                                aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                                tabIndex={-1}
                            >
                                <span className={styles.eyeIcon}>
                                    {showPassword ? <EyeClosed size={18} /> : <Eye size={18} />}
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Submit */}
                    <button
                        type="submit"
                        className={styles.submitButton}
                        disabled={isLocked || loading}
                    >
                        {loading ? (
                            <>
                                <span className={styles.spinner} aria-hidden="true" />
                                กำลังเข้าสู่ระบบ...
                            </>
                        ) : (
                            <>
                                เข้าสู่ระบบ
                                {/* <span className={styles.submitButtonIcon}>
                                    <ArrowRight size={18} />
                                </span> */}
                            </>
                        )}
                    </button>
                </form>

                <div className={styles.divider}>
                    <span>หรือ</span>
                </div>

                <p className={styles.signUpText}>
                    ยังไม่มีบัญชี?{" "}
                    <Link href="/sign-up" className={styles.signUpLink}>
                        ลงทะเบียน
                    </Link>
                </p>
            </div>
        </div>
    )
}