import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

type Props = {
    message: string
    /** Fade out before unmounting (e.g. when transitioning to content). */
    fading?: boolean
    /** Use a shorter fade for quick handoffs (e.g. submit → redirect). */
    fastFade?: boolean
    className?: string
}

export function SurveyLoadingScreen({
    message,
    fading = false,
    fastFade = false,
    className,
}: Props) {
    return (
        <div
            className={cn(
                "min-h-[70vh] w-full flex items-center justify-center transition-opacity",
                fastFade ? "duration-200" : "duration-300",
                fading ? "opacity-0" : "opacity-100",
                className
            )}
        >
            <div className="flex flex-row items-center gap-4">
                <Spinner />
                <p className="text-muted-foreground">{message}</p>
            </div>
        </div>
    )
}
