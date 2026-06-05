/** Respondent-facing journal label (matches main-study display rules). */
export function displayJournalName(journal: string | null | undefined): string {
    const j = (journal ?? "").trim().toLowerCase()
    if (
        j.includes("proceedings of the national academy of sciences") ||
        j === "pnas" ||
        j.includes("pnas")
    ) {
        return "PNAS"
    }
    if (j.includes("plos")) {
        return "PLOS ONE"
    }
    if (journal?.trim()) return journal.trim()
    return "PLOS ONE"
}
