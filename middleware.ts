import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { SURVEY_PARTICIPANT_COOKIE } from "@/lib/survey/participant"

/**
 * First navigation with `?authorId=` stores the id in an httpOnly cookie and
 * redirects to the same path without exposing it in the address bar.
 */
export function middleware(request: NextRequest) {
    const url = request.nextUrl.clone()
    const rawAuthor = url.searchParams.get("authorId") ?? url.searchParams.get("author_id")

    // Explicit reset / anonymous trigger for testing
    if (rawAuthor === "none" || rawAuthor === "clear" || url.searchParams.get("anonymous") === "true") {
        url.searchParams.delete("authorId")
        url.searchParams.delete("author_id")
        url.searchParams.delete("anonymous")
        const res = NextResponse.redirect(url)
        res.cookies.delete(SURVEY_PARTICIPANT_COOKIE)
        return res
    }

    const authorId = rawAuthor?.trim()
    if (!authorId) {
        return NextResponse.next()
    }

    url.searchParams.delete("authorId")
    url.searchParams.delete("author_id")
    const res = NextResponse.redirect(url)
    res.cookies.set(SURVEY_PARTICIPANT_COOKIE, authorId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
    })
    return res
}

export const config = {
    matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
}
