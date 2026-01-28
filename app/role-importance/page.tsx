"use client"

import { creditRoles } from "@/lib/mockData"
import { Controller, useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Slider } from "@/components/ui/slider"

export default function RoleIMportancePage() {
    const { control, watch } = useForm({
        defaultValues: Object.fromEntries(
            creditRoles.map(role => [role.id, 5])
        ),
    })

    return (
        <div className="max-w-3xl mx-auto p-6">
            <h1 className="text-2xl font-bold mb-6">
                Role Importance
            </h1>

            <form className="space-y-6">
                {creditRoles.map(role => (
                    <div key={role.id}>
                        <label className="font-medium">
                            {role.name}
                        </label>
                        <Controller
                            name={role.id}
                            control={control}
                            render={({ field }) => (
                                <Slider
                                    min={1}
                                    max={10}
                                    step={1}
                                    className="mx-auto w-full"
                                    value={[field.value ?? 5]}
                                    onValueChange={(vals) => field.onChange(vals[0])}
                                />
                            )}
                        />
                        <div className="text-sm text-gray-500">
                            Value: {watch(role.id) ?? 5}
                        </div>          
                    </div>
                ))}
            </form>

            <div className="mt-8 flex justify-end">
                <Link href="/experiment-a">
                    <Button>
                        Continue
                    </Button>
                </Link>
            </div>
        </div>
    )
}