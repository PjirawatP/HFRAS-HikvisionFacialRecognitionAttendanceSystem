"use client"



import Link from "next/link"

import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, ArcElement, Tooltip, Legend } from "chart.js"
import { Activity, AlertTriangle, ArrowUpRight, Cctv, CheckCircle, Clock, Database, Eye, Loader2, RefreshCw, Shield, UserRound, UserRoundCheck, UsersRound, Zap } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Bar, Line, Doughnut } from "react-chartjs-2"

import styles from "@/styles/pages/overview.module.css"

import UserDropdownComponent from "@/components/user-dropdown"
import { useCameraStatus, useDetectionStats, useDetectionSummary, useHourlyTrend, useRecentDetections, useSummaryStats, useSystemAlerts } from "@/hooks/use-overview-data"
import { useAuth } from "@/lib/auth-context"



// _____ Register ChartJS Components ______
ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    ArcElement,
    Tooltip,
    Legend
)



// _____ Types ____________________________
interface SummaryData {
    total_cameras: number
    online_cameras: number
    offline_cameras: number
    total_persons: number
    blacklist_persons: number
    total_detections_today: number
    average_detections_per_day: number
}

interface CameraStatusItem {
    id: number
    name: string
    location: string | null
    status: "online" | "offline"
    detections_today: number
    uptime_percentage: number
}

interface DetectionSummaryItem {
    camera_name: string
    normal_count: number
    blacklist_count: number
}

interface HourlyTrendItem {
    hour: string
    count: number
}

interface DetectionStatsData {
    normal: number
    blacklist: number
}

interface SystemAlertItem {
    id: number
    type: "warning" | "error" | "success"
    title: string
    location: string
    time: string
}

interface RecentDetectionItem {
    id: number
    person_name: string
    detect_image_path: string
    camera_name: string
    detected_at: string
    is_blacklist: boolean
    similarity: number
}



