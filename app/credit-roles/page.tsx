import { creditRoles } from "@/lib/mockData"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function CreditRolesPage() {
    return (
        <div className="max-w-3xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-4">
                Contributor Role Taxonomy (CRediT)
            </h1>

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
                <Link href="/role-importance">
                    <Button>Continue</Button>
                </Link>
            </div>
        </div>
    )
}