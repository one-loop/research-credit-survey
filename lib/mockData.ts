import { CreditRole, Author, Work } from "./types"

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

// 5 different trial sets for Experiment A
export const experimentATrials: Author[][] = [
    // Trial 1
    [
        {
            id: "ax",
            initials: "A.X.",
            contributions: ["Conceptualization", "Methodology", "Formal Analysis"]
        },
        {
            id: "by",
            initials: "B.Y.",
            contributions: ["Methodology", "Formal Analysis"]
        },
        {
            id: "cz",
            initials: "C.Z.",
            contributions: ["Investigation", "Formal Analysis"]
        }
    ],
    // Trial 2
    [
        {
            id: "dx",
            initials: "D.X.",
            contributions: ["Software", "Validation", "Data Curation"]
        },
        {
            id: "ey",
            initials: "E.Y.",
            contributions: ["Investigation", "Resources"]
        },
        {
            id: "fz",
            initials: "F.Z.",
            contributions: ["Writing – Original Draft", "Visualization"]
        }
    ],
    // Trial 3
    [
        {
            id: "gw",
            initials: "G.W.",
            contributions: ["Conceptualization", "Supervision", "Funding Acquisition"]
        },
        {
            id: "hv",
            initials: "H.V.",
            contributions: ["Methodology", "Project Administration"]
        },
        {
            id: "iu",
            initials: "I.U.",
            contributions: ["Writing – Review & Editing", "Visualization"]
        }
    ],
    // Trial 4
    [
        {
            id: "jt",
            initials: "J.T.",
            contributions: ["Investigation", "Formal Analysis", "Validation"]
        },
        {
            id: "ks",
            initials: "K.S.",
            contributions: ["Software", "Data Curation"]
        },
        {
            id: "lr",
            initials: "L.R.",
            contributions: ["Resources", "Project Administration"]
        }
    ],
    // Trial 5
    [
        {
            id: "mq",
            initials: "M.Q.",
            contributions: ["Conceptualization", "Writing – Original Draft"]
        },
        {
            id: "np",
            initials: "N.P.",
            contributions: ["Formal Analysis", "Visualization"]
        },
        {
            id: "oo",
            initials: "O.O.",
            contributions: ["Supervision", "Writing – Review & Editing"]
        }
    ]
]

