import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { worksPool } from "@/lib/mockData"

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

function findWorkByAuthorId(authorId: string): (typeof worksPool)[0] | undefined {
    return worksPool.find((w) => w.authors.some((a) => a.id === authorId))
}

export async function GET(request: NextRequest) {
    const authorId = request.nextUrl.searchParams.get("authorId") ?? undefined

    const exposure = await readExposure()

    const assignable = worksPool.filter((w) => (exposure[w.work_id] ?? 0) < MAX_EXPOSURE)
    const assignableWorkIds = new Set(assignable.map((w) => w.work_id))

    let selected: typeof worksPool = []

    if (authorId) {
        const workContainingAuthor = findWorkByAuthorId(authorId)
        if (workContainingAuthor) {
            selected.push(workContainingAuthor)
        }
    }

    if (selected.length < WORKS_PER_RESPONDENT) {
        for (let i = 0; i < assignable.length && selected.length < WORKS_PER_RESPONDENT; i++) {
            const candidate = assignable[i]
            if (!selected.some((w) => w.work_id === candidate.work_id)) {
                selected.push(candidate)
            }
        }
    }

    return NextResponse.json({ works: selected })
}
