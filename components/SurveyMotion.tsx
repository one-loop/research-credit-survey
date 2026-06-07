"use client"

import {
    Children,
    isValidElement,
    useEffect,
    useState,
    type CSSProperties,
    type ReactNode,
} from "react"
import { cn } from "@/lib/utils"

export function usePrefersReducedMotion(): boolean {
    const [reduced, setReduced] = useState(false)

    useEffect(() => {
        const media = window.matchMedia("(prefers-reduced-motion: reduce)")
        const update = () => setReduced(media.matches)
        update()
        media.addEventListener("change", update)
        return () => media.removeEventListener("change", update)
    }, [])

    return reduced
}

export function surveyStaggerDelay(index: number, step = 45, max = 320): number {
    return Math.min(index * step, max)
}

type FadeInProps = {
    children: ReactNode
    className?: string
    delay?: number
}

/** Subtle fade + rise on mount. */
export function FadeIn({ children, className, delay = 0 }: FadeInProps) {
    const reduced = usePrefersReducedMotion()

    return (
        <div
            className={cn(!reduced && "survey-fade-in", className)}
            style={
                reduced
                    ? undefined
                    : ({ "--survey-delay": `${delay}ms` } as CSSProperties)
            }
        >
            {children}
        </div>
    )
}

type FadeInStaggerProps = {
    children: ReactNode
    className?: string
    itemClassName?: string
    step?: number
}

/** Stagger child blocks with a short cascade. */
export function FadeInStagger({
    children,
    className,
    itemClassName,
    step = 45,
}: FadeInStaggerProps) {
    const items = Children.toArray(children)

    return (
        <div className={className}>
            {items.map((child, index) => {
                const key = isValidElement(child) && child.key != null ? child.key : index
                return (
                    <FadeIn
                        key={key}
                        delay={surveyStaggerDelay(index, step)}
                        className={itemClassName}
                    >
                        {child}
                    </FadeIn>
                )
            })}
        </div>
    )
}

type TaskTransitionProps = {
    taskKey: string | number
    children: ReactNode
    className?: string
}

/** Animate when advancing to a new survey task or work item. */
export function TaskTransition({ taskKey, children, className }: TaskTransitionProps) {
    const reduced = usePrefersReducedMotion()

    return (
        <div key={taskKey} className={cn(!reduced && "survey-task-enter", className)}>
            {children}
        </div>
    )
}

/** Standard page shell with a gentle entrance. */
export function SurveyPageEnter({ children, className }: { children: ReactNode; className?: string }) {
    return (
        <FadeIn className={className} delay={0}>
            {children}
        </FadeIn>
    )
}
