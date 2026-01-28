import { CreditRole, Author } from "./types"

export const creditRoles: CreditRole[] = [
    {
        id: "conceptualization",
        name: "Conceptualization",
        description: "Ideas; fomulation or evolution of overarching research goals"
    },
    {
        id: "methdology",
        name: "Methdology",
        description: "Development or design of methodology"
    },
    {
        id: "formal-analysis",
        name: "Formal Analysis",
        description: "Statistical, mathematical, computational analysis"
    },
    // add all 14 later
]

export const experimentAuthors: Author[] = [
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