import type { Author } from "@/lib/types"

/** Fisher–Yates shuffle of a copy; used for initial draggable author order. */
export function shuffledAuthorsForRanking(authors: Author[]): Author[] {
    if (authors.length <= 1) return [...authors]
    const copy = [...authors]
    let attempts = 0
    while (attempts < 100) {
        for (let i = copy.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[copy[i], copy[j]] = [copy[j], copy[i]]
        }
        const isSame = copy.every((a, idx) => a.id === authors[idx].id)
        if (!isSame) break
        attempts++
    }
    return copy
}

/** List index of the corresponding-author slot in the publication byline (envelope position). */
export function publicationCorrespondingSlotIndex(authors: Author[]): number {
    return authors.findIndex((a) => a.is_corresponding)
}
