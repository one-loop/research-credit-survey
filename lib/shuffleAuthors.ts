import type { Author } from "@/lib/types"

/** Fisher–Yates shuffle of a copy; used for initial draggable author order. */
export function shuffledAuthorsForRanking(authors: Author[]): Author[] {
    const copy = [...authors]
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy
}

/** List index of the corresponding-author slot in the publication byline (envelope position). */
export function publicationCorrespondingSlotIndex(authors: Author[]): number {
    return authors.findIndex((a) => a.is_corresponding)
}
