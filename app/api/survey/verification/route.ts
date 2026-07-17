import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"
import { hydratePaperRowsById, type PaperRow } from "@/lib/db/papers"
import { rankingAccuracyForWork } from "@/lib/survey/rankingAccuracy"
import { worksPool } from "@/lib/mockData"

const RESPONSES_PATH = path.join(process.cwd(), "data", "responses.json")

type VerificationResponsePayload = {
    workId: string
    title: string
    journal: string
    year: string
    correctAuthors: Array<{ id: string; name: string; initials: string; isCorresponding: boolean }>
    respondentRanking: Array<{ id: string; name: string; initials: string }>
    accuracy: number | null
}

export async function GET(request: NextRequest) {
    const responseId = request.nextUrl.searchParams.get("responseId")
    if (!responseId) {
        return NextResponse.json({ error: "Missing responseId" }, { status: 400 })
    }

    try {
        let responseRow: any = null

        // 1. Fetch the response row
        if (isSupabaseConfigured()) {
            const supabase = getSupabase()
            const { data, error } = await supabase
                .from("experiment_responses")
                .select("*")
                .eq("id", responseId)
                .single()

            if (error || !data) {
                console.error("Failed to fetch response from Supabase:", error?.message)
                return NextResponse.json({ error: "Response not found in DB" }, { status: 404 })
            }
            responseRow = data
        } else {
            try {
                const raw = await fs.readFile(RESPONSES_PATH, "utf-8")
                const responses = JSON.parse(raw) as any[]
                responseRow = responses.find((r) => r.responseId === responseId)
            } catch (err) {
                // file may not exist
            }
            if (!responseRow) {
                return NextResponse.json({ error: "Response not found in local file" }, { status: 404 })
            }
        }

        const workIds: string[] = responseRow.work_ids || []
        const rankings: Record<string, string[]> = responseRow.rankings || {}
        const ownWorkId: string | null = responseRow.own_work || null
        const authorId: string | null = responseRow.author_id || null

        // Check if this respondent has already consented to any previous responses
        let alreadyConsented = false
        if (authorId) {
            if (isSupabaseConfigured()) {
                const supabase = getSupabase()
                const { data: siblings } = await supabase
                    .from("experiment_responses")
                    .select("consent_status, respondent_demographics")
                    .eq("author_id", authorId)
                    .neq("id", responseId)

                if (siblings && siblings.length > 0) {
                    alreadyConsented = siblings.some(
                        (s: any) =>
                            s.consent_status === "consented" ||
                            s.respondent_demographics?.consent_status === "consented"
                    )
                }
            } else {
                try {
                    const raw = await fs.readFile(RESPONSES_PATH, "utf-8")
                    const responses = JSON.parse(raw) as any[]
                    const siblings = responses.filter(
                        (r) => r.author_id === authorId && r.responseId !== responseId
                    )
                    alreadyConsented = siblings.some(
                        (s: any) =>
                            s.consent_status === "consented" ||
                            s.respondent_demographics?.consent_status === "consented"
                    )
                } catch {
                    // file might not exist
                }
            }
        }

        // 2. Identify target own paper(s) to show
        // We will scan the workIds and check if they match the ownWorkId, OR if
        // the authorId is in their authors array (supporting multiple if needed)
        const ownPapersToFetch = new Set<string>()
        if (ownWorkId) {
            ownPapersToFetch.add(ownWorkId)
        }

        // 3. Hydrate the papers
        let papersMap = new Map<string, PaperRow>()
        if (isSupabaseConfigured() && ownPapersToFetch.size > 0) {
            papersMap = await hydratePaperRowsById(Array.from(ownPapersToFetch))
        }

        // Fallback to mock data if not in DB or empty
        const hydratedOwnPapers: VerificationResponsePayload[] = []
        for (const wId of ownPapersToFetch) {
            let paper = papersMap.get(wId)
            if (!paper) {
                // look up in mock pool
                const mockMatch = worksPool.find((w) => w.work_id === wId)
                if (mockMatch) {
                    paper = {
                        work_id: mockMatch.work_id,
                        topic: mockMatch.display_name,
                        journal: mockMatch.journal || null,
                        publication_date: mockMatch.publication_date || null,
                        authors: (mockMatch.authors || []).map((a) => ({
                            author_id: a.id,
                            id: a.id,
                            name: a.name || a.initials || "?",
                            initials: a.initials,
                            corresponding: a.is_corresponding,
                            contributions: a.contributions,
                        })),
                        corresponding_email: mockMatch.corresponding_email || null,
                        field: mockMatch.field || null,
                        domain: mockMatch.domain || null,
                        subfield: null,
                    }
                }
            }

            if (!paper) continue

            const originalAuthors = paper.authors || []
            const correctAuthors = originalAuthors.map((a: any) => ({
                id: a.author_id || a.id || "",
                name: a.name || a.initials || "Unknown",
                initials: a.initials || "?",
                isCorresponding: Boolean(a.corresponding || a.is_corresponding || a.isCorresponding),
            }))

            // Map the respondent's sorted list of author IDs to non-anonymized names
            const respondentSortedIds = rankings[wId] || []
            const respondentRanking = respondentSortedIds.map((aId) => {
                const match = correctAuthors.find((ca) => ca.id === aId)
                return {
                    id: aId,
                    name: match ? match.name : "Unknown",
                    initials: match ? match.initials : "?",
                }
            })

            // Calculate accuracy for this specific own paper
            const canonicalForAccuracy = originalAuthors.map((a: any) => ({
                id: a.author_id || a.id || "",
                equal_contrib: Boolean(a.equal_contrib || a.equalContrib),
            }))
            const accuracy = rankingAccuracyForWork(canonicalForAccuracy, respondentSortedIds)

            const year = paper.publication_date ? paper.publication_date.substring(0, 4) : "N/A"

            hydratedOwnPapers.push({
                workId: wId,
                title: paper.topic || paper.work_id,
                journal: paper.journal || "Unknown Journal",
                year,
                correctAuthors,
                respondentRanking,
                accuracy,
            })
        }

        return NextResponse.json({
            ok: true,
            ownPapers: hydratedOwnPapers,
            experimentType: responseRow.experiment_type || "A",
            queue: responseRow.queue_index || 0,
            alreadyConsented,
        })

    } catch (err: any) {
        console.error("Error in GET /api/survey/verification:", err)
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    let body: { responseId: string; consentStatus: string }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    const { responseId, consentStatus } = body
    if (!responseId || !consentStatus) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    try {
        if (isSupabaseConfigured()) {
            const supabase = getSupabase()

            // 1. Try to update using proper consent_status column
            const { error: columnError } = await supabase
                .from("experiment_responses")
                .update({ consent_status: consentStatus })
                .eq("id", responseId)

            if (columnError) {
                console.warn(
                    "Failed to update consent_status column directly, falling back...",
                    columnError.message
                )

                // 2. Fallback: retrieve demographics, merge consent_status and save
                const { data: currentData } = await supabase
                    .from("experiment_responses")
                    .select("respondent_demographics,feedback")
                    .eq("id", responseId)
                    .single()

                const priorDemographics = currentData?.respondent_demographics || {}
                const updatedDemographics = {
                    ...priorDemographics,
                    consent_status: consentStatus,
                }

                const currentFeedback = currentData?.feedback || ""
                const updatedFeedback = currentFeedback
                    ? `${currentFeedback}\n[IRB Consent: ${consentStatus}]`
                    : `[IRB Consent: ${consentStatus}]`

                const { error: fallbackError } = await supabase
                    .from("experiment_responses")
                    .update({
                        respondent_demographics: updatedDemographics,
                        feedback: updatedFeedback,
                    })
                    .eq("id", responseId)

                if (fallbackError) {
                    console.error("Fallback update also failed:", fallbackError.message)
                    return NextResponse.json({ error: "Failed to update consent status" }, { status: 500 })
                }
            }
        } else {
            // File-based update
            try {
                const raw = await fs.readFile(RESPONSES_PATH, "utf-8")
                const responses = JSON.parse(raw) as any[]
                const match = responses.find((r) => r.responseId === responseId)
                if (match) {
                    match.consent_status = consentStatus
                    if (!match.respondent_demographics) {
                        match.respondent_demographics = {}
                    }
                    match.respondent_demographics.consent_status = consentStatus
                    await fs.writeFile(RESPONSES_PATH, JSON.stringify(responses, null, 2), "utf-8")
                } else {
                    return NextResponse.json({ error: "Response not found" }, { status: 404 })
                }
            } catch (err) {
                return NextResponse.json({ error: "Failed to read local file" }, { status: 500 })
            }
        }

        return NextResponse.json({ ok: true })
    } catch (err: any) {
        console.error("Error in POST /api/survey/verification:", err)
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
    }
}
