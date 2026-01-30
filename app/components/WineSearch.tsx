"use client"

import React from "react"

import { searchWines, type WineSearchResult } from "@/actions/wine-search"
import he from "he"
import Image from "next/image"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import styles from "./WineSearch.module.css"

type WineSearchProps = {
  onSelect: (wine: WineSearchResult) => void
  placeholder?: string
  autoFocus?: boolean
  disabled?: boolean
}

export function WineSearch({
  onSelect,
  placeholder = "Sok etter vin...",
  autoFocus = false,
  disabled = false,
}: WineSearchProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<WineSearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const handleSearch = useCallback((searchQuery: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (searchQuery.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      return
    }

    debounceRef.current = setTimeout(() => {
      startTransition(async () => {
        const searchResults = await searchWines(searchQuery, 20)
        setResults(searchResults)
        setIsOpen(searchResults.length > 0)
        setSelectedIndex(-1)
      })
    }, 200) // 200ms debounce for faster response
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setQuery(value)
    handleSearch(value)
  }

  const handleSelect = (wine: WineSearchResult) => {
    onSelect(wine)
    setQuery("")
    setResults([])
    setIsOpen(false)
    setSelectedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) return

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev))
        break
      case "ArrowUp":
        e.preventDefault()
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev))
        break
      case "Enter":
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < results.length) {
          handleSelect(results[selectedIndex])
        }
        break
      case "Escape":
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
        setSelectedIndex(-1)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [])

  const formatVolume = (volume: number | null) => {
    if (!volume) return null
    if (volume >= 1) return `${volume}L`
    return `${volume * 100}cl`
  }

  return (
    <div className={styles.container} ref={containerRef}>
      <div className={styles.inputWrapper}>
        <svg
          className={styles.searchIcon}
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setIsOpen(true)}
          placeholder={placeholder}
          className={styles.input}
          autoFocus={autoFocus}
          disabled={disabled}
        />
        {isPending && (
          <div className={styles.spinner}>
            <svg className={styles.spinnerIcon} viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" opacity="0.25" />
              <path
                d="M12 2a10 10 0 0 1 10 10"
                stroke="currentColor"
                strokeWidth="3"
                fill="none"
                strokeLinecap="round"
              />
            </svg>
          </div>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <ul className={styles.dropdown}>
          {results.map((wine, index) => (
            <li
              key={`${wine.id}-${wine.year}`}
              className={`${styles.result} ${index === selectedIndex ? styles.resultSelected : ""}`}
              onClick={() => handleSelect(wine)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className={styles.resultImage}>
                <Image
                  src={`/api/wine-image/${wine.product_id}`}
                  alt=""
                  width={40}
                  height={60}
                  className={styles.wineImage}
                />
              </div>
              <div className={styles.resultInfo}>
                <span className={styles.resultName}>{he.decode(wine.name)}</span>
                <div className={styles.resultMeta}>
                  {wine.product_id && <span className={styles.metaTag}>#{wine.product_id}</span>}
                  {wine.year && <span className={styles.metaTag}>{wine.year}</span>}
                  {wine.volume && <span className={styles.metaTag}>{formatVolume(wine.volume)}</span>}
                  {wine.main_category && (
                    <span className={`${styles.metaTag} ${styles.categoryTag}`}>{wine.main_category}</span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
