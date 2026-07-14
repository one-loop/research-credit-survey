import type { Work } from "@/lib/types"

type TaskDebugPayload = {
    experimentType: "A" | "B" | "C"
    taskIndex: number
    work: Work
    dataSource: string | null
}

/** Task metadata for browser-console debugging (not shown in the UI). */
export function logExperimentTaskDebug({
    experimentType,
    taskIndex,
    work,
    dataSource,
}: TaskDebugPayload): void {
    console.log("[experiment task]", {
        experimentType,
        task: taskIndex + 1,
        paper_id: work.work_id,
        own_paper: work.isOwnWork ? "yes" : "no",
        domain: work.domain ?? "N/A",
        journal: work.journal ?? "N/A",
        data_source: dataSource === "supabase" ? "Supabase" : "mock data",
    })
}
