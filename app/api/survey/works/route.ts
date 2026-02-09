import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { worksPool } from "@/lib/mockData"
import type { Work } from "@/lib/types"

const EXPOSURE_PATH = path.join(process.cwd(), "data", "workExposure.json")
const MAX_EXPOSURE = 3
const WORKS_PER_RESPONDENT = 5

type ExposureMap = Record<string, number>

async function readExposure(): Promise<ExposureMap> {
    try {
        const raw = await fs.readFile(EXPOSURE_PATH, "utf-8")
        return JSON.parse(raw) as ExposureMap
    } catch {
        return {}
    }
}

function findWorkByAuthorId(authorId: string) {
    return worksPool.find((w) => w.authors.some((a) => a.id === authorId))
}

function shuffle<T>(array: T[]): T[] {
    const result = [...array]
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[result[i], result[j]] = [result[j], result[i]]
    }
    return result
}

export async function GET(request: NextRequest) {
    const authorId = request.nextUrl.searchParams.get("authorId") ?? undefined

    const exposure = await readExposure()

    const isUnderCap = (workId: string) => (exposure[workId] ?? 0) < MAX_EXPOSURE

    let ownWork = authorId ? findWorkByAuthorId(authorId) : undefined

    const selected: Work[] = []

    // Always include the respondent's own paper (if found),
    // even if it has already reached the exposure cap.
    if (ownWork) {
        // Mark this work as the respondent's own work for debugging.
        // This flag can be used on the client to visually verify that
        // the correct paper is included. It should not be surfaced in
        // the production UI.
        selected.push({ ...ownWork, isOwnWork: true })
    }

    const remainingSlots = WORKS_PER_RESPONDENT - selected.length

    // Determine field constraint based on the respondent's own paper
    const targetField = ownWork?.field

    let candidatePool = worksPool.filter((work) => {
        if (ownWork && work.work_id === ownWork.work_id) return false
        if (!isUnderCap(work.work_id)) return false
        if (targetField && work.field !== targetField) return false
        return true
    })

    // If we didn't find a field (e.g. no ownWork), fall back to all under-cap works
    if (!targetField) {
        candidatePool = worksPool.filter((work) => {
            if (ownWork && work.work_id === ownWork.work_id) return false
            return isUnderCap(work.work_id)
        })
    }

    const shuffled = shuffle(candidatePool)

    for (const work of shuffled) {
        if (selected.length >= WORKS_PER_RESPONDENT) break
        if (!selected.some((w) => w.work_id === work.work_id)) {
            selected.push(work)
        }
    }

    return NextResponse.json({ works: selected })
}
