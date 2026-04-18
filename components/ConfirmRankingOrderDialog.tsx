"use client"

import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"

type Props = {
    open: boolean
    onConfirm: () => void
    onCancel: () => void
}

export function ConfirmRankingOrderDialog({ open, onConfirm, onCancel }: Props) {
    const dialogRef = useRef<HTMLDivElement>(null)
    const previousFocusedElementRef = useRef<HTMLElement | null>(null)
    const shouldRestoreFocusRef = useRef(false)

    useEffect(() => {
        if (!open) return

        shouldRestoreFocusRef.current = false
        previousFocusedElementRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
        const focusHandle = requestAnimationFrame(() => {
            const dialog = dialogRef.current
            if (!dialog) return
            const firstFocusable = dialog.querySelector<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )
            firstFocusable?.focus()
        })

        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") {
                event.preventDefault()
                shouldRestoreFocusRef.current = true
                onCancel()
                return
            }

            if (event.key !== "Tab") return

            const dialog = dialogRef.current
            if (!dialog) return

            const focusableElements = dialog.querySelectorAll<HTMLElement>(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            )

            if (focusableElements.length === 0) {
                event.preventDefault()
                return
            }

            const first = focusableElements[0]
            const last = focusableElements[focusableElements.length - 1]
            const activeElement = document.activeElement as HTMLElement | null

            if (event.shiftKey) {
                if (activeElement === first || !dialog.contains(activeElement)) {
                    event.preventDefault()
                    last.focus()
                }
                return
            }

            if (activeElement === last) {
                event.preventDefault()
                first.focus()
            }
        }

        document.addEventListener("keydown", handleKeyDown)
        return () => {
            cancelAnimationFrame(focusHandle)
            document.removeEventListener("keydown", handleKeyDown)
            if (shouldRestoreFocusRef.current) {
                previousFocusedElementRef.current?.focus()
            }
        }
    }, [open, onCancel])

    function handleCancel() {
        shouldRestoreFocusRef.current = true
        onCancel()
    }

    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-ranking-title"
            aria-describedby="confirm-ranking-description"
        >
            <div ref={dialogRef} className="max-w-md rounded-lg border bg-card p-6 shadow-lg">
                <h2 id="confirm-ranking-title" className="text-lg font-semibold mb-2">
                    Confirm author order
                </h2>
                <p id="confirm-ranking-description" className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    You have not changed the author order from how it first appeared. Are you sure this ordering is what
                    you want to submit?
                </p>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" type="button" onClick={handleCancel}>
                        Go back
                    </Button>
                    <Button type="button" onClick={onConfirm}>
                        Yes, continue
                    </Button>
                </div>
            </div>
        </div>
    )
}
