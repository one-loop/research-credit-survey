import type { NextRequest } from "next/server"

/** HttpOnly cookie set after stripping `authorId` from the URL (see middleware). */
export const SURVEY_PARTICIPANT_COOKIE = "survey_participant_id"

/** Client-side cache key so session keys stay stable without URL params. */
export const SURVEY_PARTICIPANT_STORAGE_KEY = "surveyParticipantAuthorId"

/**
 * Resolve participant author id: prefer cookie, then legacy query param.
 * Query is supported for API callers that have not migrated yet.
 */
export function getParticipantAuthorId(request: NextRequest): string | undefined {
    const fromCookie = request.cookies.get(SURVEY_PARTICIPANT_COOKIE)?.value?.trim()
    const fromQuery = request.nextUrl.searchParams.get("authorId")?.trim()
    return fromCookie || fromQuery || undefined
}