export default function OverviewPage() {
    const { user, signOut: logout } = useAuth()

    const router = useRouter()

    const handleSignOut = () => {
        logout()
        router.replace("/sign-in")
    }

    const [detectionPeriod, setDetectionPeriod] = useState<string>("today")

    // _____ Fetch All Data ___________________
    const { data: summaryData, loading: summaryLoading, error: summaryError } = useSummaryStats()
    const { data: cameraStatusData, loading: cameraLoading, error: cameraError } = useCameraStatus()
    const { data: detectionSummaryData, loading: detectionSummaryLoading, error: detectionSummaryError } = useDetectionSummary(detectionPeriod)
    const { data: hourlyTrendData, loading: hourlyTrendLoading, error: hourlyTrendError } = useHourlyTrend()
    const { data: detectionStatsData, loading: detectionStatsLoading, error: detectionStatsError } = useDetectionStats(detectionPeriod)
    const { data: systemAlertsData, loading: systemAlertsLoading, error: systemAlertsError } = useSystemAlerts(10)
    const { data: recentDetectionsData, loading: recentDetectionsLoading, error: recentDetectionsError } = useRecentDetections(10)

    // _____ Utility Functions ________________
    const timeAgo = (dateString: string): string => {
        const date = new Date(dateString)
        const now = new Date()
        const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)
        if (seconds < 60) return `${seconds} วินาทีที่แล้ว`
        if (seconds < 3600) return `${Math.floor(seconds / 60)} นาทีที่แล้ว`
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} ชั่วโมงที่แล้ว`
        return `${Math.floor(seconds / 86400)} วันที่แล้ว`
    }

    // _____ Reusable Components ______________
    const SkeletonCard = () => (
        <div className={styles.skeletonCard}>
            <div className={styles.skeletonIcon}></div>
            <div className={styles.skeletonContent}>
                <div className={styles.skeletonHeader}>
                    <span className={styles.skeletonTitle}>Loading...</span>
                    <div className={styles.skeletonLink}></div>
                </div>
                <div className={styles.skeletonValue}>Loading...</div>
                <div className={styles.skeletonFooter}><span>Loading...</span></div>
            </div>
        </div>
    )

    const ErrorState = ({ onRetry }: { onRetry?: () => void }) => (
        <div className={styles.errorState}>
            <AlertTriangle size={40} className={styles.errorFetchIcon} />
            <h3 className={styles.errorTitle}>ไม่สามารถโหลดข้อมูลได้</h3>
            {onRetry && (
                <button className={styles.retryButton} onClick={onRetry}>
                    <RefreshCw size={16} />
                    <span>ลองอีกครั้ง</span>
                </button>
            )}
        </div>
    )

    const LoadingSpinner = () => (
        <div className={styles.loadingContainer}>
            <Loader2 size={32} className={styles.spinner} />
            <p className={styles.loadingText}>กำลังโหลดข้อมูล...</p>
        </div>
    )

    const EmptyState = ({
        icon: Icon,
        title,
        description
    }: {
        icon: React.ElementType
        title: string
        description: string
    }) => (
        <div className={styles.emptyState}>
            <Icon size={48} className={styles.emptyIcon} />
            <h3 className={styles.emptyTitle}>{title}</h3>
            <p className={styles.emptyDescription}>{description}</p>
        </div>
    )

    // _____ Chart Data _______________________

    // Bar chart: normal vs blacklist per camera
    const detectionChartData = {
        labels: detectionSummaryData?.map((d: DetectionSummaryItem) => d.camera_name) || [],
        datasets: [
            {
                label: "ปกติ",
                data: detectionSummaryData?.map((d: DetectionSummaryItem) => d.normal_count) || [],
                backgroundColor: "#16a34a",
                borderRadius: 8,
            },
            {
                label: "บัญชีดำ",
                data: detectionSummaryData?.map((d: DetectionSummaryItem) => d.blacklist_count) || [],
                backgroundColor: "#dc2626",
                borderRadius: 8,
            },
        ],
    }

    // Line chart: hourly trend
    const trendData = {
        labels: hourlyTrendData?.map((d: HourlyTrendItem) => d.hour) || [],
        datasets: [
            {
                label: "จำนวนการตรวจจับ",
                data: hourlyTrendData?.map((d: HourlyTrendItem) => d.count) || [],
                borderColor: "#2563eb",
                backgroundColor: "rgba(59, 130, 246, 0.1)",
                tension: 0.4,
                fill: true,
            },
        ],
    }

    // Doughnut chart: normal vs blacklist overall
    const statsChartData = {
        labels: ["ปกติ", "บัญชีดำ"],
        datasets: [
            {
                data: detectionStatsData
                    ? [detectionStatsData.normal, detectionStatsData.blacklist]
                    : [0, 0],
                backgroundColor: ["#16a34a", "#dc2626"],
                borderWidth: 0,
            },
        ],
    }

    // _____ Chart Options ____________________
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "bottom" as const,
                labels: { usePointStyle: true, padding: 15, font: { size: 12, family: "inherit" } }
            },
        },
        scales: {
            x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11, family: "inherit" } } },
            y: { stacked: true, beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" }, ticks: { font: { size: 11, family: "inherit" } } },
        },
    }

    const lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { display: false },
            tooltip: { mode: "index" as const, intersect: false }
        },
        scales: {
            x: { grid: { display: false }, ticks: { font: { size: 11, family: "inherit" } } },
            y: { beginAtZero: true, grid: { color: "rgba(0,0,0,0.05)" }, ticks: { font: { size: 11, family: "inherit" } } },
        },
    }

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: "bottom" as const,
                labels: { usePointStyle: true, padding: 15, font: { size: 12, family: "inherit" } }
            },
        },
    }

    // _____ Render ___________________________
    return (
        <div className={styles.pageContainer}>
            {/* _____ Header ___________________________ */}
            <div className={styles.header}>
                <div className={styles.leftHeader}>
                    <h1 className={styles.title}>ภาพรวม</h1>
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

            {/* _____ Content __________________________ */}
            <div className={styles.content}>
                {/* _____ Left Panel _______________________ */}
                <div className={styles.leftPanel}>
                    {/* _____ Summary Cards ____________________ */}
                    <div className={styles.summaryContainer}>
                        {summaryLoading ? (
                            <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
                        ) : summaryError ? (
                            <div className={styles.summaryError}>
                                <ErrorState onRetry={() => window.location.reload()} />
                            </div>
                        ) : (
                            <>
                                {/* Camera Card */}
                                <div className={`${styles.summaryCard} ${styles.cctv}`}>
                                    <div className={styles.cardIcon}><Cctv size={24} /></div>
                                    <div className={styles.cardContent}>
                                        <div className={styles.cardHeader}>
                                            <span className={styles.cardTitle}>กล้องทั้งหมด</span>
                                            <Link className={styles.cardLink} href="/camera-management">
                                                <ArrowUpRight size={18} />
                                            </Link>
                                        </div>
                                        <div className={styles.cardValue}>
                                            {(summaryData as SummaryData)?.total_cameras || 0}
                                        </div>
                                        <div className={styles.cardFooter}>
                                            <Zap size={14} />
                                            <span className={(summaryData as SummaryData)?.online_cameras ? styles.positive : styles.neutral}>
                                                {(summaryData as SummaryData)?.online_cameras || 0} กำลังตรวจจับ
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Person Card */}
                                <div className={`${styles.summaryCard} ${styles.person}`}>
                                    <div className={styles.cardIcon}><UsersRound size={24} /></div>
                                    <div className={styles.cardContent}>
                                        <div className={styles.cardHeader}>
                                            <span className={styles.cardTitle}>บุคคลที่ลงทะเบียน</span>
                                            <Link className={styles.cardLink} href="/person-management">
                                                <ArrowUpRight size={18} />
                                            </Link>
                                        </div>
                                        <div className={styles.cardValue}>
                                            {(summaryData as SummaryData)?.total_persons || 0}
                                        </div>
                                        <div className={styles.cardFooter}>
                                            <AlertTriangle size={14} />
                                            <span className={styles.neutral}>
                                                {(summaryData as SummaryData)?.blacklist_persons || 0} ในบัญชีดำ
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Detection Card */}
                                <div className={`${styles.summaryCard} ${styles.detection}`}>
                                    <div className={styles.cardIcon}><UserRoundCheck size={24} /></div>
                                    <div className={styles.cardContent}>
                                        <div className={styles.cardHeader}>
                                            <span className={styles.cardTitle}>การตรวจจับวันนี้</span>
                                            <Link className={styles.cardLink} href="/detection-management">
                                                <ArrowUpRight size={18} />
                                            </Link>
                                        </div>
                                        <div className={styles.cardValue}>
                                            {(summaryData as SummaryData)?.total_detections_today || 0}
                                        </div>
                                        <div className={styles.cardFooter}>
                                            <Activity size={14} />
                                            <span className={styles.neutral}>
                                                เฉลี่ย: {(summaryData as SummaryData)?.average_detections_per_day?.toFixed(1) || 0}/วัน
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* _____ Charts Section ___________________ */}
                    <div className={styles.leftPanelMainContent}>
                        {/* _____ Left Column ______________________ */}
                        <div className={styles.leftPanelLeftColumn}>
                            {/* Detection Summary Bar Chart */}
                            <div className={styles.chartCard}>
                                <div className={styles.chartHeader}>
                                    <h3>สรุปการตรวจจับแต่ละกล้อง</h3>
                                    <select
                                        className={styles.timeFilter}
                                        value={detectionPeriod}
                                        onChange={(e) => setDetectionPeriod(e.target.value)}
                                        disabled={detectionSummaryLoading}
                                    >
                                        <option value="today">วันนี้</option>
                                        <option value="week">สัปดาห์นี้</option>
                                        <option value="month">เดือนนี้</option>
                                    </select>
                                </div>
                                <div className={styles.chartWrapper}>
                                    {detectionSummaryLoading ? (
                                        <LoadingSpinner />
                                    ) : detectionSummaryError ? (
                                        <ErrorState onRetry={() => window.location.reload()} />
                                    ) : !detectionSummaryData || detectionSummaryData.length === 0 ? (
                                        <EmptyState icon={Database} title="ไม่มีข้อมูล" description="ยังไม่มีการตรวจจับในช่วงเวลานี้" />
                                    ) : (
                                        <Bar data={detectionChartData} options={chartOptions} />
                                    )}
                                </div>
                            </div>

                            {/* Hourly Trend Line Chart */}
                            <div className={styles.chartCard}>
                                <div className={styles.chartHeader}>
                                    <h3>แนวโน้มการตรวจจับ (24 ชั่วโมง)</h3>
                                </div>
                                <div className={styles.chartWrapper}>
                                    {hourlyTrendLoading ? (
                                        <LoadingSpinner />
                                    ) : hourlyTrendError ? (
                                        <ErrorState onRetry={() => window.location.reload()} />
                                    ) : !hourlyTrendData || hourlyTrendData.length === 0 ? (
                                        <EmptyState icon={Activity} title="ไม่มีข้อมูล" description="ยังไม่มีการตรวจจับใน 24 ชั่วโมงที่ผ่านมา" />
                                    ) : (
                                        <Line data={trendData} options={lineOptions} />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* _____ Right Column _____________________ */}
                        <div className={styles.leftPanelRightColumn}>
                            {/* Detection Stats Doughnut */}
                            <div className={styles.topColumn}>
                                <div className={styles.chartCard}>
                                    <div className={styles.chartHeader}>
                                        <h3>สัดส่วนการตรวจจับ</h3>
                                    </div>
                                    <div className={styles.chartWrapper}>
                                        {detectionStatsLoading ? (
                                            <LoadingSpinner />
                                        ) : detectionStatsError ? (
                                            <ErrorState onRetry={() => window.location.reload()} />
                                        ) : !detectionStatsData ||
                                            (detectionStatsData.normal === 0 && detectionStatsData.blacklist === 0) ? (
                                            <EmptyState icon={Shield} title="ไม่มีข้อมูล" description="ยังไม่มีข้อมูลการตรวจจับ" />
                                        ) : (
                                            <Doughnut data={statsChartData} options={doughnutOptions} />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Camera Status */}
                            <div className={styles.bottomColumn}>
                                <div className={styles.statusCard}>
                                    <div className={styles.cardHeaderSection}>
                                        <h3>สถานะกล้อง</h3>
                                        <Link href="/camera-management" className={styles.viewAll}>ดูทั้งหมด</Link>
                                    </div>
                                    <div className={styles.scrollableContent}>
                                        {cameraLoading ? (
                                            <LoadingSpinner />
                                        ) : cameraError ? (
                                            <ErrorState onRetry={() => window.location.reload()} />
                                        ) : !cameraStatusData || cameraStatusData.length === 0 ? (
                                            <EmptyState icon={Cctv} title="ไม่มีกล้อง" description="ยังไม่มีกล้องในระบบ" />
                                        ) : (
                                            <div className={styles.statusList}>
                                                {(cameraStatusData as unknown as CameraStatusItem[]).map((camera) => (
                                                    <div key={camera.id} className={styles.statusItem}>
                                                        <div className={styles.statusLeft}>
                                                            <div className={`${styles.statusDot} ${camera.status === "online" ? styles.online : styles.offline}`}></div>
                                                            <div className={styles.statusInfo}>
                                                                <div className={styles.statusName}>{camera.name}</div>
                                                                <div className={styles.statusMeta}>
                                                                    <Eye size={12} />
                                                                    <span>{camera.detections_today} ครั้ง</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className={styles.statusRight}>
                                                            <div className={styles.uptime}>{camera.uptime_percentage}%</div>
                                                            <div className={styles.uptimeLabel}>Uptime</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* _____ Right Panel ______________________ */}
                <div className={styles.rightPanel}>
                    {/* Recent Detections */}
                    <div className={styles.bottomColumn}>
                        <div className={styles.detectionCard}>
                            <div className={styles.cardHeaderSection}>
                                <h3>การตรวจจับล่าสุด</h3>
                                <Link href="/detection-management" className={styles.viewAll}>ดูทั้งหมด</Link>
                            </div>
                            <div className={styles.scrollableContent}>
                                {recentDetectionsLoading ? (
                                    <LoadingSpinner />
                                ) : recentDetectionsError ? (
                                    <ErrorState onRetry={() => window.location.reload()} />
                                ) : !recentDetectionsData || recentDetectionsData.length === 0 ? (
                                    <EmptyState icon={UserRound} title="ไม่มีข้อมูล" description="ยังไม่มีการตรวจจับล่าสุด" />
                                ) : (
                                    <div className={styles.detectionList}>
                                        {(recentDetectionsData as unknown as RecentDetectionItem[]).map((detection) => (
                                            <div key={detection.id} className={styles.detectionItem}>
                                                <div className={styles.detectionAvatar}>
                                                    {detection.detect_image_path ? (
                                                        <img
                                                            src={`/api/image/${detection.detect_image_path}`}
                                                            alt="Detection"
                                                            className={styles.detectionImage}
                                                        />
                                                    ) : (
                                                        <div className={styles.noImage}>
                                                            <span><UserRoundCheck size={16} /></span>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className={styles.detectionInfo}>
                                                    <div className={styles.detectionName}>{detection.person_name}</div>
                                                    <div className={styles.detectionMeta}>
                                                        <span className={styles.camera}>{detection.camera_name}</span>
                                                        <span className={styles.separator}>•</span>
                                                        <Clock size={12} />
                                                        <span>{timeAgo(detection.detected_at)}</span>
                                                    </div>
                                                </div>
                                                <div className={styles.detectionStatus}>
                                                    <div className={`${styles.badge} ${detection.is_blacklist ? styles.warning : styles.normal}`}>
                                                        {detection.is_blacklist ? "บัญชีดำ" : "ปกติ"}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}