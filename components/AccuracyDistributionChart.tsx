"use client"

import type { AccuracyHistogramBin } from "@/lib/survey/accuracyDistribution"

type Props = {
    bins: AccuracyHistogramBin[]
    percentile: number | null
    comparisonScore: number | null
    responseCount: number
}

const WIDTH = 400
const HEIGHT = 180
const PAD = { top: 12, right: 12, bottom: 28, left: 36 }
const CHART_W = WIDTH - PAD.left - PAD.right
const CHART_H = HEIGHT - PAD.top - PAD.bottom

export function AccuracyDistributionChart({
    bins,
    percentile,
    comparisonScore,
    responseCount,
}: Props) {
    const maxCount = Math.max(1, ...bins.map((b) => b.count))
    const barWidth = CHART_W / bins.length
    const markerX =
        typeof comparisonScore === "number" && Number.isFinite(comparisonScore)
            ? PAD.left + Math.min(1, Math.max(0, comparisonScore)) * CHART_W
            : null

    return (
        <div className="rounded-lg border bg-card p-4">
            <h2 className="text-sm font-semibold mb-1">How you compare to other participants</h2>
            <p className="text-xs text-muted-foreground mb-4">
                Based on {responseCount} completed blocks in this study. Each bar shows how many
                blocks scored in that accuracy range.
            </p>
            {typeof percentile === "number" ? (
                <p className="text-sm mb-4">
                    Your average accuracy is higher than{" "}
                    <span className="font-semibold">{Math.round(percentile)}%</span> of recorded
                    block scores
                    {typeof comparisonScore === "number" ? (
                        <>
                            {" "}
                            (your average:{" "}
                            <span className="font-semibold">
                                {Math.round(comparisonScore * 100)}%
                            </span>
                            ).
                        </>
                    ) : (
                        "."
                    )}
                </p>
            ) : null}
            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="w-full max-w-md h-auto text-foreground"
                role="img"
                aria-label="Histogram of accuracy scores across all participants"
            >
                {/* Y axis ticks */}
                {[0, 0.5, 1].map((frac) => {
                    const y = PAD.top + CHART_H - frac * CHART_H
                    const label = Math.round(maxCount * frac)
                    return (
                        <g key={frac}>
                            <line
                                x1={PAD.left}
                                y1={y}
                                x2={PAD.left + CHART_W}
                                y2={y}
                                className="stroke-border"
                                strokeWidth={0.5}
                                strokeDasharray="2 2"
                            />
                            <text
                                x={PAD.left - 6}
                                y={y + 3}
                                textAnchor="end"
                                className="fill-muted-foreground text-[9px]"
                            >
                                {label}
                            </text>
                        </g>
                    )
                })}
                {/* Bars */}
                {bins.map((bin, i) => {
                    const barH = (bin.count / maxCount) * CHART_H
                    const x = PAD.left + i * barWidth + barWidth * 0.1
                    const w = barWidth * 0.8
                    const y = PAD.top + CHART_H - barH
                    const inBin =
                        markerX !== null &&
                        comparisonScore !== null &&
                        comparisonScore >= bin.binStart &&
                        (i === bins.length - 1
                            ? comparisonScore <= bin.binEnd
                            : comparisonScore < bin.binEnd)
                    return (
                        <rect
                            key={`${bin.binStart}-${bin.binEnd}`}
                            x={x}
                            y={y}
                            width={w}
                            height={Math.max(barH, bin.count > 0 ? 2 : 0)}
                            rx={2}
                            className={inBin ? "fill-violet-600" : "fill-violet-300/80"}
                        />
                    )
                })}
                {/* Respondent marker */}
                {markerX !== null ? (
                    <g>
                        <line
                            x1={markerX}
                            y1={PAD.top}
                            x2={markerX}
                            y2={PAD.top + CHART_H}
                            className="stroke-violet-950"
                            strokeWidth={2}
                        />
                        <text
                            x={markerX}
                            y={PAD.top - 2}
                            textAnchor="middle"
                            className="fill-violet-950 text-[9px] font-medium"
                        >
                            You
                        </text>
                    </g>
                ) : null}
                {/* X axis labels */}
                {[0, 0.5, 1].map((t) => (
                    <text
                        key={t}
                        x={PAD.left + t * CHART_W}
                        y={HEIGHT - 6}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[9px]"
                    >
                        {Math.round(t * 100)}%
                    </text>
                ))}
            </svg>
            <p className="text-[10px] text-muted-foreground text-center mt-1">Accuracy</p>
        </div>
    )
}
