export type AuthorPosition = "first" | "middle" | "last"
export type FirstLastPosition = "first" | "last"

/** CRediT role id -> who is most likely to perform that role. */
export type CreditRolePositionBeliefs = Record<string, AuthorPosition>

export type AuthorPositionBeliefs = {
    younger: FirstLastPosition
    pi: FirstLastPosition
}

export function creditRolePositionBeliefsStorageKey(authorId: string | null | undefined): string {
    return `creditRolePositionBeliefs_${authorId ?? "none"}`
}

export function authorPositionBeliefsStorageKey(authorId: string | null | undefined): string {
    return `authorPositionBeliefs_${authorId ?? "none"}`
}

export function readCreditRolePositionBeliefsFromSession(
    authorId: string | null | undefined
): CreditRolePositionBeliefs | undefined {
    if (typeof window === "undefined") return undefined
    const stored = window.sessionStorage.getItem(creditRolePositionBeliefsStorageKey(authorId))
    if (!stored) return undefined
    try {
        return JSON.parse(stored) as CreditRolePositionBeliefs
    } catch {
        return undefined
    }
}

export function readAuthorPositionBeliefsFromSession(
    authorId: string | null | undefined
): AuthorPositionBeliefs | undefined {
    if (typeof window === "undefined") return undefined
    const stored = window.sessionStorage.getItem(authorPositionBeliefsStorageKey(authorId))
    if (!stored) return undefined
    try {
        return JSON.parse(stored) as AuthorPositionBeliefs
    } catch {
        return undefined
    }
}

export function readPreTaskBeliefsForSubmit(authorId: string | null | undefined): {
    creditRolePositionBeliefs?: CreditRolePositionBeliefs
    authorPositionBeliefs?: AuthorPositionBeliefs
} {
    return {
        creditRolePositionBeliefs: readCreditRolePositionBeliefsFromSession(authorId),
        authorPositionBeliefs: readAuthorPositionBeliefsFromSession(authorId),
    }
}
