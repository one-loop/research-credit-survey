import { describe, expect, it } from "vitest"
import type { Author } from "@/lib/types"
import { boardReducer, createInitialBoardState } from "@/lib/survey/authorBylineBoardState"

function author(id: string): Author {
    return {
        id,
        name: id,
        initials: id,
        is_corresponding: false,
        contributions: [],
    }
}

describe("author byline board reducer", () => {
    const authors = [author("a"), author("b"), author("c")]

    it("moves an author from pool to an empty slot", () => {
        let state = createInitialBoardState(authors)
        state = boardReducer(state, { type: "pool_to_slot", authorId: "a", targetSlot: 0 })
        expect(state.slots[0]?.id).toBe("a")
        expect(state.pool.some((a) => a.id === "a")).toBe(false)
    })

    it("returns displaced author to pool when dropping onto occupied slot", () => {
        let state = createInitialBoardState(authors)
        state = boardReducer(state, { type: "pool_to_slot", authorId: "a", targetSlot: 0 })
        state = boardReducer(state, { type: "pool_to_slot", authorId: "b", targetSlot: 0 })
        expect(state.slots[0]?.id).toBe("b")
        expect(state.pool.map((a) => a.id)).toContain("a")
    })

    it("swaps authors between slots", () => {
        let state = createInitialBoardState(authors)
        state = boardReducer(state, { type: "pool_to_slot", authorId: "a", targetSlot: 0 })
        state = boardReducer(state, { type: "pool_to_slot", authorId: "b", targetSlot: 1 })
        state = boardReducer(state, { type: "slot_to_slot", fromSlot: 0, targetSlot: 1 })
        expect(state.slots[0]?.id).toBe("b")
        expect(state.slots[1]?.id).toBe("a")
    })

    it("moves an author from slot back to pool", () => {
        let state = createInitialBoardState(authors)
        state = boardReducer(state, { type: "pool_to_slot", authorId: "c", targetSlot: 2 })
        state = boardReducer(state, { type: "slot_to_pool", slotIndex: 2 })
        expect(state.slots[2]).toBeNull()
        expect(state.pool.map((a) => a.id)).toContain("c")
    })
})
