"use client"

import { useId, useMemo } from "react"
import type { AccuracyHistogramBin } from "@/lib/survey/accuracyDistribution"
import { FadeIn } from "@/components/SurveyMotion"
import {
    buildCumulativeCurvePoints,
    cumulativeAreaPath,
    linearCurvePath,
    markerOnCumulativeCurve,
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
const HEIGHT = 224
/** Plot area insets within the SVG viewBox. */
const PAD = { top: 40, right: 16, bottom: 48, left: 74 }
const CHART_W = WIDTH - PAD.left - PAD.right
const CHART_H = HEIGHT - PAD.top - PAD.bottom
const BASELINE_Y = PAD.top + CHART_H
const Y_TICK_X = PAD.left - 10
const Y_AXIS_MID = (PAD.top + BASELINE_Y) / 2
/** Center of the y-axis title in the left margin, running vertically. */
const Y_AXIS_LABEL_X = 18
const X_TICK_Y = BASELINE_Y + 16
const X_TITLE_Y = HEIGHT - 10
const CALLOUT_W = 84
const CALLOUT_H = 24
const CALLOUT_GAP = 10

function toSvg(point: CurvePoint): CurvePoint {
    return {
        x: PAD.left + point.x * CHART_W,
        y: PAD.top + CHART_H - point.y * CHART_H,
    }
}

function mapPathToSvg(points: CurvePoint[]): CurvePoint[] {
    return points.map(toSvg)
}

/** Place the score callout near the marker without overlapping axis tick labels. */
function getMarkerCalloutOrigin(
    markerX: number,
    markerY: number,
    cumulativeY: number,
    clampedScore: number
): { x: number; y: number } {
    let centerX = markerX
    let centerY = markerY - CALLOUT_GAP - CALLOUT_H / 2

    if (cumulativeY > 0.78) {
        centerY = markerY + CALLOUT_GAP + CALLOUT_H / 2
    }

    if (clampedScore > 0.72) {
        centerX = markerX - CALLOUT_W * 0.3
    } else if (clampedScore < 0.2) {
        centerX = markerX + CALLOUT_W * 0.3
    }

    const halfW = CALLOUT_W / 2
    const halfH = CALLOUT_H / 2
    centerX = Math.min(Math.max(centerX, PAD.left + halfW + 4), PAD.left + CHART_W - halfW - 4)
    centerY = Math.min(Math.max(centerY, PAD.top + halfH + 2), BASELINE_Y - halfH - 6)

    return { x: centerX - halfW, y: centerY - halfH }
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
    const areaPath = useMemo(() => cumulativeAreaPath(svgPoints, BASELINE_Y), [svgPoints])

    const markerNorm =
        typeof comparisonScore === "number" && Number.isFinite(comparisonScore)
            ? markerOnCumulativeCurve(curvePoints, comparisonScore)
            : null

    const markerSvg = markerNorm ? toSvg(markerNorm) : null
    const markerX = markerSvg?.x ?? null
    const markerY = markerSvg?.y ?? null
    const clampedScore = markerNorm?.x ?? null
    const cumulativeY = markerNorm?.y ?? null

    const callout =
        markerX !== null &&
        markerY !== null &&
        clampedScore !== null &&
        cumulativeY !== null
            ? getMarkerCalloutOrigin(markerX, markerY, cumulativeY, clampedScore)
            : null

    const yTicks = [0, 0.5, 1]
    const xTicks = [0, 0.5, 1]

    const markerAriaLabel =
        clampedScore !== null && cumulativeY !== null
            ? `Your score: ${Math.round(clampedScore * 100)}% accuracy; ${Math.round(cumulativeY * 100)}% of participants scored at or below${
                  typeof percentile === "number" ? `; overall percentile rank ${Math.round(percentile)}` : ""
              }`
            : undefined

    return (
        <FadeIn delay={60}>
            <div className="rounded-lg border bg-card p-4">
                {previewNote ? (
                    <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                        {previewNote}
                    </p>
                ) : null}
                <h2 className="text-base font-semibold mb-1.5">
                    How you compare to other participants
                </h2>
                <p className="text-sm text-muted-foreground mb-4">
                    Based on {responseCount} completed blocks in this study. The curve shows what
                    share of participants scored at or below each accuracy level.
                </p>
                <svg
                    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    className="w-full max-w-md h-auto overflow-visible text-foreground"
                    role="img"
                    aria-label="Cumulative distribution of accuracy scores across all participants"
                >
                    <defs>
                        <linearGradient id={fillGradientId} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgb(124 58 237)" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="rgb(124 58 237)" stopOpacity="0.04" />
                        </linearGradient>
                    </defs>

                    {yTicks.map((frac) => {
                        const y = PAD.top + CHART_H - frac * CHART_H
                        return (
                            <g key={`y-${frac}`}>
                                <line
                                    x1={PAD.left}
                                    y1={y}
                                    x2={PAD.left + CHART_W}
                                    y2={y}
                                    className="stroke-border"
                                    strokeWidth={0.5}
                                    strokeDasharray="3 3"
                                />
                                <line
                                    x1={PAD.left - 4}
                                    y1={y}
                                    x2={PAD.left}
                                    y2={y}
                                    className="stroke-border"
                                    strokeWidth={1}
                                />
                                <text
                                    x={Y_TICK_X}
                                    y={y}
                                    textAnchor="end"
                                    dominantBaseline="central"
                                    className="fill-muted-foreground text-[9px]"
                                >
                                    {Math.round(frac * 100)}%
                                </text>
                            </g>
                        )
                    })}

                    {xTicks.map((frac) => {
                        const x = PAD.left + frac * CHART_W
                        return (
                            <line
                                key={`x-tick-${frac}`}
                                x1={x}
                                y1={BASELINE_Y}
                                x2={x}
                                y2={BASELINE_Y + 4}
                                className="stroke-border"
                                strokeWidth={1}
                            />
                        )
                    })}

                    <line
                        x1={PAD.left}
                        y1={PAD.top}
                        x2={PAD.left}
                        y2={BASELINE_Y}
                        className="stroke-border"
                        strokeWidth={1}
                    />
                    <line
                        x1={PAD.left}
                        y1={BASELINE_Y}
                        x2={PAD.left + CHART_W}
                        y2={BASELINE_Y}
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

                    {xTicks.map((frac) => (
                        <text
                            key={`x-label-${frac}`}
                            x={PAD.left + frac * CHART_W}
                            y={X_TICK_Y}
                            textAnchor="middle"
                            dominantBaseline="central"
                            className="fill-muted-foreground text-[9px]"
                        >
                            {Math.round(frac * 100)}%
                        </text>
                    ))}

                    <text
                        x={Y_AXIS_LABEL_X}
                        y={Y_AXIS_MID}
                        textAnchor="middle"
                        dominantBaseline="central"
                        transform={`rotate(-90 ${Y_AXIS_LABEL_X} ${Y_AXIS_MID})`}
                        className="fill-muted-foreground text-[10px] font-medium"
                    >
                        % at or below
                    </text>
                    <text
                        x={PAD.left + CHART_W / 2}
                        y={X_TITLE_Y}
                        textAnchor="middle"
                        className="fill-muted-foreground text-[9px]"
                    >
                        Accuracy
                    </text>

                    {markerX !== null && markerY !== null && callout && clampedScore !== null ? (
                        <g aria-label={markerAriaLabel}>
                            <line
                                x1={markerX}
                                y1={markerY}
                                x2={markerX}
                                y2={BASELINE_Y}
                                className="stroke-violet-950/25"
                                strokeWidth={1}
                                strokeDasharray="3 3"
                            />
                            <line
                                x1={PAD.left}
                                y1={markerY}
                                x2={markerX}
                                y2={markerY}
                                className="stroke-violet-950/25"
                                strokeWidth={1}
                                strokeDasharray="3 3"
                            />
                            <circle
                                cx={markerX}
                                cy={markerY}
                                r={4.5}
                                className="fill-violet-700 stroke-white"
                                strokeWidth={1.5}
                            />
                            <g transform={`translate(${callout.x}, ${callout.y})`}>
                                <rect
                                    width={CALLOUT_W}
                                    height={CALLOUT_H}
                                    rx={4}
                                    className="fill-white stroke-violet-200"
                                    strokeWidth={1}
                                />
                                <text
                                    x={CALLOUT_W / 2}
                                    y={12}
                                    textAnchor="middle"
                                    dominantBaseline="central"
                                    className="fill-violet-950 text-[9px] font-semibold"
                                >
                                    You · {Math.round(clampedScore * 100)}% acc.
                                </text>
                            </g>
                        </g>
                    ) : null}
                </svg>
            </div>
        </FadeIn>
    )
}
