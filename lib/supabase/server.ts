import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Server-side Supabase client. Use in API routes and server components only.
 */
export function getSupabase() {
    if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    }
    return createClient(supabaseUrl, supabaseServiceKey)
}

export function isSupabaseConfigured() {
    return Boolean(
        typeof process !== "undefined" &&
            process.env.NEXT_PUBLIC_SUPABASE_URL &&
            process.env.SUPABASE_SERVICE_ROLE_KEY
    )
}
