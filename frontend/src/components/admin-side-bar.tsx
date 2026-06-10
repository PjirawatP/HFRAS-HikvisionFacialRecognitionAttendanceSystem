"use client"



import { Cctv, Gauge, Home, PanelLeftOpen, Settings, UserRound, UserRoundCheck, UsersRound } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import styles from "@/styles/components/user-side-bar.module.css"

import { UserRole } from "@/types/auth"



type SideBarProps = {
    isOpen: boolean
    role: UserRole
    onToggle: () => void
}

type MenuItem = {
    name: string
    href: string
    icon: React.ElementType
    title: string
    roles?: UserRole[]
}



export default function UserSideBarComponent({
    isOpen,
    role,
    onToggle,
}: SideBarProps) {
    const pathname = usePathname()

    const menuItems: MenuItem[] = [
        {
            name: "ภาพรวม",
            href: "/overview",
            icon: Gauge,
            title: "ภาพรวม",
            roles: [UserRole.ADMIN, UserRole.SUPERADMIN],
        },
        {
            name: "จัดการผู้ใช้งาน",
            href: "/user-management",
            icon: UserRound,
            title: "จัดการผู้ใช้งาน",
            roles: [UserRole.ADMIN, UserRole.SUPERADMIN],
        },
        {
            name: "จัดการกล้อง",
            href: "/camera-management",
            icon: Cctv,
            title: "จัดการกล้อง",
            roles: [UserRole.ADMIN, UserRole.SUPERADMIN],
        },
        {
            name: "จัดการบุคคล",
            href: "/person-management",
            icon: UsersRound,
            title: "จัดการบุคคล",
            roles: [UserRole.ADMIN, UserRole.SUPERADMIN],
        },
        {
            name: "รายการการตรวจจับ",
            href: "/detection-list",
            icon: UserRoundCheck,
            title: "รายการการตรวจจับ",
            roles: [UserRole.ADMIN, UserRole.SUPERADMIN],
        },
        {
            name: "ตั้งค่า",
            href: "/setting",
            icon: Settings,
            title: "ตั้งค่า",
            roles: [UserRole.SUPERADMIN]
        },
    ]

    const isActive = (href: string) =>
        pathname === href || pathname?.startsWith(href + "/")

    const visibleMenuItems = menuItems.filter(
        (item) => !item.roles || item.roles.includes(role)
    )

    return (
        <>
            <aside
                className={`${styles.sidebar} ${isOpen ? styles.open : styles.closed
                    }`}
            >
                {/* Header */}
                <div className={styles.header}>
                    <h2 className={styles.title}>
                        {isOpen && <span className={styles.titleText}>Dashboard</span>}
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
                        {visibleMenuItems.map((item) => {
                            const Icon = item.icon
                            const active = isActive(item.href)

                            return (
                                <li key={item.name} className={styles.menuItem}>
                                    <Link
                                        href={item.href}
                                        className={`${styles.menuLink} ${active ? styles.active : ""
                                            }`}
                                        title={!isOpen ? item.title : undefined}
                                        aria-current={active ? "page" : undefined}
                                    >
                                        <span className={styles.icon}>
                                            <Icon size={20} strokeWidth={2} />
                                        </span>
                                        {isOpen && (
                                            <span className={styles.menuText}>{item.name}</span>
                                        )}
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                </nav>

                {/* Back to home */}
                <Link href="/" className={styles.dashboardLink} title="หน้าแรก">
                    <Home size={20} />
                    {isOpen && <span>หน้าแรก</span>}
                </Link>
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
                        if (e.key === "Enter" || e.key === " ") {
                            onToggle()
                        }
                    }}
                />
            )}
        </>
    )
}