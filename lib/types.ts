export type CreditRole = {
    id: string
    name: string
    description: string
}

export type Author = {
    id: string
    initials: string
    contributions: string[]
}

export type Work = {
    work_id: string
    display_name: string
    authors: Author[]
}