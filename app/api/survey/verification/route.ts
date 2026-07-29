import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase/server"
import { hydratePaperRowsById, type PaperRow } from "@/lib/db/papers"
import { rankingAccuracyForWork } from "@/lib/survey/rankingAccuracy"
import { worksPool } from "@/lib/mockData"

const RESPONSES_PATH = path.join(process.cwd(), "data", "responses.json")

export type VerificationResponsePayload = {
    responseId: string
    workId: string
    title: string
    journal: string
    year: string
    correctAuthors: Array<{ id: string; name: string; initials: string; isCorresponding: boolean }>
    respondentRanking: Array<{ id: string; name: string; initials: string }>
    accuracy: number | null
    consentStatus?: string | null
    consentExplanation?: string | null
}

export async function GET(request: NextRequest) {
    const responseId = request.nextUrl.searchParams.get("responseId")
    const authorId = request.nextUrl.searchParams.get("authorId")
    const responseIdsParam = request.nextUrl.searchParams.get("responseIds")

    if (!responseId && !authorId && !responseIdsParam) {
        return NextResponse.json({ error: "Missing responseId or authorId" }, { status: 400 })
    }

    try {
        let responseRows: any[] = []

        // 1. Fetch relevant response rows
        if (isSupabaseConfigured()) {
            const supabase = getSupabase()
            let fetchedRows: any[] = []

            if (responseIdsParam) {
                const ids = responseIdsParam.split(",").map((s) => s.trim()).filter(Boolean)
                if (ids.length > 0) {
                    const { data } = await supabase.from("experiment_responses").select("*").in("id", ids)
                    if (data) fetchedRows = data
                }
            } else if (responseId) {
                const { data } = await supabase.from("experiment_responses").select("*").eq("id", responseId)
                if (data) fetchedRows = data
            } else if (authorId) {
                const { data } = await supabase.from("experiment_responses").select("*").eq("author_id", authorId)
                if (data) fetchedRows = data
            }

            const resolvedAuthorId = authorId || fetchedRows.find((r) => r.author_id)?.author_id
            if (resolvedAuthorId) {
                const { data: authorResps } = await supabase
                    .from("experiment_responses")
                    .select("*")
                    .eq("author_id", resolvedAuthorId)
                responseRows = authorResps && authorResps.length > 0 ? authorResps : fetchedRows
            } else {
                responseRows = fetchedRows
            }
        } else {
            // Local file-based fallback
            try {
                const raw = await fs.readFile(RESPONSES_PATH, "utf-8")
                const responses = JSON.parse(raw) as any[]
                let fetchedRows: any[] = []

                if (responseIdsParam) {
                    const ids = new Set(responseIdsParam.split(",").map((s) => s.trim()))
                    fetchedRows = responses.filter((r) => ids.has(r.responseId || r.id))
                } else if (responseId) {
                    fetchedRows = responses.filter((r) => r.responseId === responseId || r.id === responseId)
                } else if (authorId) {
                    fetchedRows = responses.filter((r) => r.author_id === authorId)
                }

                const resolvedAuthorId = authorId || fetchedRows.find((r) => r.author_id)?.author_id
                if (resolvedAuthorId) {
                    const authorResps = responses.filter((r) => r.author_id === resolvedAuthorId)
                    responseRows = authorResps.length > 0 ? authorResps : fetchedRows
                } else {
                    responseRows = fetchedRows
                }
            } catch {
                // file may not exist
            }
        }

        if (responseRows.length === 0) {
            return NextResponse.json({ ok: true, ownPapers: [], alreadyConsented: false })
        }

        // Check if any response from this participant was already consented
        const alreadyConsented = responseRows.some(
            (r) =>
                r.consent_status === "consented" ||
                r.respondent_demographics?.consent_status === "consented"
        )

        // 2. Identify all own papers across the participant's responses
        const ownPaperEntries: Array<{ responseRow: any; ownWorkId: string }> = []
        const effectiveAuthorId = authorId || responseRows.find((r) => r.author_id)?.author_id

        for (const row of responseRows) {
            let ownWorkId = row.own_work || null
            if (!ownWorkId && effectiveAuthorId) {
                const workIds = Array.isArray(row.work_ids) ? row.work_ids : Object.keys(row.rankings || {})
                const mockOwn = worksPool.find(
                    (w) => workIds.includes(w.work_id) && w.authors.some((a) => a.id === effectiveAuthorId)
                )
                if (mockOwn) {
                    ownWorkId = mockOwn.work_id
                }
            }
            if (ownWorkId) {
                ownPaperEntries.push({ responseRow: row, ownWorkId })
            }
        }

        if (ownPaperEntries.length === 0) {
            return NextResponse.json({ ok: true, ownPapers: [], alreadyConsented })
        }

        // 3. Hydrate the papers
        const ownWorkIds = Array.from(new Set(ownPaperEntries.map((e) => e.ownWorkId)))
        let papersMap = new Map<string, PaperRow>()
        if (isSupabaseConfigured() && ownWorkIds.length > 0) {
            papersMap = await hydratePaperRowsById(ownWorkIds)
        }

        const hydratedOwnPapers: VerificationResponsePayload[] = []

        for (const { responseRow: row, ownWorkId: wId } of ownPaperEntries) {
            let paper = papersMap.get(wId)
            if (!paper) {
                const mockMatch = worksPool.find((w) => w.work_id === wId)
                if (mockMatch) {
                    paper = {
                        work_id: mockMatch.work_id,
                        topic: mockMatch.display_name,
                        title: mockMatch.display_name,
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

            const rankings: Record<string, string[]> = row.rankings || {}
            const respondentSortedIds = rankings[wId] || []
            const respondentRanking = respondentSortedIds.map((aId) => {
                const match = correctAuthors.find((ca) => ca.id === aId)
                return {
                    id: aId,
                    name: match ? match.name : "Unknown",
                    initials: match ? match.initials : "?",
                }
            })

            let accuracy: number | null = null
            if (row.work_accuracies && typeof row.work_accuracies[wId] === "number" && Number.isFinite(row.work_accuracies[wId])) {
                accuracy = row.work_accuracies[wId]
            } else {
                const canonicalForAccuracy = originalAuthors.map((a: any, idx: number) => ({
                    id: a.author_id || a.id || String(idx),
                    equal_contrib: Boolean(a.equal_contrib || a.equalContrib),
                }))
                accuracy = rankingAccuracyForWork(canonicalForAccuracy, respondentSortedIds)

                if (accuracy === null && originalAuthors.length >= 2 && respondentSortedIds.length >= 2) {
                    // Try positional indexing if ID strings differed
                    const posCanonical = originalAuthors.map((a: any, idx: number) => ({
                        id: String(idx),
                        equal_contrib: Boolean(a.equal_contrib || a.equalContrib),
                    }))
                    const posRanking = respondentSortedIds.map((aId) => {
                        const foundIdx = originalAuthors.findIndex((a: any, idx: number) => (a.author_id || a.id || String(idx)) === aId)
                        return foundIdx >= 0 ? String(foundIdx) : aId
                    })
                    accuracy = rankingAccuracyForWork(posCanonical, posRanking)
                }
            }

            if (accuracy === null && typeof row.average_accuracy === "number" && Number.isFinite(row.average_accuracy)) {
                accuracy = row.average_accuracy
            }
            const year = paper.publication_date ? paper.publication_date.substring(0, 4) : "N/A"

            const respId = row.id || row.responseId || ""

            hydratedOwnPapers.push({
                responseId: respId,
                workId: wId,
                title: paper.title || paper.topic || paper.work_id,
                journal: paper.journal || "Unknown Journal",
                year,
                correctAuthors,
                respondentRanking,
                accuracy,
                consentStatus: row.consent_status || row.respondent_demographics?.consent_status || null,
                consentExplanation: row.consent_explanation || row.respondent_demographics?.consent_explanation || null,
            })
        }

        const firstRow = responseRows[0] || {}

        return NextResponse.json({
            ok: true,
            ownPapers: hydratedOwnPapers,
            experimentType: firstRow.experiment_type || "A",
            queue: firstRow.queue_index || 0,
            alreadyConsented,
        })
    } catch (err: any) {
        console.error("Error in GET /api/survey/verification:", err)
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
    }
}

async function updateSingleConsent(
    responseId: string,
    consentStatus: string,
    explanation?: string | null
) {
    const trimmedExplanation = typeof explanation === "string" && explanation.trim().length > 0 ? explanation.trim() : null

    if (isSupabaseConfigured()) {
        const supabase = getSupabase()

        const updatePayload: Record<string, any> = { consent_status: consentStatus }
        if (trimmedExplanation) {
            updatePayload.consent_explanation = trimmedExplanation
        }

        const { error: columnError } = await supabase
            .from("experiment_responses")
            .update(updatePayload)
            .eq("id", responseId)

        if (columnError) {
            console.warn(
                `Failed to update consent columns directly for ${responseId}, trying fallback...`,
                columnError.message
            )

            const { error: statusOnlyError } = await supabase
                .from("experiment_responses")
                .update({ consent_status: consentStatus })
                .eq("id", responseId)

            const { data: currentData } = await supabase
                .from("experiment_responses")
                .select("respondent_demographics,feedback")
                .eq("id", responseId)
                .single()

            const priorDemographics = currentData?.respondent_demographics || {}
            const updatedDemographics = {
                ...priorDemographics,
                consent_status: consentStatus,
                ...(trimmedExplanation && { consent_explanation: trimmedExplanation }),
            }

            const currentFeedback = currentData?.feedback || ""
            const explanationTag = trimmedExplanation ? ` | Explanation: ${trimmedExplanation}` : ""
            const updatedFeedback = currentFeedback
                ? `${currentFeedback}\n[IRB Consent: ${consentStatus}${explanationTag}]`
                : `[IRB Consent: ${consentStatus}${explanationTag}]`

            const { error: fallbackError } = await supabase
                .from("experiment_responses")
                .update({
                    respondent_demographics: updatedDemographics,
                    feedback: updatedFeedback,
                })
                .eq("id", responseId)

            if (fallbackError && statusOnlyError) {
                throw new Error(`Failed to update consent status for ${responseId}`)
            }
        }
    } else {
        // File-based update
        const raw = await fs.readFile(RESPONSES_PATH, "utf-8")
        const responses = JSON.parse(raw) as any[]
        const match = responses.find((r) => r.responseId === responseId || r.id === responseId)
        if (match) {
            match.consent_status = consentStatus
            if (trimmedExplanation) {
                match.consent_explanation = trimmedExplanation
            }
            if (!match.respondent_demographics) {
                match.respondent_demographics = {}
            }
            match.respondent_demographics.consent_status = consentStatus
            if (trimmedExplanation) {
                match.respondent_demographics.consent_explanation = trimmedExplanation
            }
            await fs.writeFile(RESPONSES_PATH, JSON.stringify(responses, null, 2), "utf-8")
        }
    }
}

export async function POST(request: NextRequest) {
    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    try {
        if (Array.isArray(body.decisions)) {
            const decisions: Array<{ responseId: string; consentStatus: string; explanation?: string }> = body.decisions
            for (const d of decisions) {
                if (d.responseId && d.consentStatus) {
                    await updateSingleConsent(d.responseId, d.consentStatus, d.explanation)
                }
            }
        } else if (body.responseId && body.consentStatus) {
            await updateSingleConsent(body.responseId, body.consentStatus, body.explanation)
        } else {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
        }

        return NextResponse.json({ ok: true })
    } catch (err: any) {
        console.error("Error in POST /api/survey/verification:", err)
        return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 })
    }
}
