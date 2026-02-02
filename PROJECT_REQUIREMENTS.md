# ⚠️ REQUIRED READING FOR ALL CODE CHANGES

This document is the authoritative specification for this project.

All code must:
- Follow the constraints defined here
- Not introduce assumptions not stated here
- Ask for clarification before deviating

If there is a conflict between code and this document, this document wins.

# **Project Requirements Document (PRD)**

## Survey Platform for Perceived Author Contribution

---

## 1. Project Overview

This project is a **web-based survey platform** designed to study how respondents perceive author contribution and authorship ordering in scholarly publications.

Respondents will:

* Learn about **CRediT contributor roles**
* Rate the **importance** of each role
* Participate in **one experimental condition** (A, B, or C)
* Rank authors for **5 scholarly articles**
* Complete a **demographic survey**

The system must ensure:

* Author identities are anonymized where required
* Randomized but controlled assignment of experiments
* Each article is evaluated by **at least 3 unique respondents**
* Respondents only see articles relevant to their field

---

## 2. Core Concepts

### 2.1 Experiments

Each respondent is randomly assigned **exactly one** experiment:

* **Experiment A**: Contributions only (fully anonymized)
* **Experiment B**: Contributions + implicit demographic cues (names + country)
* **Experiment C**: Contributions + academic prestige information

Each experiment contains **5 distinct Works**.

---

## 3. Survey Flow (Strict Order)

1. **Start Page**
2. **CRediT Roles Description Page**
3. **Perception of CRediT Roles**

   * Importance ratings
   * Effort vs Expertise ratings
4. **Experiment Page**

   * Experiment A *or* B *or* C
   * 5 Works shown sequentially
5. **Respondent Demographic Survey**
6. **Completion / Thank You Page**

---

## 4. Data Models

### 4.1 Work Object

Each Work represents a scholarly publication.

```json
{
  "work_id": "string",
  "doi": "string",
  "journal": "string",
  "display_name": "string",
  "publication_date": "YYYY-MM-DD",
  "corresponding_email": "string",
  "authors": [Author]
}
```

**Constraints:**

* Each Work MUST have **at least 2 authors**
* Works are preloaded (static or seeded)

---

### 4.2 Author Object

```json
{
  "author_id": "string",
  "initials": "string",
  "academic_age": number,
  "h_index": number,
  "affiliation": "string",
  "race": "Asian | Black | White | Hispanic",
  "gender": "Male | Female"
}
```

**Constraints:**

* `academic_age >= 0`
* `h_index >= 0`

---

### 4.3 Respondent Object

```json
{
  "respondent_id": "string",
  "assigned_experiment": "A | B | C",
  "field": "string",
  "demographics": {
    "gender": "string",
    "race": "string",
    "years_experience": number,
    "affiliation": "string"
  }
}
```

---

## 5. Pages and Functional Requirements

---

## 5.1 CRediT Roles Description Page

### Purpose

Educate respondents on the 14 CRediT roles.

### Requirements

* Static page
* Display all 14 roles with definitions
* No user input
* “Continue” button required

---

## 5.2 Perception of CRediT Roles Page

### Part 1: Importance Ratings

For each CRediT role:

* Slider input
* Range: **1–10**
* Integer values only

```json
{
  "role": "Conceptualization",
  "importance_score": 1-10
}
```

---

### Part 2: Effort vs Expertise Ratings

For each CRediT role:

* Slider from **0 → 100**
* Represents a continuum:

  * `0 = 100% Expertise`
  * `100 = 100% Effort`

```json
{
  "role": "Conceptualization",
  "effort_expertise_score": 0-100
}
```

---

## 6. Experimental Conditions

---

## 6.1 Experiment A — Contributions Only

### Display Rules

* Show **only** anonymized initials (e.g., A.X.)
* Show contributor roles per author
* No demographic or academic information

### Task

Respondent ranks authors **from first to last**.

```json
{
  "work_id": "string",
  "ranking": ["author_id_1", "author_id_2", "author_id_3"]
}
```

---

## 6.2 Experiment B — Demographic Signals

### Display Rules

* Show **full first name + last initial**
* Names drawn from a **fixed name list** associated with race/gender perception
* Show affiliation country
* Do NOT explicitly label race or gender

### Name Assignment Rules

* Names are randomly assigned
* Must match stored race + gender category
* Same author should not appear with different names within the same Work

---

## 6.3 Experiment C — Academic Prestige Signals

### Display Rules

* Show anonymized initials
* Show:

  * Institutional prestige (Top 100 / Non-Top 100)
  * Academic age
  * h-index

---

## 7. Randomization & Assignment Logic

### 7.1 Experiment Assignment

* Each respondent is randomly assigned **one** experiment (A, B, or C)
* Assignment should be approximately balanced across respondents

---

### 7.2 Work Assignment

* Each respondent sees **exactly 5 Works**
* All Works shown must match the respondent’s field
* Each Work must be evaluated by **at least 3 unique respondents**
* System must track Work exposure counts

---

### 7.3 Self-Article Rule

* One of the 5 Works shown MUST be the respondent’s own article
* That article must be anonymized the same as others
* Respondent should not be explicitly told which one it is

---

## 8. Respondent Demographic Survey

### Fields

```json
{
  "gender": "string",
  "race": "string",
  "years_experience": number,
  "current_affiliation": "string"
}
```

### Requirements

* Required before completion
* Used to validate pre-existing respondent data
* Stored separately from experiment responses

---

## 9. Data Storage Requirements

The system must store:

* Respondent metadata
* Experiment assignment
* CRediT role ratings
* Effort vs expertise ratings
* Author rankings per Work
* Demographic survey responses

All responses must be timestamped.

---

## 10. Non-Functional Requirements

* Deterministic rendering per respondent (no reshuffling on refresh)
* Mobile-compatible UI
* No personally identifiable information shown during experiments
* Data integrity guarantees (no partial submissions)

---

## 11. Out of Scope

* Statistical analysis
* Visualization dashboards
* Admin UI (unless explicitly added later)
