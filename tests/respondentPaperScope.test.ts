import { describe, expect, it } from "vitest"
import {
    filterRowsToRespondentScope,
    mergeRespondentScope,
    pickRespondentScopeFromOwnPapers,
    respondentScopeIsComplete,
} from "@/lib/survey/respondentPaperScope"

describe("respondentPaperScope", () => {
    it("anchors scope to the newest corresponding own paper", () => {
        expect(
            pickRespondentScopeFromOwnPapers([
                {
                    domain: "Life Sciences",
                    journal: "Proceedings of the National Academy of Sciences",
                },
                {
                    domain: "Life Sciences",
                    journal: "PLOS ONE",
                },
            ])
        ).toEqual({
            domain: "Life Sciences",
            journal: "Proceedings of the National Academy of Sciences",
        })
    })

    it("locks later queues to the first submission journal when available", () => {
        expect(
            mergeRespondentScope(
                {
                    domain: "Life Sciences",
                    journal: "Proceedings of the National Academy of Sciences",
                },
                {
                    domain: "Life Sciences",
                    journal: "PLOS ONE",
                }
            )
        ).toEqual({
            domain: "Life Sciences",
            journal: "Proceedings of the National Academy of Sciences",
        })
    })

    it("requires a journal before selecting filler papers", () => {
        expect(respondentScopeIsComplete({ domain: "Life Sciences" })).toBe(false)
        expect(
            respondentScopeIsComplete({
                domain: "Life Sciences",
                journal: "PLOS ONE",
            })
        ).toBe(true)
    })

    it("filters own papers and fillers to the scoped journal", () => {
        const scope = {
            domain: "Life Sciences",
            journal: "Proceedings of the National Academy of Sciences",
        }
        const rows = [
            { work_id: "w1", domain: "Life Sciences", journal: scope.journal },
            { work_id: "w2", domain: "Life Sciences", journal: "PLOS ONE" },
        ]
        expect(filterRowsToRespondentScope(rows, scope).map((row) => row.work_id)).toEqual(["w1"])
    })
})
