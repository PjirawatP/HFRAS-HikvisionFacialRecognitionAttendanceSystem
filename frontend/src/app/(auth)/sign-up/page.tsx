"use client"



import Link from "next/link"

import { ArrowRight, Eye, EyeClosed } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import styles from "@/styles/pages/sign-up.module.css"

import ToastComponent from "@/components/toast"

import { useAuth } from "@/lib/auth-context"
import { SignUpFormData } from "@/types/auth"
import { ToastState, ToastType } from "@/types/toast"



// ─── Constants ────────────────────────────────────────────────────────────────
const MAX_SIGN_UP_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 10 * 60 * 1000
const STORAGE_KEY_ATTEMPTS = "sua_attempts"
const STORAGE_KEY_LOCKOUT = "sua_lockout_until"




// ─── Types ────────────────────────────────────────────────────────────────────
type PasswordStrength = "weak" | "medium" | "strong"



// ─── Pure helpers ─────────────────────────────────────────────────────────────
function evaluatePasswordStrength(password: string): PasswordStrength | null {
  if (!password) return null

  const criteria = [
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[!@#$%^&*(),.?":{}|<>]/.test(password),
    password.length >= 8,
  ]

  const count = criteria.filter(Boolean).length

  if (count >= 5) return "strong"
  if (count >= 3) return "medium"

  return "weak"
}


function validateForm(
  formData: SignUpFormData,
  passwordStrength: PasswordStrength | null
): string | null {
  if (formData.username.length < 3 || formData.username.length > 50)
    return "ชื่อผู้ใช้ต้องมีความยาว 3-50 ตัวอักษร"

  if (!/^[a-zA-Z0-9_]+$/.test(formData.username))
    return "ชื่อผู้ใช้สามารถใช้ได้เฉพาะตัวอักษร ตัวเลข และ _"

  if (formData.password.length < 8)
    return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"

  if (passwordStrength === "weak")
    return "รหัสผ่านไม่แข็งแรงพอ กรุณาใช้ตัวพิมพ์ใหญ่ ตัวเลข และอักขระพิเศษ"

  if (formData.password !== formData.confirm_password)
    return "รหัสผ่านไม่ตรงกัน"

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
    return Number(localStorage.getItem(STORAGE_KEY_ATTEMPTS) ?? 0)
  } catch {
    return 0
  }
}


