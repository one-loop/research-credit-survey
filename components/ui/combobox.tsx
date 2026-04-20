"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

type ComboboxProps<T> = {
    items: T[]
    searchValue: string
    onSearchValueChange: (value: string) => void
    onValueChange: (value: T) => void
    itemToStringValue: (value: T) => string
    itemKey: (value: T) => string
    placeholder?: string
    disabled?: boolean
    loading?: boolean
    emptyText?: string
    minChars?: number
    className?: string
}

export function Combobox<T>({
    items,
    searchValue,
    onSearchValueChange,
    onValueChange,
    itemToStringValue,
    itemKey,
    placeholder,
    disabled,
    loading = false,
    emptyText = "No items found.",
    minChars = 2,
    className,
}: ComboboxProps<T>) {
    const [isFocused, setIsFocused] = React.useState(false)
    const [highlightedIndex, setHighlightedIndex] = React.useState(-1)
    const shouldShow = isFocused && searchValue.trim().length >= minChars

    React.useEffect(() => {
        if (!shouldShow || items.length === 0) {
            setHighlightedIndex(-1)
            return
        }
        setHighlightedIndex((prev) => (prev < 0 || prev >= items.length ? 0 : prev))
    }, [items, shouldShow])

    function selectIndex(idx: number) {
        const item = items[idx]
        if (!item) return
        onValueChange(item)
        onSearchValueChange(itemToStringValue(item))
        setIsFocused(false)
    }

    return (
        <div className={cn("relative", className)}>
            <input
                type="text"
                value={searchValue}
                onChange={(e) => onSearchValueChange(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => {
                    window.setTimeout(() => setIsFocused(false), 120)
                }}
                onKeyDown={(e) => {
                    if (!shouldShow || items.length === 0) {
                        if (e.key === "Escape") setIsFocused(false)
                        return
                    }
                    if (e.key === "ArrowDown") {
                        e.preventDefault()
                        setHighlightedIndex((prev) => (prev + 1) % items.length)
                        return
                    }
                    if (e.key === "ArrowUp") {
                        e.preventDefault()
                        setHighlightedIndex((prev) => (prev - 1 + items.length) % items.length)
                        return
                    }
                    if (e.key === "Enter") {
                        e.preventDefault()
                        const indexToUse = highlightedIndex >= 0 ? highlightedIndex : 0
                        selectIndex(indexToUse)
                        return
                    }
                    if (e.key === "Escape") {
                        e.preventDefault()
                        setIsFocused(false)
                    }
                }}
                disabled={disabled}
                placeholder={placeholder}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                autoComplete="organization"
            />

            {shouldShow ? (
                <div className="absolute z-20 mt-1 w-full max-h-64 overflow-auto rounded-md border bg-background shadow-sm">
                    {loading ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">Searching institutions...</div>
                    ) : items.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">{emptyText}</div>
                    ) : (
                        items.map((item, idx) => {
                            const label = itemToStringValue(item)
                            const key = itemKey(item)
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    className={cn(
                                        "w-full px-3 py-2 text-left text-sm",
                                        idx === highlightedIndex ? "bg-accent" : "hover:bg-accent"
                                    )}
                                    onMouseDown={(e) => {
                                        e.preventDefault()
                                        selectIndex(idx)
                                    }}
                                >
                                    {label}
                                </button>
                            )
                        })
                    )}
                </div>
            ) : null}
        </div>
    )
}

