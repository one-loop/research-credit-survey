/** e.g. 1 → "1st", 72 → "72nd" */
export function formatOrdinal(n: number): string {
    const rounded = Math.round(n)
    const mod100 = rounded % 100
    const mod10 = rounded % 10
    if (mod100 >= 11 && mod100 <= 13) return `${rounded}th`
    if (mod10 === 1) return `${rounded}st`
    if (mod10 === 2) return `${rounded}nd`
    if (mod10 === 3) return `${rounded}rd`
    return `${rounded}th`
}
