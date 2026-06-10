"use client"



import { Activity, AlertCircle, CircleCheck, CircleUser, Clock, Joystick, MessageSquare, Pencil, Plus, Save, Target, Trash2, Zap } from "lucide-react"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import styles from "@/styles/pages/setting.module.css"

import ToastComponent from "@/components/toast"
import UserDropdownComponent from "@/components/user-dropdown"

import { useAuth } from "@/lib/auth-context"
import { UserRole } from "@/types/auth"
import { ToastState, ToastType } from "@/types/toast"



type ModalMode = null | "add" | "edit" | "delete"
type WorkerStatusType = "running" | "stopped" | "crashed" | "unreachable"

interface SettingData {
    accuracy_threshold: number
    detection_speed: number
    notify_on_match: boolean
    notify_on_unknown: boolean
    notification_cooldown: number
}

interface NotificationChannel {
    id: number
    platform: string
    access_token: string
    target_id: string | null
    is_active: boolean
}

interface ChannelFormData {
    platform: string
    access_token: string
    target_id: string
    is_active: boolean
}

interface WorkerStatus {
    status: WorkerStatusType
    uptime: number | null
    frame_count: number
    detection_count: number
    recognition_count: number
    last_heartbeat: string | null
    active_cameras: number
}



const TOAST_DURATION_MS = 5000