// Pool of Works for Experiment A (queue: max 3 respondents per Work)
// Author IDs can be UUIDs (or numbers) for respondent links: /experiment-a?authorId=<uuid>
// The work containing that author is included as one of the 5 works.
export const worksPool: Work[] = [
    {
        work_id: "work_0",
        display_name: "A Mixed-Methods Study of Collaboration in Open Science",
        authors: [  
            { id: "ax", initials: "A.X.", contributions: ["Conceptualization", "Methodology", "Formal Analysis"] },
            { id: "by", initials: "B.Y.", contributions: ["Methodology", "Formal Analysis"], is_corresponding: true },
            { id: "cz", initials: "C.Z.", contributions: ["Investigation", "Formal Analysis"] }
        ]
    },
    {
        work_id: "work_1",
        display_name: "Replication and Reproducibility in Computational Neuroscience",
        authors: [
            { id: "dx", initials: "D.X.", contributions: ["Software", "Validation", "Data Curation"] },
            { id: "ey", initials: "E.Y.", contributions: ["Investigation", "Resources"], is_corresponding: true },
            { id: "fz", initials: "F.Z.", contributions: ["Writing – Original Draft", "Visualization"] }
        ]
    },
    {
        work_id: "work_2",
        display_name: "Team Dynamics in Multi-Site Research Consortia",
        authors: [
            { id: "gw", initials: "G.W.", contributions: ["Conceptualization", "Supervision", "Funding Acquisition"], is_corresponding: true },
            { id: "hv", initials: "H.V.", contributions: ["Methodology", "Project Administration"] },
            { id: "iu", initials: "I.U.", contributions: ["Writing – Review & Editing", "Visualization"] }
        ]
    },
    {
        work_id: "work_3",
        display_name: "Meta-Analysis of Peer Review Outcomes",
        authors: [
            { id: "jt", initials: "J.T.", contributions: ["Investigation", "Formal Analysis", "Validation"], is_corresponding: true  },
            { id: "ks", initials: "K.S.", contributions: ["Software", "Data Curation"] },
            { id: "lr", initials: "L.R.", contributions: ["Resources", "Project Administration"] }
        ]
    },
    {
        work_id: "work_4",
        display_name: "Citation Networks and Knowledge Diffusion",
        authors: [
            { id: "mq", initials: "M.Q.", contributions: ["Conceptualization", "Writing – Original Draft"], is_corresponding: true  },
            { id: "np", initials: "N.P.", contributions: ["Formal Analysis", "Visualization"] },
            { id: "oo", initials: "O.O.", contributions: ["Supervision", "Writing – Review & Editing"] }
        ]
    },
    {
        work_id: "work_5",
        display_name: "Survey Methods in Health Services Research",
        authors: [
            { id: "pp", initials: "P.P.", contributions: ["Conceptualization", "Investigation"] },
            { id: "qq", initials: "Q.Q.", contributions: ["Formal Analysis", "Writing – Original Draft"], is_corresponding: true  }
        ]
    },
    {
        work_id: "work_6",
        display_name: "Machine Learning for Literature Screening",
        authors: [
            { id: "rr", initials: "R.R.", contributions: ["Software", "Validation"] },
            { id: "ss", initials: "S.S.", contributions: ["Data Curation", "Visualization"] },
            { id: "tt", initials: "T.T.", contributions: ["Writing – Review & Editing"], is_corresponding: true  }
        ]
    },
    {
        work_id: "work_7",
        display_name: "Ethics and Consent in Longitudinal Studies",
        authors: [
            { id: "uu", initials: "U.U.", contributions: ["Conceptualization", "Project Administration"], is_corresponding: true  },
            { id: "vv", initials: "V.V.", contributions: ["Investigation", "Resources"] }
        ]
    },
    {
        work_id: "work_8",
        display_name: "Open Data Practices in Ecology",
        authors: [
            { id: "ww", initials: "W.W.", contributions: ["Data Curation", "Writing – Original Draft"], is_corresponding: true  },
            { id: "xx", initials: "X.X.", contributions: ["Formal Analysis", "Visualization"] }
        ]
    },
    {
        work_id: "work_9",
        display_name: "Preprint Servers and Publication Speed",
        authors: [
            { id: "yy", initials: "Y.Y.", contributions: ["Investigation", "Formal Analysis"] },
            { id: "zz", initials: "Z.Z.", contributions: ["Methodology", "Writing – Original Draft"], is_corresponding: true  }
        ]
    },
    {
        work_id: "work_10",
        display_name: "Interdisciplinary Collaboration in Climate Science",
        authors: [
            { id: "a1", initials: "A.A.", contributions: ["Conceptualization", "Supervision"] },
            { id: "b1", initials: "B.B.", contributions: ["Investigation", "Resources"] },
            { id: "c1", initials: "C.C.", contributions: ["Writing – Original Draft", "Visualization"], is_corresponding: true  }
        ]
    },
    {
        work_id: "work_11",
        display_name: "Quality Assurance in Systematic Reviews",
        authors: [
            { id: "d1", initials: "D.D.", contributions: ["Validation", "Data Curation"], is_corresponding: true  },
            { id: "e1", initials: "E.E.", contributions: ["Methodology", "Formal Analysis"] }
        ]
    },
    {
        work_id: "work_12",
        display_name: "Author Order Conventions in Mathematics",
        authors: [
            { id: "f1", initials: "F.F.", contributions: ["Conceptualization", "Formal Analysis"] },
            { id: "g1", initials: "G.G.", contributions: ["Writing – Original Draft"], is_corresponding: true  }
        ]
    },
    {
        work_id: "work_13",
        display_name: "Gender and Collaboration in STEM",
        authors: [
            { id: "h1", initials: "H.H.", contributions: ["Investigation", "Formal Analysis"], is_corresponding: true  },
            { id: "i1", initials: "I.I.", contributions: ["Visualization", "Writing – Review & Editing"] }
        ]
    },
    {
        work_id: "work_14",
        display_name: "Funding and Research Output in Biomedicine",
        authors: [
            { id: "j1", initials: "J.J.", contributions: ["Funding Acquisition", "Supervision"] },
            { id: "k1", initials: "K.K.", contributions: ["Investigation", "Writing – Original Draft"], is_corresponding: true  }
        ]
    },
    {
        work_id: "work_15",
        display_name: "Reproducibility of Statistical Analyses",
        authors: [
            { id: "l1", initials: "L.L.", contributions: ["Software", "Validation"] },
            { id: "m1", initials: "M.M.", contributions: ["Formal Analysis", "Data Curation"], is_corresponding: true  }
        ]
    },
    {
        work_id: "work_16",
        display_name: "Co-Authorship Networks in Social Science",
        authors: [
            { id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", initials: "N.N.", contributions: ["Conceptualization", "Formal Analysis"], is_corresponding: true  },
            { id: "o1", initials: "O.O.", contributions: ["Visualization", "Writing – Original Draft"] }
        ]
    },
    {
        work_id: "work_17",
        display_name: "Peer Review and Manuscript Revision",
        authors: [
            { id: "p1", initials: "P.P.", contributions: ["Writing – Review & Editing", "Validation"] },
            { id: "q1", initials: "Q.Q.", contributions: ["Investigation", "Resources"], is_corresponding: true  }
        ]
    }
]

