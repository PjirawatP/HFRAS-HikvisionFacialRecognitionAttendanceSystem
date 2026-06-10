"use client"



import { Search, X } from "lucide-react"

import styles from "@/styles/components/search-bar.module.css"



interface Props {
  value: string
  onChange: (value: string) => void
  placeholder?: string
}



export default function SearchBarComponent({ value, onChange, placeholder }: Props) {
  return (
    <div className={styles.searchBarContainer}>
      <span className={styles.searchBarIcon}>
        <Search size={18} />
      </span>

      <input
        type="text"
        className={styles.searchBarInput}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />

      {value && (
        <button className={styles.clearButton} onClick={() => onChange("")} aria-label="ล้างค้นหา">
          <X size={14} />
        </button>
      )}
    </div>
  )
}