export default function SettingsPage() {
    const { user, authLoading: loading, signOut: logout } = useAuth()
    const router = useRouter()
    const [authorized, setAuthorized] = useState(false)

    const [toast, setToast] = useState<ToastState | null>(null)
    const isMountedRef = useRef(true)

    const [setting, setSetting] = useState<SettingData>({
        accuracy_threshold: 0.25,
        detection_speed: 0.15,
        notify_on_match: true,
        notify_on_unknown: false,
        notification_cooldown: 30,
    })
    const [saving, setSaving] = useState(false)

    const [channels, setChannels] = useState<NotificationChannel[]>([])
    const [loadingData, setLoadingData] = useState(true)

    const [modalMode, setModalMode] = useState<ModalMode>(null)
    const [editingChannel, setEditingChannel] = useState<NotificationChannel | null>(null)
    const [deletingChannel, setDeletingChannel] = useState<NotificationChannel | null>(null)
    const [formData, setFormData] = useState<ChannelFormData>({
        platform: "line",
        access_token: "",
        target_id: "",
        is_active: true
    })
    const [submitting, setSubmitting] = useState(false)

    const [workerStatus, setWorkerStatus] = useState<WorkerStatus>({
        status: "stopped",
        uptime: null,
        frame_count: 0,
        detection_count: 0,
        recognition_count: 0,
        last_heartbeat: null,
        active_cameras: 0
    })
    const [workerLoading, setWorkerLoading] = useState(false)

    const handleSignOut = () => {
        logout()
        router.replace("/sign-in")
    }

    const showToast = useCallback((message: string, type: ToastType) => {
        if (isMountedRef.current) {
            setToast({ message, type })
        }
    }, [])

    const hideToast = useCallback(() => {
        if (isMountedRef.current) {
            setToast(null)
        }
    }, [])

    const closeModal = useCallback(() => {
        setModalMode(null)
        setEditingChannel(null)
        setDeletingChannel(null)
        setFormData({
            platform: "line",
            access_token: "",
            target_id: "",
            is_active: true
        })
    }, [])

    const openAddModal = () => {
        setModalMode("add")
        setFormData({
            platform: "line",
            access_token: "",
            target_id: "",
            is_active: true
        })
    }

    const openEditModal = (channel: NotificationChannel, e: React.MouseEvent) => {
        e.stopPropagation()
        setModalMode("edit")
        setEditingChannel(channel)
        setFormData({
            platform: channel.platform,
            access_token: channel.access_token,
            target_id: channel.target_id || "",
            is_active: channel.is_active
        })
    }

    const openDeleteModal = (channel: NotificationChannel, e: React.MouseEvent) => {
        e.stopPropagation()
        setModalMode("delete")
        setDeletingChannel(channel)
    }

    const fetchAllData = async () => {
        setLoadingData(true)
        try {
            await Promise.all([
                fetchSetting(),
                fetchNotificationChannels(),
                fetchWorkerStatus()
            ])
        } catch (error) {
            console.error('Error loading data:', error)
        }
        setLoadingData(false)
    }

    const fetchSetting = async () => {
        try {
            const res = await fetch("/api/setting/get")
            if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูลการตั้งค่าได้")

            const resData = await res.json()
            setSetting(resData)
        } catch (error) {
            console.error("error in fetchSetting:", error)
            showToast("ไม่สามารถดึงข้อมูลการตั้งค่าได้", "error")
        }
    }

    const fetchNotificationChannels = async () => {
        try {
            const res = await fetch("/api/setting/notification-channel/list")
            if (!res.ok) throw new Error("ไม่สามารถดึงข้อมูลช่องทางการแจ้งเตือนได้")

            const resData = await res.json()
            setChannels(resData)
        } catch (error) {
            // console.error("error in fetchNotificationChannels:", error)

            showToast("ไม่สามารถดึงข้อมูลช่องทางการแจ้งเตือนได้", "error")
        }
    }

    const fetchWorkerStatus = async () => {
        try {
            const res = await fetch("/api/worker/status")
            const data = await res.json()
            setWorkerStatus(data)
        } catch (error) {
            // console.error("Error fetching worker status:", error)

            setWorkerStatus(prev => ({ ...prev, status: "unreachable" }))
        }
    }

    const handleStartWorker = async () => {
        setWorkerLoading(true)
        try {
            const res = await fetch("/api/worker/start", { method: "POST" })
            const data = await res.json()

            if (res.ok) {
                showToast("เริ่มต้น Worker สำเร็จ", "success")
                await fetchWorkerStatus()
            } else {
                showToast(data.message || "ไม่สามารถเริ่มต้น Worker ได้", "error")
            }
        } catch (error) {
            // console.error("Error starting worker:", error)

            showToast("เกิดข้อผิดพลาดในการเริ่มต้น Worker", "error")
        }
        setWorkerLoading(false)
    }

    const handleStopWorker = async () => {
        setWorkerLoading(true)
        try {
            const res = await fetch("/api/worker/stop", { method: "POST" })
            const data = await res.json()

            if (res.ok) {
                showToast("หยุด Worker สำเร็จ", "success")
                await fetchWorkerStatus()
            } else {
                showToast(data.message || "ไม่สามารถหยุด Worker ได้", "error")
            }
        } catch (error) {
            // console.error("Error stopping worker:", error)

            showToast("เกิดข้อผิดพลาดในการหยุด Worker", "error")
        }
        setWorkerLoading(false)
    }

    const handleRestartWorker = async () => {
        setWorkerLoading(true)
        try {
            const res = await fetch("/api/worker/restart", { method: "POST" })
            const data = await res.json()

            if (res.ok) {
                showToast("รีสตาร์ท Worker สำเร็จ", "success")
                await fetchWorkerStatus()
            } else {
                showToast(data.message || "ไม่สามารถรีสตาร์ท Worker ได้", "error")
            }
        } catch (error) {
            // console.error("Error restarting worker:", error)

            showToast("เกิดข้อผิดพลาดในการรีสตาร์ท Worker", "error")
        }
        setWorkerLoading(false)
    }

    const getStatusColor = (status: WorkerStatusType) => {
        switch (status) {
            case "running": return "#10b981"
            case "stopped": return "#6b7280"
            case "crashed": return "#ef4444"
            case "unreachable": return "#f59e0b"
            default: return "#6b7280"
        }
    }

    const getStatusText = (status: WorkerStatusType) => {
        switch (status) {
            case "running": return "กำลังทำงาน"
            case "stopped": return "หยุดทำงาน"
            case "crashed": return "เกิดข้อผิดพลาด"
            case "unreachable": return "ไม่สามารถเชื่อมต่อได้"
            default: return "ไม่ทราบสถานะ"
        }
    }

    const saveSetting = async () => {
        setSaving(true)
        try {
            const res = await fetch("/api/setting/save", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(setting)
            })

            if (res.ok) {
                showToast("บันทึกการตั้งค่าสำเร็จ", "success")
            } else {
                throw new Error("บันทึกไม่สำเร็จ")
            }
        } catch (error) {
            console.error("error in saveSetting:", error)
            showToast("บันทึกการตั้งค่าไม่สำเร็จ", "error")
        }
        setSaving(false)
    }

    const handleAddChannel = async () => {
        if (!formData.access_token) {
            showToast("กรุณากรอก Access Token", "warning")
            return
        }

        setSubmitting(true)
        try {
            const response = await fetch('/api/setting/notification-channel/add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (response.ok) {
                await fetchNotificationChannels()
                closeModal()
                showToast("เพิ่มช่องทางการแจ้งเตือนสำเร็จ", "success")
            } else {
                throw new Error("เพิ่มไม่สำเร็จ")
            }
        } catch (error) {
            // console.error('Error adding channel:', error)
            showToast("เพิ่มช่องทางการแจ้งเตือนไม่สำเร็จ", "error")
        }
        setSubmitting(false)
    }

    const handleEditChannel = async () => {
        if (!editingChannel || !formData.access_token) {
            showToast("กรุณากรอกข้อมูลให้ครบถ้วน", "warning")
            return
        }

        setSubmitting(true)
        try {
            const response = await fetch(`/api/setting/notification-channel/${editingChannel.id}/edit`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            })

            if (response.ok) {
                await fetchNotificationChannels()
                closeModal()
                showToast("แก้ไขช่องทางการแจ้งเตือนสำเร็จ", "success")
            } else {
                throw new Error("แก้ไขไม่สำเร็จ")
            }
        } catch (error) {
            // console.error('Error editing channel:', error)
            showToast("แก้ไขช่องทางการแจ้งเตือนไม่สำเร็จ", "error")
        }
        setSubmitting(false)
    }

    const handleDeleteChannel = async () => {
        if (!deletingChannel) return

        setSubmitting(true)
        try {
            const response = await fetch(`/api/setting/notification-channel/${deletingChannel.id}/delete`, {
                method: 'DELETE'
            })

            if (response.ok) {
                await fetchNotificationChannels()
                closeModal()
                showToast("ลบช่องทางการแจ้งเตือนสำเร็จ", "success")
            } else {
                throw new Error("ลบไม่สำเร็จ")
            }
        } catch (error) {
            // console.error('Error deleting channel:', error)
            showToast("ลบช่องทางการแจ้งเตือนไม่สำเร็จ", "error")
        }
        setSubmitting(false)
    }

    const getPlatformLabel = (platform: string) => {
        switch (platform.toLowerCase()) {
            case 'line':
                return 'LINE Messaging API'
            case 'discord':
                return 'Discord API'
            case 'telegram':
                return 'Telegram Bot API'
            default:
                return platform
        }
    }

    const getTokenLabel = (platform: string) => {
        switch (platform.toLowerCase()) {
            case 'line':
                return 'LINE Access Token'
            case 'discord':
                return 'Discord Webhook URL'
            case 'telegram':
                return 'Telegram Bot Token'
            default:
                return 'Access Token'
        }
    }

    useEffect(() => {
        if (loading) return

        if (!user) {
            router.push("/sign-in")
            return
        }

        if (user.role !== UserRole.SUPERADMIN) {
            router.replace("/")
            return
        }

        setAuthorized(true)
    }, [user, loading, router])

    useEffect(() => {
        if (!toast) return
        const timer = setTimeout(hideToast, TOAST_DURATION_MS)
        return () => clearTimeout(timer)
    }, [toast, hideToast])

    useEffect(() => {
        if (authorized) {
            fetchAllData()
        }
    }, [authorized])

    useEffect(() => {
        if (!authorized) return

        const interval = setInterval(() => {
            fetchWorkerStatus()
        }, 5000)

        return () => clearInterval(interval)
    }, [authorized])

    if (loading || !authorized) {
        return null
    }

    return (
        <div className={styles.pageContainer}>
            {toast && (
                <ToastComponent
                    message={toast.message}
                    type={toast.type}
                    onClose={hideToast}
                />
            )}

            <div className={styles.header}>
                <div className={styles.leftHeader}>
                    <h1 className={styles.title}>ตั้งค่าระบบ</h1>
                    <p className={styles.subtitle}>ระบบตรวจจับใบหน้าและติดตามแบบเรียลไทม์</p>
                </div>
                <div className={styles.rightHeader}>
                    <UserDropdownComponent
                        username={user?.username}
                        role={user?.role}
                        onSignOut={handleSignOut}
                    />
                </div>
            </div>

            <div className={styles.content}>
                <div className={styles.toolBar}>
                    <button
                        onClick={saveSetting}
                        disabled={saving}
                        className={styles.saveButton}
                    >
                        <span className={styles.pillButtonIcon}>
                            <Save size={16} />
                        </span>
                        {saving ? 'กำลังบันทึก...' : 'บันทึกการตั้งค่า'}
                    </button>
                </div>

                <div className={styles.settingArea}>
                    {/* LEFT PANEL */}
                    <div className={styles.leftPanel}>
                        <h2 className={styles.settingTitle}>
                            การตั้งค่าการแจ้งเตือน
                        </h2>

                        <div className={styles.settingGroup}>
                            <div className={styles.toggleSetting}>
                                <div className={styles.settingLabel}>
                                    <CircleCheck size={20} />
                                    <div>
                                        <h3>แจ้งเตือนเมื่อพบบุคคลที่รู้จัก</h3>
                                        <p>ส่งการแจ้งเตือนเมื่อระบบตรวจพบบุคคลที่อยู่ในฐานข้อมูล</p>
                                    </div>
                                </div>
                                <label className={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={setting.notify_on_match}
                                        onChange={(e) => setSetting({
                                            ...setting,
                                            notify_on_match: e.target.checked
                                        })}
                                    />
                                    <span className={styles.switchSlider}></span>
                                </label>
                            </div>

                            <div className={styles.toggleSetting}>
                                <div className={styles.settingLabel}>
                                    <AlertCircle size={20} />
                                    <div>
                                        <h3>แจ้งเตือนเมื่อพบบุคคลที่ไม่รู้จัก</h3>
                                        <p>ส่งการแจ้งเตือนเมื่อระบบตรวจพบบุคคลที่ไม่อยู่ในฐานข้อมูล</p>
                                    </div>
                                </div>
                                <label className={styles.switch}>
                                    <input
                                        type="checkbox"
                                        checked={setting.notify_on_unknown}
                                        onChange={(e) => setSetting({
                                            ...setting,
                                            notify_on_unknown: e.target.checked
                                        })}
                                    />
                                    <span className={styles.switchSlider}></span>
                                </label>
                            </div>

                            <div className={styles.setting}>
                                <div className={styles.settingLabel}>
                                    <Clock size={20} />
                                    <div>
                                        <h3>ช่วงเวลารอระหว่างการแจ้งเตือน</h3>
                                        <p>เวลาขั้นต่ำระหว่างการแจ้งเตือนสำหรับบุคคลเดียวกัน (วินาที)</p>
                                    </div>
                                </div>
                                <div className={styles.settingControl}>
                                    <input
                                        type="number"
                                        min="5"
                                        max="300"
                                        value={setting.notification_cooldown}
                                        onChange={(e) => setSetting({
                                            ...setting,
                                            notification_cooldown: parseInt(e.target.value) || 5
                                        })}
                                        className={styles.numberInput}
                                    />
                                    <span className={styles.unit}>วินาที</span>
                                </div>
                            </div>
                        </div>

                        <div className={styles.channelArea}>
                            <div className={styles.settingHeader}>
                                <h2 className={styles.settingTitle}>
                                    ช่องทางการแจ้งเตือน
                                </h2>
                                <button
                                    className={styles.addButton}
                                    onClick={openAddModal}
                                >
                                    <Plus size={18} />
                                    เพิ่มช่องทาง
                                </button>
                            </div>

                            <div className={styles.channelList}>
                                {channels.length === 0 ? (
                                    <div className={styles.emptyState}>
                                        <MessageSquare size={48} />
                                        <p>ยังไม่มีช่องทางการแจ้งเตือน</p>
                                    </div>
                                ) : (
                                    channels.map(channel => (
                                        <div key={channel.id} className={styles.channelCard}>
                                            <div className={styles.channelInfo}>
                                                <div className={styles.channelPlatform}>
                                                    {getPlatformLabel(channel.platform)}
                                                </div>
                                                <div className={styles.channelDetails}>
                                                    <span>Token: {channel.access_token.substring(0, 30)}...</span>
                                                    {channel.target_id && <span>Target: {channel.target_id}</span>}
                                                    <span>สถานะ: {channel.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span>
                                                </div>
                                            </div>
                                            <div className={styles.channelActions}>
                                                <button
                                                    onClick={(e) => openEditModal(channel, e)}
                                                    className={styles.editButton}
                                                    title="แก้ไข"
                                                >
                                                    <Pencil size={18} />
                                                </button>
                                                <button
                                                    onClick={(e) => openDeleteModal(channel, e)}
                                                    className={styles.deleteButton}
                                                    title="ลบ"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* RIGHT PANEL */}
                    <div className={styles.rightPanel}>
                        <h2 className={styles.settingTitle}>การตั้งค่าการตรวจจับ</h2>

                        <div className={styles.settingGroup}>
                            {/* Worker Status - ใช้ style เดียวกับ setting อื่นๆ */}
                            <div className={styles.setting}>
                                <div className={styles.settingLabel}>
                                    <Activity size={20} />
                                    <div>
                                        <h3>สถานะระบบตรวจจับ</h3>
                                        <p>สถานะการทำงานของระบบตรวจจับใบหน้า</p>
                                    </div>
                                </div>
                                <div className={styles.settingControl}>
                                    <button
                                        onClick={fetchWorkerStatus}
                                        className={styles.iconButton}
                                        disabled={workerLoading}
                                        title="รีเฟรชสถานะ"
                                    >
                                        <Activity size={18} />
                                    </button>
                                    <div
                                        className={styles.statusIndicator}
                                        style={{
                                            backgroundColor: getStatusColor(workerStatus.status),
                                            boxShadow: `0 0 8px ${getStatusColor(workerStatus.status)}40`
                                        }}
                                        title={getStatusText(workerStatus.status)}
                                    >
                                        <span className={styles.statusPulse}></span>
                                    </div>
                                </div>
                            </div>

                            {/* Worker Control Buttons */}
                            <div className={styles.setting}>
                                <div className={styles.settingLabel}>
                                    <Joystick size={20} />
                                    <div>
                                        <h3>ควบคุมระบบตรวจจับ</h3>
                                        <p>เริ่มต้น หยุด หรือรีสตาร์ทระบบตรวจจับ</p>
                                    </div>
                                </div>
                                <div className={styles.workerControlButtons}>
                                    {workerStatus.status === "stopped" || workerStatus.status === "unreachable" ? (
                                        <button
                                            onClick={handleStartWorker}
                                            disabled={workerLoading}
                                            className={`${styles.controlButton} ${styles.startButton}`}
                                        >
                                            {workerLoading ? "กำลังเริ่ม..." : "เริ่มต้น"}
                                        </button>
                                    ) : (
                                        <>
                                            <button
                                                onClick={handleStopWorker}
                                                disabled={workerLoading}
                                                className={`${styles.controlButton} ${styles.stopButton}`}
                                            >
                                                {workerLoading ? "กำลังหยุด..." : "หยุด"}
                                            </button>
                                            <button
                                                onClick={handleRestartWorker}
                                                disabled={workerLoading}
                                                className={`${styles.controlButton} ${styles.restartButton}`}
                                            >
                                                {workerLoading ? "กำลังรีสตาร์ท..." : "รีสตาร์ท"}
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div className={styles.setting}>
                                <div className={styles.settingLabel}>
                                    <Target size={20} />
                                    <div>
                                        <h3>ความแม่นยำขั้นต่ำ</h3>
                                        <p>คะแนนความคล้ายคลึงขั้นต่ำสำหรับการจดจำใบหน้า (0.0 - 1.0)</p>
                                    </div>
                                </div>
                                <div className={styles.settingControl}>
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={setting.accuracy_threshold}
                                        onChange={(e) => setSetting({
                                            ...setting,
                                            accuracy_threshold: parseFloat(e.target.value)
                                        })}
                                        className={styles.slider}
                                    />
                                    <span className={styles.value}>
                                        {(setting.accuracy_threshold * 100).toFixed(0)}%
                                    </span>
                                </div>
                            </div>

                            <div className={styles.setting}>
                                <div className={styles.settingLabel}>
                                    <Zap size={20} />
                                    <div>
                                        <h3>ความเร็วในการตรวจจับ</h3>
                                        <p>ช่วงเวลาระหว่างการตรวจจับใบหน้า (วินาที)</p>
                                    </div>
                                </div>
                                <div className={styles.settingControl}>
                                    <input
                                        type="range"
                                        min="0.1"
                                        max="1.0"
                                        step="0.05"
                                        value={setting.detection_speed}
                                        onChange={(e) => setSetting({
                                            ...setting,
                                            detection_speed: parseFloat(e.target.value)
                                        })}
                                        className={styles.slider}
                                    />
                                    <span className={styles.value}>
                                        {setting.detection_speed.toFixed(2)}s
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* MODALS */}
            {(modalMode === "add" || modalMode === "edit") && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>
                                {modalMode === "add" ? "เพิ่มช่องทางการแจ้งเตือน" : "แก้ไขช่องทางการแจ้งเตือน"}
                            </h2>
                            <p className={styles.modalSubTitle}>
                                {modalMode === "add"
                                    ? "กรอกข้อมูลเพื่อเพิ่มช่องทางการแจ้งเตือนใหม่"
                                    : "แก้ไขข้อมูลช่องทางการแจ้งเตือน"}
                            </p>
                        </div>

                        <div className={styles.form}>
                            <div className={styles.formGroup}>
                                <label>ช่องทาง</label>
                                <select
                                    value={formData.platform}
                                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                                    className={styles.selectInput}
                                >
                                    <option value="line">LINE Messaging API</option>
                                    <option value="discord">Discord API</option>
                                    <option value="telegram">Telegram Bot API</option>
                                </select>
                            </div>

                            <div className={styles.formGroup}>
                                <label>
                                    {getTokenLabel(formData.platform)}
                                    <span className={styles.required}>*</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder={`กรอก ${getTokenLabel(formData.platform)}`}
                                    value={formData.access_token}
                                    onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
                                    className={styles.input}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label>Target ID (ถ้ามี)</label>
                                <input
                                    type="text"
                                    placeholder="Target ID"
                                    value={formData.target_id}
                                    onChange={(e) => setFormData({ ...formData, target_id: e.target.value })}
                                    className={styles.input}
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <div className={styles.ff}>
                                    <label className={styles.switch}>
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        />
                                        <span className={styles.switchSlider}></span>
                                    </label>
                                    <span>เปิดใช้งาน</span>
                                </div>
                            </div>

                            <div className={styles.formActions}>
                                <button onClick={closeModal} className={styles.cancelButton} disabled={submitting}>
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={modalMode === "add" ? handleAddChannel : handleEditChannel}
                                    className={styles.submitButton}
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        modalMode === "add" ? "กำลังเพิ่ม..." : "กำลังบันทึก..."
                                    ) : (
                                        modalMode === "add" ? "เพิ่ม" : "บันทึก"
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {modalMode === "delete" && deletingChannel && (
                <div className={styles.modalOverlay} onClick={closeModal}>
                    <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2 className={styles.modalTitle}>ยืนยันการลบช่องทาง</h2>
                            <p className={styles.deleteDescription}>
                                คุณกำลังจะลบช่องทาง <strong>{getPlatformLabel(deletingChannel.platform)}</strong>
                            </p>
                        </div>

                        <div className={styles.deleteHint}>
                            ⚠️ การลบช่องทางการแจ้งเตือนจะ<strong>ไม่สามารถกู้คืนได้</strong> กรุณาตรวจสอบให้แน่ใจก่อนดำเนินการ
                        </div>

                        <div className={styles.form}>
                            <div className={styles.formActions}>
                                <button onClick={closeModal} className={styles.cancelButton} disabled={submitting}>
                                    ยกเลิก
                                </button>
                                <button
                                    onClick={handleDeleteChannel}
                                    className={styles.submitButtonDelete}
                                    disabled={submitting}
                                >
                                    {submitting ? "กำลังลบ..." : "ลบช่องทาง"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}   