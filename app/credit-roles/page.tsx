"use client"

import { creditRoles } from "@/lib/mockData"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Suspense } from "react"
import { useSearchParams } from "next/navigation"

function CreditRolesContent() {
    const searchParams = useSearchParams()
    const authorId = searchParams.get("authorId")
    const roleImportanceHref = authorId ? `/role-importance?authorId=${encodeURIComponent(authorId)}` : "/role-importance"

    return (
        <div className="max-w-3xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-4">
                Contributor Role Taxonomy (CRediT)
            </h1>

            <p className="mb-2 text-muted-foreground">
                CRediT is a community-developed taxonomy of 14 contributor roles that capture the key types of contributions made to research outputs, including journal articles. It was created to complement traditional authorship by providing a clearer, more structured account of how research is produced and who contributed what.
            </p>
            <p className="mb-2 text-muted-foreground">
                Beyond scholarly publishing, contributorship information can support research assessment, expert identification, research integrity, and accountability.
            </p>
            <p className="mb-8 text-muted-foreground">Learn more: <a href="https://credit.niso.org" target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">https://credit.niso.org</a></p>

            <div className="space-y-4">
            {creditRoles.map(role => (
                <Card key={role.id}>
                    <CardContent className="p-4">
                        <h2 className="font-semibold">{role.name}</h2>
                        <p className="text-sm text-gray-600">
                            {role.description}
                        </p>
                    </CardContent>
                </Card>
                ))}
            </div>

            <div className="mt-8 flex justify-end">
                <Button asChild>
                    <Link href={roleImportanceHref}>Continue</Link>
                </Button>
            </div>
        </div>
    )
}

export default function CreditRolesPage() {
    return (
        <Suspense fallback={
            <div className="max-w-3xl mx-auto p-6">
                <p className="text-muted-foreground">Loading…</p>
            </div>
        }>
            <CreditRolesContent />
        </Suspense>
    )
}