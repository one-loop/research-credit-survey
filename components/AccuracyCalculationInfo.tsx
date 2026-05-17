"use client"

import { Info } from "lucide-react"
import { ACCURACY_CALCULATION_TOOLTIP } from "@/lib/survey/accuracyExplanation"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"

export function AccuracyCalculationInfo() {
    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors cursor-help underline-offset-4 hover:underline"
                    >
                        <Info className="h-4 w-4 shrink-0" aria-hidden />
                        <span>How do we calculate your accuracy?</span>
                    </button>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    sideOffset={8}
                    className="max-w-sm px-3 py-2 text-xs leading-relaxed text-background"
                >
                    {ACCURACY_CALCULATION_TOOLTIP}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
