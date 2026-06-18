import { describe, expect, it } from "vitest"
import {
    authorHasCreditRole,
    normalizeContributionLabel,
} from "@/lib/survey/creditRoleMatching"

describe("creditRoleMatching", () => {
    it("normalizes dashes and casing", () => {
        expect(normalizeContributionLabel("Writing – Original Draft")).toBe("writing original draft")
        expect(normalizeContributionLabel("Formal Analysis")).toBe("formal analysis")
    })

    it("matches author contributions to canonical CRediT role names", () => {
        expect(
            authorHasCreditRole(["Conceptualization", "Formal Analysis"], "Formal analysis")
        ).toBe(true)
        expect(
            authorHasCreditRole(["Writing – original draft"], "Writing – Original Draft")
        ).toBe(true)
        expect(authorHasCreditRole(["Methdology"], "Methodology")).toBe(true)
        expect(authorHasCreditRole(["Investigation"], "Software")).toBe(false)
    })
})
