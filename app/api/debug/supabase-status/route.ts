import { NextResponse } from "next/server"

/**
 * GET /api/debug/supabase-status
 * Returns whether Supabase env vars are set and if the URL looks correct.
 * Use this to confirm why the app might be falling back to mock data.
 */
export async function GET() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
    const urlTrimmed = url.trim()
    const keyTrimmed = key.trim()

    const urlSet = urlTrimmed.length > 0
    const keySet = keyTrimmed.length > 0
    const urlLooksLikeKey = urlTrimmed.startsWith("eyJ") || urlTrimmed.length > 60
    const configured = urlSet && keySet && !urlLooksLikeKey

    return NextResponse.json({
        configured,
        urlSet,
        keySet,
        hint: urlLooksLikeKey
            ? "NEXT_PUBLIC_SUPABASE_URL looks like a JWT/key. It must be the project URL (e.g. https://YOUR_REF.supabase.co). Get it from Supabase Dashboard → Project Settings → API → Project URL."
            : !urlSet
              ? "NEXT_PUBLIC_SUPABASE_URL is missing in .env.local"
              : !keySet
                ? "SUPABASE_SERVICE_ROLE_KEY is missing in .env.local"
                : "Env looks correct. If you still see mock data, check the server console for Supabase errors.",
    })
}
