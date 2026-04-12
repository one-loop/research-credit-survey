import { NextResponse } from "next/server"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"

/**
 * True when at least one paper has appeared in >= 3 completed Experiment A sessions
 * (counted by rows in experiment_responses with experiment_type = 'A').
 */
async function anyPaperHasThreeOrMoreExperimentAResponses(): Promise<boolean> {
    if (!isSupabaseConfigured()) return false
    try {
        const supabase = getSupabase()
        const { data, error } = await supabase
            .from("experiment_responses")
            .select("work_ids")
            .eq("experiment_type", "A")

        if (error || !data?.length) return false

        const counts = new Map<string, number>()
        for (const row of data as Array<{ work_ids: string[] | null }>) {
            for (const workId of row.work_ids ?? []) {
                counts.set(workId, (counts.get(workId) ?? 0) + 1)
            }
        }
        for (const c of counts.values()) {
            if (c >= 3) return true
        }
        return false
    } catch {
        return false
    }
}

/**
 * GET — which experiment this session may be assigned.
 * Experiment C is only eligible after at least one paper has 3+ Experiment A responses.
 * When eligible, A vs C is 50/50; otherwise always A.
 */
export async function GET() {
    if (!isSupabaseConfigured()) {
        const experiment: "A" | "C" = Math.random() < 0.5 ? "C" : "A"
        return NextResponse.json({
            experiment,
            gateOpen: true,
            dataSource: "mock" as const,
        })
    }

    const gateOpen = await anyPaperHasThreeOrMoreExperimentAResponses()
    const experiment: "A" | "C" = gateOpen && Math.random() < 0.5 ? "C" : "A"

    return NextResponse.json({
        experiment,
        gateOpen,
        dataSource: "supabase" as const,
    })
}
