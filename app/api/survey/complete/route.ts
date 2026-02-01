import { NextRequest, NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"

const EXPOSURE_PATH = path.join(process.cwd(), "data", "workExposure.json")
const RESPONSES_PATH = path.join(process.cwd(), "data", "responses.json")

type ExposureMap = Record<string, number>

async function readExposure(): Promise<ExposureMap> {
    try {
        const raw = await fs.readFile(EXPOSURE_PATH, "utf-8")
        return JSON.parse(raw) as ExposureMap
    } catch {
        return {}
    }
}

async function writeExposure(exposure: ExposureMap): Promise<void> {
    await fs.mkdir(path.dirname(EXPOSURE_PATH), { recursive: true })
    await fs.writeFile(EXPOSURE_PATH, JSON.stringify(exposure, null, 2), "utf-8")
}

async function appendResponse(payload: {
    workIds: string[]
    rankings: Record<string, string[]>
    completedAt: string
}): Promise<void> {
    let existing: unknown[] = []
    try {
        const raw = await fs.readFile(RESPONSES_PATH, "utf-8")
        existing = JSON.parse(raw) as unknown[]
    } catch {
        // file may not exist yet
    }
    existing.push(payload)
    await fs.mkdir(path.dirname(RESPONSES_PATH), { recursive: true })
    await fs.writeFile(RESPONSES_PATH, JSON.stringify(existing, null, 2), "utf-8")
}

export async function POST(request: NextRequest) {
    let body: { workIds: string[]; rankings: Record<string, string[]> }
    try {
        body = await request.json()
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON body" },
            { status: 400 }
        )
    }

    const { workIds, rankings } = body
    if (!Array.isArray(workIds) || !rankings || typeof rankings !== "object") {
        return NextResponse.json(
            { error: "Body must include workIds (array) and rankings (object)" },
            { status: 400 }
        )
    }

    const exposure = await readExposure()

    for (const workId of workIds) {
        exposure[workId] = (exposure[workId] ?? 0) + 1
    }

    await writeExposure(exposure)
    await appendResponse({
        workIds,
        rankings,
        completedAt: new Date().toISOString(),
    })

    return NextResponse.json({ ok: true })
}
