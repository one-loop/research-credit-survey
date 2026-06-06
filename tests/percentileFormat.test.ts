import { describe, expect, it } from "vitest"
import { formatOrdinal } from "@/lib/survey/percentileFormat"

describe("formatOrdinal", () => {
    it("formats standard ordinals", () => {
        expect(formatOrdinal(1)).toBe("1st")
        expect(formatOrdinal(2)).toBe("2nd")
        expect(formatOrdinal(3)).toBe("3rd")
        expect(formatOrdinal(4)).toBe("4th")
        expect(formatOrdinal(72)).toBe("72nd")
    })

    it("handles teens and round numbers", () => {
        expect(formatOrdinal(11)).toBe("11th")
        expect(formatOrdinal(12)).toBe("12th")
        expect(formatOrdinal(13)).toBe("13th")
        expect(formatOrdinal(21)).toBe("21st")
        expect(formatOrdinal(100)).toBe("100th")
    })

    it("rounds fractional percentiles", () => {
        expect(formatOrdinal(74.6)).toBe("75th")
        expect(formatOrdinal(74.4)).toBe("74th")
    })
})
