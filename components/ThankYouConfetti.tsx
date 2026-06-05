"use client"

import { useEffect, useRef } from "react"

const SIDE_COLORS = ["#5b21b6", "#7c3aed", "#fbbf24", "#34d399"]
const CENTER_COLORS = ["#5b21b6", "#7c3aed", "#a78bfa", "#fbbf24", "#34d399"]

function prefersReducedMotion(): boolean {
    return (
        typeof window !== "undefined" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
}

/** Left and right confetti bursts over the full viewport. */
export function ThankYouConfetti() {
    useEffect(() => {
        if (typeof window === "undefined" || prefersReducedMotion()) return

        let cancelled = false
        const timeouts: number[] = []

        void import("canvas-confetti").then(({ default: confetti }) => {
            if (cancelled) return

            const burst = (opts: Parameters<typeof confetti>[0]) => {
                if (!cancelled) confetti(opts)
            }

            timeouts.push(
                window.setTimeout(() => {
                    burst({
                        particleCount: 50,
                        angle: 60,
                        spread: 55,
                        origin: { x: 0, y: 0.6 },
                        colors: SIDE_COLORS,
                    })
                }, 180)
            )

            timeouts.push(
                window.setTimeout(() => {
                    burst({
                        particleCount: 50,
                        angle: 120,
                        spread: 55,
                        origin: { x: 1, y: 0.6 },
                        colors: SIDE_COLORS,
                    })
                }, 320)
            )
        })

        return () => {
            cancelled = true
            for (const id of timeouts) window.clearTimeout(id)
        }
    }, [])

    return null
}

type AnalyticsConfettiProps = {
    /** Fire once when the analytics block is ready to measure. */
    active: boolean
}

/**
 * Center confetti on a local canvas behind the chart/leaderboard cards.
 * The canvas extends past the cards so particles are not clipped by their borders.
 */
export function ThankYouAnalyticsConfetti({ active }: AnalyticsConfettiProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const firedRef = useRef(false)

    useEffect(() => {
        if (!active || firedRef.current || typeof window === "undefined" || prefersReducedMotion()) {
            return
        }

        const canvas = canvasRef.current
        if (!canvas) return

        let cancelled = false
        let confettiInstance: ((options: Record<string, unknown>) => void) | null = null

        const fire = () => {
            if (cancelled || firedRef.current || !confettiInstance) return
            const parent = canvas.parentElement
            if (!parent || parent.clientWidth < 1 || parent.clientHeight < 1) return

            firedRef.current = true
            confettiInstance({
                particleCount: 100,
                spread: 100,
                startVelocity: 38,
                gravity: 0.9,
                ticks: 220,
                origin: { x: 0.5, y: 0.45 },
                colors: CENTER_COLORS,
            })
        }

        void import("canvas-confetti").then(({ default: confetti }) => {
            if (cancelled) return
            confettiInstance = confetti.create(canvas, { resize: true, useWorker: false })
            window.requestAnimationFrame(() => {
                window.requestAnimationFrame(fire)
            })
        })

        return () => {
            cancelled = true
        }
    }, [active])

    return (
        <div
            className="pointer-events-none absolute -left-24 -right-24 -top-14 -bottom-14 z-0 overflow-visible"
            aria-hidden
        >
            <canvas ref={canvasRef} className="h-full w-full" />
        </div>
    )
}
