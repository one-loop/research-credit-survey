"use client"

import { useId, useMemo } from "react"
import type { AccuracyHistogramBin } from "@/lib/survey/accuracyDistribution"
import { FadeIn } from "@/components/SurveyMotion"
import {
    buildCumulativeCurvePoints,
    cumulativeAreaPath,
    interpolateCumulativeAt,
    linearCurvePath,
    type CurvePoint,
} from "@/lib/survey/accuracyDistributionCurve"

type Props = {
    bins: AccuracyHistogramBin[]
    comparisonScore: number | null
    percentile: number | null
    responseCount: number
    previewNote?: string
}

const WIDTH = 400
const HEIGHT = 212
const PAD = { top: 28, right: 12, bottom: 40, left: 52 }
const CHART_W = WIDTH - PAD.left - PAD.right
const CHART_H = HEIGHT - PAD.top - PAD.bottom
const Y_LABEL_X = PAD.left - 10
const Y_TITLE_X = 14
const X_TICK_Y = PAD.top + CHART_H + 14
const AXIS_TITLE_Y = HEIGHT - 6

function toSvg(point: CurvePoint): CurvePoint {
    return {
        x: PAD.left + point.x * CHART_W,
        y: PAD.top + CHART_H - point.y * CHART_H,
    }
}

function mapPathToSvg(points: CurvePoint[]): CurvePoint[] {
    return points.map(toSvg)
}

export function AccuracyDistributionChart({
    bins,
    comparisonScore,
    percentile,
    responseCount,
    previewNote,
}: Props) {
    const fillGradientId = useId().replace(/:/g, "")
    const curvePoints = useMemo(() => buildCumulativeCurvePoints(bins), [bins])
    const svgPoints = useMemo(() => mapPathToSvg(curvePoints), [curvePoints])
    const linePath = useMemo(() => linearCurvePath(svgPoints), [svgPoints])
    const areaPath = useMemo(() => cumulativeAreaPath(svgPoints), [svgPoints])

    const clampedScore =
        typeof comparisonScore === "number" && Number.isFinite(comparisonScore)
            ? Math.min(1, Math.max(0, comparisonScore))
            : null

    const cumulativeY =
        clampedScore !== null ? interpolateCumulativeAt(curvePoints, clampedScore) : null

    const markerX =
        clampedScore !== null ? PAD.left + clampedScore * CHART_W : null
    const markerY =
        cumulativeY !== null
            ? PAD.top + CHART_H - cumulativeY * CHART_H
            : null

    const baselineY = PAD.top + CHART_H

    return (
        <FadeIn delay={60}>
        <div className="rounded-lg border bg-card p-4">
            {previewNote ? (
                <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                    {previewNote}
                </p>
            ) : null}
            <h2 className="text-base font-semibold mb-1.5">How you compare to other participants</h2>
            <p className="text-sm text-muted-foreground mb-4">
                Based on {responseCount} completed blocks in this study. The curve shows what
                share of participants scored at or below each accuracy level.
            </p>
            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                className="w-full max-w-md h-auto text-foreground"
                role="img"
                aria-label="Cumulative distribution of accuracy scores across all participants"
            >
                <defs>
                    <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="rgb(124 58 237)" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="rgb(124 58 237)" stopOpacity="0.04" />
                    </linearGradient>
                </defs>

                {[0, 0.5, 1].map((frac) => {
                    const y = PAD.top + CHART_H - frac * CHART_H
                    return (
                        <g key={frac}>
                            <line
                                x1={PAD.left}
                                y1={y}
                                x2={PAD.left + CHART_W}
                                y2={y}
                                className="stroke-border"
                                strokeWidth={0.5}
                                strokeDasharray="3 3"
                            />
                            <text
                                x={Y_LABEL_X}
                                y={y}
                                textAnchor="end"
                                dominantBaseline="middle"
                                className="fill-muted-foreground text-[9px]"
                            >
                                {Math.round(frac * 100)}%
                            </text>
                        </g>
                    )
                })}

                <line
                    x1={PAD.left}
                    y1={PAD.top}
                    x2={PAD.left}
                    y2={baselineY}
                    className="stroke-border"
                    strokeWidth={1}
                />
                <line
                    x1={PAD.left}
                    y1={baselineY}
                    x2={PAD.left + CHART_W}
                    y2={baselineY}
                    className="stroke-border"
                    strokeWidth={1}
                />

                {areaPath ? <path d={areaPath} fill={`url(#${fillGradientId})`} /> : null}
                {linePath ? (
                    <path
                        d={linePath}
                        fill="none"
                        className="stroke-violet-600"
                        strokeWidth={2.25}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                ) : null}

                {markerX !== null && markerY !== null ? (
                    <g>
                        <line
                            x1={markerX}
                            y1={markerY}
                            x2={markerX}
                            y2={baselineY}
                            className="stroke-violet-950/35"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                        />
                        <line
                            x1={PAD.left}
                            y1={markerY}
                            x2={markerX}
                            y2={markerY}
                            className="stroke-violet-950/35"
                            strokeWidth={1.5}
                            strokeDasharray="4 3"
                        />
                        <circle
                            cx={markerX}
                            cy={markerY}
                            r={4.5}
                            className="fill-violet-700 stroke-white"
                            strokeWidth={1.5}
                        />
                        <text
                            x={markerX}
                            y={PAD.top - 8}
                            textAnchor="middle"
                            className="fill-violet-950 text-[9px] font-semibold"
                        >
                            You
                        </text>
                        {clampedScore !== null && cumulativeY !== null ? (
                            <>
                                <text
                                    x={markerX}
                                    y={X_TICK_Y}
                                    textAnchor="middle"
                                    className="fill-violet-950 text-[9px] font-medium"
                                >
                                    {Math.round(clampedScore * 100)}%
                                </text>
                                <text
                                    x={Y_LABEL_X}
                                    y={markerY!}
                                    textAnchor="end"
                                    dominantBaseline="middle"
                                    className="fill-violet-950 text-[9px] font-medium"
                                >
                                    {Math.round(cumulativeY * 100)}%
                                </text>
                            </>
                        ) : null}
                    </g>
                ) : null}

                {[0, 0.5, 1].map((t) => (
                    <text
                        key={t}
                        x={PAD.left + t * CHART_W}
                        y={X_TICK_Y}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-muted-foreground text-[9px]"
                    >
                        {Math.round(t * 100)}%
                    </text>
                ))}

                <text
                    x={Y_TITLE_X}
                    y={(PAD.top + baselineY) / 2}
                    textAnchor="middle"
                    transform={`rotate(-90 ${Y_TITLE_X} ${(PAD.top + baselineY) / 2})`}
                    className="fill-muted-foreground text-[9px]"
                >
                    % at or below
                </text>
                <text
                    x={PAD.left + CHART_W / 2}
                    y={AXIS_TITLE_Y}
                    textAnchor="middle"
                    className="fill-muted-foreground text-[9px]"
                >
                    Accuracy
                </text>
            </svg>
        </div>
        </FadeIn>
    )
}
