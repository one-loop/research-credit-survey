import type { Author } from "@/lib/types"

export type BoardState = {
    pool: Author[]
    slots: (Author | null)[]
    poolOrderKey: string
}

export type BoardAction =
    | { type: "reset"; authors: Author[] }
    | { type: "slot_to_pool"; slotIndex: number }
    | { type: "pool_to_slot"; authorId: string; targetSlot: number }
    | { type: "slot_to_slot"; fromSlot: number; targetSlot: number }

export function createInitialBoardState(authors: Author[]): BoardState {
    const pool = [...authors]
    return {
        pool,
        slots: Array(authors.length).fill(null),
        poolOrderKey: pool.map((author) => author.id).join("\0"),
    }
}

export function boardReducer(state: BoardState, action: BoardAction): BoardState {
    switch (action.type) {
        case "reset": {
            return createInitialBoardState(action.authors)
        }
        case "slot_to_pool": {
            const author = state.slots[action.slotIndex]
            if (!author) return state
            const nextSlots = [...state.slots]
            nextSlots[action.slotIndex] = null
            return {
                ...state,
                pool: [...state.pool, author],
                slots: nextSlots,
            }
        }
        case "pool_to_slot": {
            const author = state.pool.find((item) => item.id === action.authorId)
            if (!author) return state
            const displaced = state.slots[action.targetSlot]
            const nextSlots = [...state.slots]
            nextSlots[action.targetSlot] = author
            return {
                ...state,
                pool: state.pool
                    .filter((item) => item.id !== action.authorId)
                    .concat(displaced ? [displaced] : []),
                slots: nextSlots,
            }
        }
        case "slot_to_slot": {
            if (action.fromSlot === action.targetSlot) return state
            const author = state.slots[action.fromSlot]
            if (!author) return state
            const nextSlots = [...state.slots]
            const displaced = nextSlots[action.targetSlot]
            nextSlots[action.targetSlot] = author
            nextSlots[action.fromSlot] = displaced
            return {
                ...state,
                slots: nextSlots,
            }
        }
        default:
            return state
    }
}

export function isSlotId(id: unknown): id is string {
    return typeof id === "string" && id.startsWith("slot:")
}

export function slotIndexFromId(id: string): number {
    return Number(id.slice("slot:".length))
}
