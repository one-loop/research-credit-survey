export type CreditRole = {
    id: string
    name: string
    description: string
}

export type Author = {
    id: string
    initials: string
    contributions: string[]
    is_corresponding?: boolean
}

export type Work = {
    work_id: string
    display_name: string
    authors: Author[]
    doi?: string
    field?: string
    journal?: string
    publication_date?: string
    corresponding_email?: string
    /**
     * Debug-only flag used in the Experiment A flow
     * to identify the respondent's own work when an
     * authorId query parameter is supplied.
     * This is not intended to be shown in production.
     */
    isOwnWork?: boolean
}