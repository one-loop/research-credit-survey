import { describe, expect, it } from "vitest"
import { displayJournalName } from "@/lib/survey/journalDisplay"

describe("displayJournalName", () => {
    it("shortens PNAS variants", () => {
        expect(displayJournalName("Proceedings of the National Academy of Sciences")).toBe("PNAS")
        expect(displayJournalName("PNAS")).toBe("PNAS")
    })

    it("normalizes PLOS variants", () => {
        expect(displayJournalName("PLoS ONE")).toBe("PLOS ONE")
        expect(displayJournalName("PLOS ONE")).toBe("PLOS ONE")
    })
})
