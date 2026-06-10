"use client"



import { LogOut, UserRound } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import styles from "@/styles/components/user-dropdown.module.css"

import { UserRole } from "@/types/auth"



interface UserDropdownProps {
    username?: string
    role?: UserRole
    onSignOut: () => void
}



export default function UserDropdownComponent({ username, role, onSignOut: onSignOut }: UserDropdownProps) {
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const router = useRouter()

    // ปิด dropdown เมื่อคลิกข้างนอก
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false)
            }
        }

        if (isDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside)
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside)
        }
    }, [isDropdownOpen])

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen)
    }

    const handleSignOut = () => {
        setIsDropdownOpen(false)
        onSignOut()
    }

    const getRoleLabel = () => {
        switch (role) {
            case UserRole.SUPERADMIN:
                return "ผู้ดูแลระบบสูงสุด"
            case UserRole.ADMIN:
                return "ผู้ดูแลระบบ"
            default:
                return "ผู้ใช้งาน"
        }
    }

    return (
        <div className={styles.container} ref={dropdownRef}>
            <button
                className={styles.userButton}
                onClick={toggleDropdown}
                aria-label="เมนูผู้ใช้"
            >
                <UserRound className={styles.userIcon} />
            </button>

            {isDropdownOpen && (
                <div className={styles.dropdown}>
                    <div className={styles.dropdownHeader}>
                        <p className={styles.username}>{username || "ผู้ใช้"}</p>
                        <p className={styles.userRole}>{getRoleLabel()}</p>
                    </div>
                    <div className={styles.dropdownDivider}></div>
                    <div className={styles.dropdownContent}>
                        <button
                            className={styles.signOutButton}
                            onClick={handleSignOut}
                        >
                            <LogOut className={styles.signOutIcon} />
                            <span>ออกจากระบบ</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    )
}