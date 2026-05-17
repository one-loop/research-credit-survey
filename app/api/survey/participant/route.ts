import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getParticipantAuthorId } from "@/lib/survey/participant"

/** Returns the current participant id from cookie (or legacy query). For client bootstrap only. */
export async function GET(request: NextRequest) {
    const authorId = getParticipantAuthorId(request)
    return NextResponse.json({ authorId: authorId ?? null })
}
