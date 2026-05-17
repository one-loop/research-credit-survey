import { NextRequest, NextResponse } from "next/server"
import {
    getExperimentCompletionStatus,
    getRespondentLatestCompletion,
} from "@/lib/db/papers"
import { getParticipantAuthorId } from "@/lib/survey/participant"
import type { ExperimentType } from "@/lib/survey/experimentAssignment"

function parseExperimentType(raw: string | null): ExperimentType | null {
    if (raw === "A" || raw === "B" || raw === "C") return raw
    return null
}

export async function GET(request: NextRequest) {
    const authorId = getParticipantAuthorId(request)
    const experimentType = parseExperimentType(request.nextUrl.searchParams.get("experimentType"))

    if (experimentType) {
        const status = await getExperimentCompletionStatus(authorId, experimentType)
        return NextResponse.json({ ...status, experimentType })
    }

    const latest = await getRespondentLatestCompletion(authorId)
    return NextResponse.json(latest)
}
