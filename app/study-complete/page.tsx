"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function StudyCompletePage() {
    return (
        <div className="max-w-lg mx-auto p-6">
            <h1 className="text-3xl font-bold tracking-tight mb-4">Thank you for taking part</h1>
            <p className="text-base text-muted-foreground leading-relaxed mb-4">
                Your responses are a valuable part of this experiment. We appreciate the time and
                care you put into ranking author contributions.
            </p>
            <p className="text-base text-muted-foreground leading-relaxed mb-6">
                You may now close this window. 
            </p>
            <Button variant="outline" asChild>
                <Link href="/">Return home</Link>
            </Button>
        </div>
    )
}
