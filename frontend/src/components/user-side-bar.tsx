"use client"



import Link from "next/link"

import { Cctv, Gauge, Home, PanelLeftOpen, Settings, UserRound, UserRoundCheck, UsersRound } from "lucide-react"
import { usePathname } from "next/navigation"

import styles from "@/styles/components/user-side-bar.module.css"

import { UserRole } from "@/types/auth"



type SideBarProps = {
    isOpen: boolean
    role?: UserRole
    onToggle: () => void
}



export default function UserSideBarComponent({
    isOpen,
    role,
    onToggle
}: SideBarProps) {
    const pathname = usePathname()

    const menuItems = [
        {
            name: "หน้าแรก",
            href: "/",
            icon: Home,
            title: "หน้าแรก"
        },
        // {
        //     name: "User Management",
        //     href: "/user-management",
        //     icon: UserRound,
        //     title: "จัดการผู้ใช้งาน"
        // },
        // {
        //     name: "Camera Management",
        //     href: "/camera-management",
        //     icon: Cctv,
        //     title: "จัดการกล้อง"
        // },
        // {
        //     name: "Person Management",
        //     href: "/person-management",
        //     icon: UsersRound,
        //     title: "จัดการบุคคล"
        // },
        // {
        //     name: "Detection Management",
        //     href: "/detection-management",
        //     icon: UserRoundCheck,
        //     title: "จัดการการตรวจพบ"
        // },
        // {
        //     name: "Settings",
        //     href: "/settings",
        //     icon: Settings,
        //     title: "ตั้งค่า"
        // },
    ]

    const isActive = (href: string) => {
        return pathname === href || pathname?.startsWith(href + "/")
    }

    const isAdminOrSuperAdmin = role === UserRole.ADMIN || role === UserRole.SUPERADMIN

    return (
        <>
            <aside className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed}`}>
                {/* Header */}
                <div className={styles.header}>
                    <h2 className={styles.title}>
                        {isOpen && <span className={styles.titleText}>FDAR System</span>}
                        <button
                            className={styles.edgeToggle}
                            onClick={onToggle}
                            aria-label={isOpen ? "ปิดแถบด้านข้าง" : "เปิดแถบด้านข้าง"}
                            title={isOpen ? "ปิดแถบด้านข้าง" : "เปิดแถบด้านข้าง"}
                        >
                            <PanelLeftOpen size={20} />
                        </button>
                    </h2>
                </div>

                {/* Navigation */}
                <nav className={styles.nav}>
                    <ul className={styles.menuList}>
                        {menuItems.map((item) => {
                            const Icon = item.icon
                            const active = isActive(item.href)

                            return (
                                <li key={item.name} className={styles.menuItem}>
                                    <Link
                                        href={item.href}
                                        className={`${styles.menuLink} ${active ? styles.active : ''}`}
                                        title={!isOpen ? item.title : undefined}
                                        aria-current={active ? 'page' : undefined}
                                    >
                                        <span className={styles.icon}>
                                            <Icon size={20} strokeWidth={2} />
                                        </span>
                                        {isOpen && (
                                            <span className={styles.menuText}>
                                                {item.name}
                                            </span>
                                        )}
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                </nav>

                {/* Admin Quick Link */}
                {isAdminOrSuperAdmin && (
                    <Link
                        href="/overview"
                        className={styles.dashboardLink}
                        title="Dashboard"
                    >
                        <Gauge size={20} />
                        {isOpen && <span>Dashboard</span>}
                    </Link>
                )}
            </aside>

            {/* Mobile Overlay */}
            {isOpen && (
                <div
                    className={styles.overlay}
                    onClick={onToggle}
                    aria-label="ปิดแถบด้านข้าง"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            onToggle()
                        }
                    }}
                />
            )}
        </>
    )
}