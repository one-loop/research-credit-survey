"use client"

import { creditRoles } from "@/lib/mockData"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

function HomeContent() {
    const searchParams = useSearchParams()
    const authorId = searchParams.get("authorId")
    const roleImportanceHref = authorId ? `/role-importance?authorId=${encodeURIComponent(authorId)}` : "/role-importance"

    return (
        <div className="max-w-3xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-8">
                Contributor Role Taxonomy (CRediT)
            </h1>

            <p className="mb-2 text-muted-foreground">
                In this survey, we are interested in how different contributor roles relate to how authors are listed on a paper. Below is a description of all 14 standard Contributor Role Taxonomy (CRediT) contributor roles, designed to represent the key types of contributions made to research articles. On the next pages you will be asked to rate how important each role is in the publication of an article, and to rank authors on example papers.
            </p>
            <p className="mb-8 text-muted-foreground">
                Please answer based on your own judgment and experience with research collaboration.
            </p>

            <div className="space-y-4">
                {creditRoles.map(role => (
                    <Card key={role.id}>
                        <CardContent className="p-4">
                            <h2 className="font-semibold">{role.name}</h2>
                            <p className="text-sm text-muted-foreground">
                                {role.description}
                            </p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="mt-8 flex justify-end">
                <Link href={roleImportanceHref}>
                    <Button>Continue</Button>
                </Link>
            </div>
        </div>
    )
}

export default function Home() {
    return (
        <Suspense fallback={
            <div className="max-w-3xl mx-auto p-6">
                <p className="text-muted-foreground">Loading…</p>
            </div>
        }>
            <HomeContent />
        </Suspense>
    )
}
