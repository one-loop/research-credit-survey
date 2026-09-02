"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Suspense, useEffect, useState } from "react"
import { SurveyLoadingScreen } from "@/components/SurveyLoadingScreen"
import { useSurveyParticipant } from "@/lib/useSurveyParticipant"
import { useRespondentLandingReturn } from "@/lib/useRespondentLandingReturn"
import { SurveyThanksPanel } from "@/components/SurveyThanksPanel"
import { FadeIn, SurveyPageEnter } from "@/components/SurveyMotion"
import { SURVEY_PARTICIPANT_STORAGE_KEY } from "@/lib/survey/participant"

import { useRouter } from "next/navigation"
import { trackSurveyStep, initNewSessionId } from "@/lib/survey/funnelTracker"

type RespondentContext = { journal: string | null; domain: string | null }

function HomeContent() {
    const router = useRouter()
    const { authorId, ready: participantReady } = useSurveyParticipant()
    const landingReturn = useRespondentLandingReturn()
    const [loadingContext, setLoadingContext] = useState(false)
    const [showLoadingScreen, setShowLoadingScreen] = useState(false)
    const [loadingScreenFading, setLoadingScreenFading] = useState(false)
    const beginHref = "/respondent-survey"

    useEffect(() => {
        if (!participantReady) return
        if (typeof window === "undefined") return
        const preservedParticipant = sessionStorage.getItem(SURVEY_PARTICIPANT_STORAGE_KEY)
        window.sessionStorage.clear()
        if (preservedParticipant) {
            sessionStorage.setItem(SURVEY_PARTICIPANT_STORAGE_KEY, preservedParticipant)
        }
        const freshSessionId = initNewSessionId()
        trackSurveyStep({ step: "landing", sessionId: freshSessionId, authorId })
        setLoadingContext(Boolean(authorId))
        setShowLoadingScreen(Boolean(authorId))
        setLoadingScreenFading(false)
    }, [participantReady, authorId])

    useEffect(() => {
        if (landingReturn.ready && (landingReturn.hasConsented || landingReturn.consentStatus)) {
            router.replace(
                `/study-complete?experimentType=${landingReturn.experimentType}&queue=${landingReturn.latestQueueIndex}`
            )
        }
    }, [
        landingReturn.ready,
        landingReturn.hasConsented,
        landingReturn.consentStatus,
        landingReturn.experimentType,
        landingReturn.latestQueueIndex,
        router,
    ])

    useEffect(() => {
        if (!participantReady) return
        if (!authorId) {
            setLoadingContext(false)
            return
        }
        let cancelled = false
        setLoadingContext(true)
        fetch(`/api/survey/respondent-context`, { credentials: "same-origin" })
            .then((res) => (res.ok ? (res.json() as Promise<RespondentContext>) : Promise.resolve({ journal: null, domain: null })))
            .then((data) => {
                if (!cancelled && typeof window !== "undefined") {
                    const keyAuthor = authorId ?? "none"
                    window.sessionStorage.setItem(`respondentContext_${keyAuthor}`, JSON.stringify(data))
                }
            })
            .catch(() => {
                // ignore
            })
            .finally(() => {
                if (!cancelled) setLoadingContext(false)
            })
        return () => {
            cancelled = true
        }
    }, [participantReady, authorId])

    useEffect(() => {
        if (loadingContext) {
            setShowLoadingScreen(true)
            setLoadingScreenFading(false)
            return
        }
        if (!showLoadingScreen) return
        setLoadingScreenFading(true)
        const handle = window.setTimeout(() => {
            setShowLoadingScreen(false)
        }, 320)
        return () => window.clearTimeout(handle)
    }, [loadingContext, showLoadingScreen])

    if (!participantReady || !landingReturn.ready) {
        return <SurveyLoadingScreen message="Loading…" />
    }

    if (landingReturn.showThanks) {
        if (landingReturn.hasConsented || landingReturn.consentStatus) {
            return <SurveyLoadingScreen message="Redirecting to study completion…" />
        }
        return (
            <SurveyThanksPanel
                experimentType={landingReturn.experimentType}
                queue={landingReturn.latestQueueIndex}
                consent={landingReturn.consentStatus}
            />
        )
    }

    if (authorId && showLoadingScreen) {
        return (
            <SurveyLoadingScreen
                message="Loading Experiment... Just a moment"
                fading={loadingScreenFading}
            />
        )
    }

    return (
        <SurveyPageEnter className="max-w-3xl mx-auto p-6 space-y-6">
            <FadeIn>
                <h1 className="text-3xl font-bold tracking-tight mb-4">Contribution Ranking Study</h1>
                <p className="text-muted-foreground">
                    The estimated time for this study is <strong className="font-bold text-foreground">15 minutes.</strong>
                </p>
            </FadeIn>

            <FadeIn delay={60} className="space-y-6 text-base text-muted-foreground leading-relaxed">
                <p>
                    Welcome to this study conducted by Bedoor AlShebli and Shehryar Ahmed Subhani at New York University Abu Dhabi.
                </p>

                {/* Purpose of the study */}
                <div className="space-y-2">
                    <h2 className="text-lg font-bold text-foreground">Purpose of the study</h2>
                    <p>
                        Contributor roles describe who did what on a research paper, from designing the study to analyzing data to writing it up. Some journals record these contributions using a standardized system called the Contributor Roles Taxonomy (CRediT), while others describe them in the authors&apos; own words. For this study, we draw on papers from both: where contributions were written in free form, we mapped each one onto its equivalent CRediT role, so that all papers are represented using the same set of standardized roles. We&apos;re interested in how researchers interpret authorship order in light of these contributions, whether the roles are read consistently, how much weight people give to each, and how they relate to the order in which authors are listed.
                    </p>
                    <p>
                        Some details about the specific design and purpose of certain study tasks will not be disclosed before participation because this could influence your responses. These details will be fully explained after you complete the study. At that time, you will have an opportunity to ask questions and decide whether the relevant responses may be used.
                    </p>
                </div>

                {/* Study procedures */}
                <div className="space-y-2">
                    <h2 className="text-lg font-bold text-foreground">Study procedures</h2>
                    <p>Should you choose to participate, you will:</p>
                    <ol className="list-decimal pl-6 space-y-2">
                        <li>Read definitions of the CRediT contributor roles.</li>
                        <li>Rate the importance of each role to publications in your field.</li>
                        <li>Complete tasks in which you create an author byline based on disclosed author contributions.</li>
                    </ol>
                    <p className="pt-1">
                        Please answer all questions based on your own judgment and experience with research collaboration in your field.
                    </p>
                </div>

                {/* Voluntary participation and withdrawal */}
                <div className="space-y-2">
                    <h2 className="text-lg font-bold text-foreground">Voluntary participation and withdrawal</h2>
                    <p>
                        Participation is voluntary. You may stop participating at any time without penalty.
                    </p>
                    <p>
                        You may also request the withdrawal of your responses and personal data by contacting the research team. Data that have already been fully anonymized or included in aggregated analyses may no longer be identifiable or removable.
                    </p>
                </div>

                {/* Risks and benefits */}
                <div className="space-y-2">
                    <h2 className="text-lg font-bold text-foreground">Risks and benefits</h2>
                    <p>
                        We do not anticipate risks beyond those ordinarily encountered when completing an online research survey. You may not receive a direct benefit, but your participation may contribute to understanding how contributor roles relate to authorship order.
                    </p>
                </div>

                {/* Privacy and data use */}
                <div className="space-y-2">
                    <h2 className="text-lg font-bold text-foreground">Privacy and data use</h2>
                    <p>
                        The study may collect personal information, including demographic information such as gender and race, as well as information used to confirm eligibility or identify relevant publications.
                    </p>
                    <p>
                        Your information will be treated as confidential. Identifiers will be separated from research responses when possible, and findings will be reported only in anonymized or aggregated form. Your individual responses will not be shared with co-authors, employers, institutions, or the public.
                    </p>
                    <p>
                        Only authorized members of the research team will have access to identifiable data. Data will be stored securely and may be used for research, academic presentations, and publications.
                    </p>
                </div>

                {/* International processing of personal data */}
                <div className="space-y-2">
                    <h2 className="text-lg font-bold text-foreground">International processing of personal data</h2>
                    <p>
                        Your personal information may be accessed, stored, transferred, and analyzed in the United Arab Emirates, including if you reside in another country. Data-protection laws in the UAE may differ from those in your country of residence.
                    </p>
                    <p>
                        Where applicable, including for participants in the EU or European Economic Area, you may have the right to:
                    </p>
                    <ul className="list-disc pl-6 space-y-2">
                        <li>Request access to or correction of your personal data.</li>
                        <li>Request deletion or restriction of processing.</li>
                        <li>Object to certain uses of your data.</li>
                        <li>Withdraw consent without affecting the lawfulness of processing completed before withdrawal.</li>
                        <li>Request a portable copy of certain data.</li>
                        <li>Submit a complaint to the relevant data-protection authority.</li>
                    </ul>
                    <p className="pt-1">
                        These rights may be limited where research exemptions or other legal requirements apply.
                    </p>
                </div>

                {/* Contact information */}
                <div className="space-y-2">
                    <h2 className="text-lg font-bold text-foreground">Contact information</h2>
                    <p>
                        For questions about the study, your data, or a request to withdraw your responses, contact:
                    </p>
                    <div className="border-primary/40 space-y-0.5 font-medium text-foreground">
                        <p>Bedoor AlShebli</p>
                        <p>
                            <a href="mailto:bedoor@nyu.edu" className="underline underline-offset-4 text-primary">bedoor@nyu.edu</a>
                        </p>
                    </div>
                    <p className="pt-2">
                        For questions about your rights as a research participant, contact the New York University Abu Dhabi Institutional Review Board and refer to protocol <span className="font-medium">#HRPP-2026-78</span>:
                    </p>
                    <ul className="list-disc pl-6 space-y-1.5">
                        <li>Telephone: +971 2 628 4313</li>
                        <li>
                            Email: <a href="mailto:IRBnyuad@nyu.edu" className="underline underline-offset-4 text-primary">IRBnyuad@nyu.edu</a>
                        </li>
                    </ul>
                    <p className="text-sm pt-1 font-medium text-foreground">
                        You may take a screenshot of this page to retain a copy.
                    </p>
                </div>

                {/* Confirmation Footer */}
                <div className="pt-4 border-t border-border/60 space-y-2">
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                        By clicking the button below, you confirm that you have read this information and agree to participate. Only click the button if you intend to participate. You may participate in this study only once.
                    </p>
                </div>
            </FadeIn>

            <FadeIn delay={120} className="mt-6 flex justify-end">
                <Button asChild size="lg" className="min-w-[10rem]">
                    <Link href={beginHref}>Begin</Link>
                </Button>
            </FadeIn>
        </SurveyPageEnter>
    )
}

export default function Home() {
    return (
        <Suspense fallback={
            <div className="max-w-3xl mx-auto p-6">
                <p className="text-muted-foreground">Loading…</p>
            </div>
        }>
            <HomeContent />
        </Suspense>
    )
}
