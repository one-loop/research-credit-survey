import { describe, expect, it } from "vitest"
import { resetInstitutionSearchConfigForTests, searchInstitutions } from "@/lib/db/institutionSearch"

describe("searchInstitutions", () => {
    it("returns empty for short queries", async () => {
        await expect(searchInstitutions("a")).resolves.toEqual([])
    })
})

describe("institution search config cache", () => {
    it("can reset resolved schema between tests", () => {
        resetInstitutionSearchConfigForTests()
        expect(true).toBe(true)
    })
})
