"use client"



import { useState } from "react"

import styles from "@/styles/layout/layout-client.module.css"

import AdminSideBarComponent from "@/components/admin-side-bar"

import { UserRole } from "@/types/auth"



interface Props {
  children: React.ReactNode
  role: UserRole
}



export default function LayoutClientComponent({
  children,
  role,
}: Props) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      <AdminSideBarComponent
        isOpen={isOpen}
        role={role}
        onToggle={() => setIsOpen(prev => !prev)}
      />
      <main className={`${styles.mainLayout} ${isOpen ? styles.sidebarOpen : ""}`}>
        {children}
      </main>
    </>
  )
}