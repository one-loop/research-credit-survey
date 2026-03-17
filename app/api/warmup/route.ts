import { NextResponse } from "next/server"
import { isSupabaseConfigured } from "@/lib/supabase/server"
import { getExperimentPapers } from "@/lib/db/papers"

// Simple warmup endpoint to keep Supabase and the works API path hot.
// Call this periodically from an uptime/cron service (e.g. every 5–10 minutes).
export async function GET() {
    const useSupabase = isSupabaseConfigured()

    if (useSupabase) {
        try {
            const start = Date.now()
            // authorId = null so this just exercises the generic path
            const works = await getExperimentPapers(null, 5)
            const duration = Date.now() - start
            console.log("[warmup] getExperimentPapers took", duration, "ms | rows:", works.length)
        } catch (err) {
            console.error("[warmup] error warming Supabase:", err)
        }
    }

    return NextResponse.json({ ok: true })
}

