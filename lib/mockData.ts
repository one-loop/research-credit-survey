import { CreditRole, Author } from "./types"

export const creditRoles: CreditRole[] = [
    {
        id: "conceptualization",
        name: "Conceptualization",
        description:
            "Ideas; formulation or evolution of overarching research goals and aims",
    },
    {
        id: "methodology",
        name: "Methodology",
        description:
            "Development or design of methodology; creation of models",
    },
    {
        id: "software",
        name: "Software",
        description:
            "Programming, software development; designing computer programs; implementation of computer code and supporting algorithms",
    },
    {
        id: "validation",
        name: "Validation",
        description:
            "Verification of the overall replication/reproducibility of results/experiments and other research outputs",
    },
    {
        id: "formal-analysis",
        name: "Formal Analysis",
        description:
            "Application of statistical, mathematical, computational, or other formal techniques to analyze or synthesize study data",
    },
    {
        id: "investigation",
        name: "Investigation",
        description:
            "Conducting a research and investigation process, specifically performing the experiments, or data/evidence collection",
    },
    {
        id: "resources",
        name: "Resources",
        description:
            "Provision of study materials, reagents, materials, patients, laboratory samples, animals, instrumentation, computing resources, or other analysis tools",
    },
    {
        id: "data-curation",
        name: "Data Curation",
        description:
            "Management activities to annotate, scrub data and maintain research data for initial use and later re-use",
    },
    {
        id: "writing-original-draft",
        name: "Writing – Original Draft",
        description:
            "Preparation, creation and/or presentation of the published work, specifically writing the initial draft (including substantive translation)",
    },
    {
        id: "writing-review-editing",
        name: "Writing – Review & Editing",
        description:
            "Preparation, creation and/or presentation of the published work by those from the original research group, specifically critical review, commentary or revision",
    },
    {
        id: "visualization",
        name: "Visualization",
        description:
            "Preparation, creation and/or presentation of the published work, specifically visualization and data presentation",
    },
    {
        id: "supervision",
        name: "Supervision",
        description:
            "Oversight and leadership responsibility for the research activity planning and execution, including mentorship external to the core team",
    },
    {
        id: "project-administration",
        name: "Project Administration",
        description:
            "Management and coordination responsibility for the research activity planning and execution",
    },
    {
        id: "funding-acquisition",
        name: "Funding Acquisition",
        description:
            "Acquisition of the financial support for the project leading to this publication",
    },
]

export const experimentAAuthors: Author[] = [
    {
        id: "ax",
        initials: "A.X.",
        contributions: ["Conceptualization", "Methodology", "Formal Analysis"]
    },
    {
        id: "by",
        initials: "B.Y.",
        contributions: ["Methdology", "Formal Analysis"]
    },
    {
        id: "cz",
        initials: "C.Z.",
        contributions: ["Investigation", "Formal Analysis"]
    }
]