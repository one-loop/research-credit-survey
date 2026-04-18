"use client"

import { Button } from "@/components/ui/button"

type Props = {
    open: boolean
    onConfirm: () => void
    onCancel: () => void
}

export function ConfirmRankingOrderDialog({ open, onConfirm, onCancel }: Props) {
    if (!open) return null
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-ranking-title"
        >
            <div className="max-w-md rounded-lg border bg-card p-6 shadow-lg">
                <h2 id="confirm-ranking-title" className="text-lg font-semibold mb-2">
                    Confirm author order
                </h2>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                    You have not changed the author order from how it first appeared. Are you sure this ordering is what
                    you want to submit?
                </p>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" type="button" onClick={onCancel}>
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
