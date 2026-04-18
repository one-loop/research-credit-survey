import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { Author } from "@/lib/types"

const MIN_MS = 10_000

/**
 * Tracks per-work time on the author-ranking screen and whether the respondent
 * has waited long enough / changed order from the initial shuffle.
 */
export function useExperimentRankingTiming(opts: {
    workId: string | undefined
    isRankingUiActive: boolean
    items: Author[]
}) {
    const [minTimeMet, setMinTimeMet] = useState(false)
    const [baselineOrderKey, setBaselineOrderKey] = useState("")
    const pageStartedAtRef = useRef(0)
    const secondsByWorkIdRef = useRef<Record<string, number>>({})
    const itemsRef = useRef(opts.items)
    itemsRef.current = opts.items

    useLayoutEffect(() => {
        if (!opts.workId || !opts.isRankingUiActive) return
        pageStartedAtRef.current = Date.now()
        const key = itemsRef.current.map((a) => a.id).join("\0")
        setBaselineOrderKey(key)
        setMinTimeMet(false)
    }, [opts.workId, opts.isRankingUiActive])

    useEffect(() => {
        if (!opts.workId || !opts.isRankingUiActive) return
        const id = window.setInterval(() => {
            setMinTimeMet(Date.now() - pageStartedAtRef.current >= MIN_MS)
        }, 200)
        return () => window.clearInterval(id)
    }, [opts.workId, opts.isRankingUiActive])

    const flushCurrentWorkSeconds = useCallback((workId: string) => {
        const started = pageStartedAtRef.current
        if (!started) return
        const sec = Math.round((Date.now() - started) / 100) / 10
        secondsByWorkIdRef.current[workId] = (secondsByWorkIdRef.current[workId] ?? 0) + sec
        pageStartedAtRef.current = 0
    }, [])

    const currentOrderKey = opts.items.map((a) => a.id).join("\0")
    const orderUnchangedFromInitial =
        baselineOrderKey.length > 0 && currentOrderKey === baselineOrderKey

    return {
        minTimeMet,
        orderUnchangedFromInitial,
        flushCurrentWorkSeconds,
        secondsByWorkIdRef,
    }
}
