#!/usr/bin/env python3
"""
Analyze alphabetical_runs / alphabetical ordering in PLOS One Data.jsonl.

Classifies each paper (with >=1 author and a known field in the four domains):
  - none:   no alphabetical_runs, or no valid run ranges
  - partial: at least one valid run, but the byline is not fully covered by merged runs as [0 .. n-1]
  - full:   merged runs form a single segment covering the entire author list (fully alphabetical byline)

By default this uses the **full** author list. Optional `--strip-corresponding-anchors`:
  If the only corresponding author(s) sit at **index 0 only**, **index n-1 only**, or **both
  ends (0 and n-1)** with no other corresponding flags, those positions are removed and
  `alphabetical_runs` are remapped onto the remaining authors before classifying. This
  approximates “alphabetical cohort aside from a first/last corresponding anchor.”
  Papers with other correspondence patterns are classified **without** stripping.

Outputs (8 PNGs by default):
  - One figure per domain: grouped bars by *field* (none / partial / full %).
  - One figure per domain: overall domain bar chart (same three categories).

Requires: pip install matplotlib

Usage:
  python3 scripts/analyze_alphabetical_runs.py
  python3 scripts/analyze_alphabetical_runs.py --jsonl "PLOS One Data.jsonl" --out-dir outputs/alphabetical_runs
  python3 scripts/analyze_alphabetical_runs.py --strip-corresponding-anchors --out-dir outputs/alphabetical_runs_stripped
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.ticker as mtick

DOMAINS = (
    "Social Sciences",
    "Health Sciences",
    "Physical Sciences",
    "Life Sciences",
)


def merge_run_ranges(ranges: list[tuple[int, int]]) -> list[list[int]]:
    if not ranges:
        return []
    rs = sorted(ranges)
    merged = [list(rs[0])]
    for a, b in rs[1:]:
        if a <= merged[-1][1] + 1:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    return merged


def _parse_valid_runs(runs: object, n: int) -> list[tuple[int, int]]:
    if not runs or not isinstance(runs, list) or n <= 0:
        return []
    valid: list[tuple[int, int]] = []
    for r in runs:
        if isinstance(r, list) and len(r) == 2:
            try:
                a, b = int(r[0]), int(r[1])
            except (TypeError, ValueError):
                continue
            if 0 <= a <= b <= n - 1:
                valid.append((a, b))
    return valid


def _remap_runs_strip_first(valid: list[tuple[int, int]], n: int) -> tuple[list[tuple[int, int]], int]:
    """Drop original index 0; new indices 0..n-2 refer to old 1..n-1."""
    n_new = n - 1
    out: list[tuple[int, int]] = []
    for a, b in valid:
        na, nb = max(a, 1), min(b, n - 1)
        if na <= nb:
            out.append((na - 1, nb - 1))
    return out, n_new


def _remap_runs_strip_last(valid: list[tuple[int, int]], n: int) -> tuple[list[tuple[int, int]], int]:
    """Drop original index n-1; indices 0..n-2 unchanged."""
    n_new = n - 1
    out: list[tuple[int, int]] = []
    for a, b in valid:
        na, nb = max(a, 0), min(b, n - 2)
        if na <= nb:
            out.append((na, nb))
    return out, n_new


def _remap_runs_strip_both_ends(valid: list[tuple[int, int]], n: int) -> tuple[list[tuple[int, int]], int]:
    """Drop original indices 0 and n-1; new length n-2 maps old middle 1..n-2 to 0..n-3."""
    n_new = n - 2
    out: list[tuple[int, int]] = []
    for a, b in valid:
        na, nb = max(a, 1), min(b, n - 2)
        if na <= nb:
            out.append((na - 1, nb - 1))
    return out, n_new


def _maybe_strip_corresponding_anchors(
    authors: list,
    valid: list[tuple[int, int]],
    n: int,
    strip: bool,
) -> tuple[list[tuple[int, int]], int]:
    """If strip and anchor pattern matches, return remapped runs and new n; else original."""
    if not strip or n < 2:
        return valid, n
    corr = [i for i, a in enumerate(authors) if a.get("corresponding") is True]
    if not corr:
        return valid, n
    positions = set(corr)
    if positions == {0}:
        return _remap_runs_strip_first(valid, n)
    if positions == {n - 1}:
        return _remap_runs_strip_last(valid, n)
    if positions == {0, n - 1} and n >= 3:
        return _remap_runs_strip_both_ends(valid, n)
    return valid, n


def classify_alphabetical(
    authors: list,
    runs: object,
    *,
    strip_corresponding_anchors: bool = False,
) -> str | None:
    """Return 'none' | 'partial' | 'full', or None if paper should be skipped (no authors)."""
    n_orig = len(authors)
    if n_orig == 0:
        return None

    if not runs or not isinstance(runs, list):
        return "none"

    valid = _parse_valid_runs(runs, n_orig)
    if not valid:
        return "none"

    valid, n = _maybe_strip_corresponding_anchors(authors, valid, n_orig, strip_corresponding_anchors)
    if n <= 0:
        return "none"

    # Drop any run that falls outside reduced index range (defensive)
    valid = [(a, b) for a, b in valid if 0 <= a <= b <= n - 1]
    if not valid:
        return "none"

    merged = merge_run_ranges(valid)
    if len(merged) == 1 and merged[0][0] == 0 and merged[0][1] == n - 1:
        return "full"
    return "partial"


def load_counts_by_domain_field(
    jsonl_path: Path,
    *,
    strip_corresponding_anchors: bool,
) -> tuple[
    dict[str, dict[str, dict[str, int]]],
    dict[str, dict[str, int]],
]:
    counts: dict[str, dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: {"none": 0, "partial": 0, "full": 0})
    )
    counts_domain: dict[str, dict[str, int]] = defaultdict(
        lambda: {"none": 0, "partial": 0, "full": 0}
    )

    with jsonl_path.open("r", encoding="utf-8") as f:
        for line in f:
            if not line.strip():
                continue
            paper = json.loads(line)
            domain = paper.get("domain")
            if domain not in DOMAINS:
                continue
            field = paper.get("field")
            if not field or not isinstance(field, str):
                continue
            authors = paper.get("authors") or []
            bucket = classify_alphabetical(
                authors,
                paper.get("alphabetical_runs"),
                strip_corresponding_anchors=strip_corresponding_anchors,
            )
            if bucket is None:
                continue
            counts[domain][field][bucket] += 1
            counts_domain[domain][bucket] += 1

    return counts, counts_domain


def percents(bucket_counts: dict[str, int]) -> tuple[float, float, float]:
    total = sum(bucket_counts.values())
    if total == 0:
        return 0.0, 0.0, 0.0
    return (
        100.0 * bucket_counts["none"] / total,
        100.0 * bucket_counts["partial"] / total,
        100.0 * bucket_counts["full"] / total,
    )


def plot_domain_field_bars(
    domain: str,
    field_counts: dict[str, dict[str, int]],
    out_path: Path,
    *,
    strip_corresponding_anchors: bool,
) -> None:
    fields = sorted(field_counts.keys(), key=lambda f: f.lower())
    if not fields:
        return

    none_p, partial_p, full_p = [], [], []
    for f in fields:
        np_, pp, fp = percents(field_counts[f])
        none_p.append(np_)
        partial_p.append(pp)
        full_p.append(fp)

    x = range(len(fields))
    width = 0.25
    fig, ax = plt.subplots(figsize=(max(14, len(fields) * 0.45), 7))
    bars_none = ax.bar([i - width for i in x], none_p, width, label="No α runs", color="#64748b")
    bars_partial = ax.bar(x, partial_p, width, label="Partial α", color="#ca8a04")
    bars_full = ax.bar([i + width for i in x], full_p, width, label="Full byline α", color="#16a34a")

    label_fs = 5 if len(fields) > 14 else 6
    y_pad = 1.0 if len(fields) > 14 else 1.2

    def label_grouped_bars(container, values: list[float]) -> None:
        for rect, v in zip(container, values):
            y = rect.get_height()
            ax.text(
                rect.get_x() + rect.get_width() / 2,
                y + y_pad,
                f"{v:.1f}%",
                ha="center",
                va="bottom",
                fontsize=label_fs,
            )

    label_grouped_bars(bars_none, none_p)
    label_grouped_bars(bars_partial, partial_p)
    label_grouped_bars(bars_full, full_p)

    ax.set_ylabel("Percentage of papers (%)")
    strip_note = (
        "\n(Corresponding-only anchors at first and/or last position removed when applicable)"
        if strip_corresponding_anchors
        else ""
    )
    ax.set_title(
        f"Alphabetical ordering (alphabetical_runs)\nDomain: {domain}\n"
        "No runs = empty or invalid; Partial = runs present but not full byline; "
        "Full = merged runs cover indices 0 … last author"
        f"{strip_note}"
    )
    ax.set_xticks(list(x))
    ax.set_xticklabels(fields, rotation=55, ha="right", fontsize=8)
    ax.yaxis.set_major_formatter(mtick.PercentFormatter(xmax=100))
    ax.set_ylim(0, 108)
    ax.legend(loc="upper right")
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def plot_domain_overall(
    domain: str,
    bucket_counts: dict[str, int],
    out_path: Path,
    *,
    strip_corresponding_anchors: bool,
) -> None:
    np_, pp, fp = percents(bucket_counts)
    labels = ["No α runs", "Partial α", "Full byline α"]
    values = [np_, pp, fp]
    colors = ["#64748b", "#ca8a04", "#16a34a"]

    fig, ax = plt.subplots(figsize=(6.5, 5))
    bars = ax.bar(labels, values, color=colors, edgecolor="black", linewidth=0.5)
    ax.set_ylabel("Percentage of papers (%)")
    strip_note = (
        "\n(Corresponding-only anchors at first/last removed when applicable)"
        if strip_corresponding_anchors
        else ""
    )
    ax.set_title(
        f"Alphabetical ordering (alphabetical_runs)\nDomain: {domain}\n"
        "(All papers in domain with ≥1 author and a field label)"
        f"{strip_note}"
    )
    ax.set_ylim(0, 108)
    ax.yaxis.set_major_formatter(mtick.PercentFormatter(xmax=100))
    for b, v in zip(bars, values):
        ax.text(
            b.get_x() + b.get_width() / 2,
            b.get_height() + 1.5,
            f"{v:.1f}%",
            ha="center",
            va="bottom",
            fontsize=11,
        )
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description="Alphabetical runs plots from PLOS JSONL.")
    parser.add_argument(
        "--jsonl",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "PLOS One Data.jsonl",
        help="Path to PLOS One Data.jsonl",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "outputs" / "alphabetical_runs",
        help="Directory to write PNG files",
    )
    parser.add_argument(
        "--strip-corresponding-anchors",
        action="store_true",
        help=(
            "When the only corresponding author(s) are at index 0, at index n-1, or exactly "
            "at both ends, drop those position(s) and remap runs before classifying full vs partial."
        ),
    )
    args = parser.parse_args()

    if not args.jsonl.is_file():
        raise SystemExit(f"JSONL not found: {args.jsonl}")

    args.out_dir.mkdir(parents=True, exist_ok=True)

    counts_by_df, counts_domain = load_counts_by_domain_field(
        args.jsonl,
        strip_corresponding_anchors=args.strip_corresponding_anchors,
    )

    safe = lambda s: s.lower().replace(" ", "_")
    suffix = "_corr_stripped" if args.strip_corresponding_anchors else ""

    for domain in DOMAINS:
        field_map = counts_by_df.get(domain, {})
        out_field = args.out_dir / f"alphabetical_order_by_field_{safe(domain)}{suffix}.png"
        plot_domain_field_bars(
            domain,
            field_map,
            out_field,
            strip_corresponding_anchors=args.strip_corresponding_anchors,
        )
        print("Wrote", out_field)

        out_dom = args.out_dir / f"alphabetical_order_domain_{safe(domain)}{suffix}.png"
        plot_domain_overall(
            domain,
            counts_domain[domain],
            out_dom,
            strip_corresponding_anchors=args.strip_corresponding_anchors,
        )
        print("Wrote", out_dom)

    n_fields = sum(len(counts_by_df[d]) for d in DOMAINS)
    print(f"Total distinct (domain, field) pairs with data: {n_fields}")


if __name__ == "__main__":
    main()