function setLockout() {
  try {
    localStorage.setItem(STORAGE_KEY_LOCKOUT, String(Date.now() + LOCKOUT_DURATION_MS))
    localStorage.setItem(STORAGE_KEY_ATTEMPTS, String(MAX_SIGN_UP_ATTEMPTS))
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



// ─── Strength label helpers ───────────────────────────────────────────────────
const STRENGTH_LABEL: Record<PasswordStrength, string> = {
  weak: "อ่อนแอ",
  medium: "ปานกลาง",
  strong: "แข็งแรง",
}


const STRENGTH_CLASS: Record<PasswordStrength, string> = {
  weak: styles.strengthWeak,
  medium: styles.strengthMedium,
  strong: styles.strengthStrong,
}



export default function SignUpPage() {
  const { signUp } = useAuth()
  const router = useRouter()

  const isMountedRef = useRef(true)
  const redirectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [formData, setFormData] = useState<SignUpFormData>({
    username: "",
    password: "",
    confirm_password: "",
  })
  const [toast, setToast] = useState<ToastState | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [passwordStrength, setPasswordStrength] = useState<PasswordStrength | null>(null)

  // Initialise from localStorage so lockout survives refresh
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
      if (!isMountedRef.current) return
      const remaining = getLockoutRemaining()
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

  // ── Password strength ───────────────────────────────────────────────────────
  useEffect(() => {
    setPasswordStrength(evaluatePasswordStrength(formData.password))
  }, [formData.password])

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
        `คุณพยายามลงทะเบียนหลายครั้งเกินไป กรุณารออีก ${formatTime(remainingTime)}`,
        "error"
      )
      return
    }

    const validationError = validateForm(formData, passwordStrength)
    if (validationError) {
      showToast(validationError, "error")
      return
    }

    setLoading(true)

    try {
      const response = await signUp({
        username: formData.username,
        password: formData.password,
      })
      console.log("SIGN UP RESPONSE:", response)

      if (response.is_first_user) {
        showToast(
          "สร้าง Super Admin สำเร็จ คุณสามารถเข้าสู่ระบบได้ทันที",
          "success"
        )
      } else {
        showToast(
          "ลงทะเบียนสำเร็จ! รอผู้ดูแลระบบอนุมัติบัญชีเพื่อเข้าสู่ระบบ",
          "success"
        )
      }

      clearLockout()

      redirectTimerRef.current = setTimeout(() => {
        if (isMountedRef.current) router.push("/sign-in")
      }, 1500)
    } catch (err) {
      const newAttempts = incrementStoredAttempts()

      if (newAttempts >= MAX_SIGN_UP_ATTEMPTS) {
        setLockout()
        setRemainingTime(LOCKOUT_DURATION_MS)
        showToast("คุณพยายามลงทะเบียนผิดหลายครั้งเกินไป ระบบถูกล็อกเป็นเวลา 10 นาที", "error")
      } else {
        const message = err instanceof Error ? err.message : "การลงทะเบียนล้มเหลว"
        showToast(`${message} (เหลืออีก ${MAX_SIGN_UP_ATTEMPTS - newAttempts} ครั้ง)`, "error")
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
          <h2 className={styles.title}>ลงทะเบียน</h2>
          <p className={styles.subTitle}>กรอกข้อมูลเพื่อสร้างบัญชี</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          {/* Username */}
          <div className={styles.formGroup}>
            <div className={styles.formGroupHeader}>
              <label htmlFor="username" className={styles.labelLeft}>
                ชื่อผู้ใช้งาน <span className={styles.required}>*</span>
              </label>
              {isLocked && (
                <span className={`${styles.labelRight} ${styles.remainingTimeText}`} role="alert">
                  ระบบถูกล็อก เหลืออีก {formatTime(remainingTime)}
                </span>
              )}
            </div>
            <input
              id="username"
              name="username"
              type="text"
              value={formData.username}
              onChange={handleInputChange}
              disabled={isLocked || loading}
              placeholder="ตัวอักษร ตัวเลข และ _ เท่านั้น"
              autoComplete="username"
              maxLength={50}
            />
          </div>

          {/* Password */}
          <div className={styles.formGroup}>
            <div className={styles.formGroupHeader}>
              <label htmlFor="password" className={styles.labelLeft}>
                รหัสผ่าน <span className={styles.required}>*</span>
              </label>
              {passwordStrength && (
                <span className={`${styles.labelRight} ${STRENGTH_CLASS[passwordStrength]}`}>
                  {STRENGTH_LABEL[passwordStrength]}
                </span>
              )}
            </div>
            <div className={styles.passwordInput}>
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={handleInputChange}
                disabled={isLocked || loading}
                placeholder="อย่างน้อย 8 ตัวอักษร"
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.eyeButton}
                onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                tabIndex={-1}
              >
                <span className={styles.eyeIcon}>
                  {showPassword ? <Eye size={18} /> : <EyeClosed size={18} />}
                </span>
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div className={styles.formGroup}>
            <label htmlFor="confirm_password" className={styles.labelLeft}>
              ยืนยันรหัสผ่าน <span className={styles.required}>*</span>
            </label>
            <div className={styles.passwordInput}>
              <input
                id="confirm_password"
                name="confirm_password"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirm_password}
                onChange={handleInputChange}
                disabled={isLocked || loading}
                placeholder="ป้อนรหัสผ่านอีกครั้ง"
                autoComplete="new-password"
              />
              <button
                type="button"
                className={styles.eyeButton}
                onClick={() => setShowConfirmPassword(p => !p)}
                aria-label={showConfirmPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                tabIndex={-1}
              >
                <span className={styles.eyeIcon}>
                  {showConfirmPassword ? <Eye size={18} /> : <EyeClosed size={18} />}
                </span>
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading || isLocked}
          >
            {loading ? (
              <>
                <span className={styles.spinner} aria-hidden="true" />
                กำลังสมัครสมาชิก...
              </>
            ) : (
              <>
                สมัครสมาชิก
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

        <p className={styles.signInText}>
          มีบัญชีอยู่แล้ว?{" "}
          <Link href="/sign-in" className={styles.signInLink}>
            เข้าสู่ระบบ
          </Link>
        </p>
      </div>
    </div>
  )
}