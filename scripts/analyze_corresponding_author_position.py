#!/usr/bin/env python3
"""
Analyze corresponding-author position in PLOS One Data.jsonl.

Outputs:
  - One figure per domain (4 total): grouped bar charts by *field* within that domain,
    showing % first / middle / last among papers that have a corresponding author.
  - One figure per domain (4 total): single bar chart for that domain overall.

Requires: pip install matplotlib

Usage:
  python scripts/analyze_corresponding_author_position.py
  python scripts/analyze_corresponding_author_position.py --jsonl path/to/PLOS\ One\ Data.jsonl --out-dir outputs/corresponding_author
"""

from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")  # headless / no GUI; avoids crashes in CI and some sandboxes
import matplotlib.pyplot as plt
import matplotlib.ticker as mtick

DOMAINS = (
    "Social Sciences",
    "Health Sciences",
    "Physical Sciences",
    "Life Sciences",
)


def corresponding_author_index(authors: list[dict]) -> int | None:
    """First index in byline order where corresponding is true; None if none."""
    for i, a in enumerate(authors):
        if a.get("corresponding") is True:
            return i
    return None


def position_bucket(index: int, n_authors: int) -> str:
    if n_authors <= 1:
        return "first"  # single author: treat as first (and only) position
    if index == 0:
        return "first"
    if index == n_authors - 1:
        return "last"
    return "middle"


def load_counts_by_domain_field(
    jsonl_path: Path,
) -> tuple[
    dict[str, dict[str, dict[str, int]]],
    dict[str, dict[str, int]],
]:
    """
    Returns:
      counts[domain][field][bucket]  (only papers with >=1 corresponding)
      counts_domain[domain][bucket]
    """
    counts: dict[str, dict[str, dict[str, int]]] = defaultdict(
        lambda: defaultdict(lambda: {"first": 0, "middle": 0, "last": 0})
    )
    counts_domain: dict[str, dict[str, int]] = defaultdict(
        lambda: {"first": 0, "middle": 0, "last": 0}
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
            n = len(authors)
            if n == 0:
                continue
            idx = corresponding_author_index(authors)
            if idx is None:
                continue
            bucket = position_bucket(idx, n)
            counts[domain][field][bucket] += 1
            counts_domain[domain][bucket] += 1

    return counts, counts_domain


def percents(bucket_counts: dict[str, int]) -> tuple[float, float, float]:
    total = sum(bucket_counts.values())
    if total == 0:
        return 0.0, 0.0, 0.0
    return (
        100.0 * bucket_counts["first"] / total,
        100.0 * bucket_counts["middle"] / total,
        100.0 * bucket_counts["last"] / total,
    )


def plot_domain_field_bars(
    domain: str,
    field_counts: dict[str, dict[str, int]],
    out_path: Path,
) -> None:
    fields = sorted(field_counts.keys(), key=lambda f: f.lower())
    if not fields:
        return

    first_p, middle_p, last_p = [], [], []
    for f in fields:
        fp, mp, lp = percents(field_counts[f])
        first_p.append(fp)
        middle_p.append(mp)
        last_p.append(lp)

    x = range(len(fields))
    width = 0.25
    fig, ax = plt.subplots(figsize=(max(14, len(fields) * 0.45), 7))
    bars_first = ax.bar([i - width for i in x], first_p, width, label="First", color="#2563eb")
    bars_middle = ax.bar(x, middle_p, width, label="Middle", color="#ca8a04")
    bars_last = ax.bar([i + width for i in x], last_p, width, label="Last", color="#16a34a")

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

    label_grouped_bars(bars_first, first_p)
    label_grouped_bars(bars_middle, middle_p)
    label_grouped_bars(bars_last, last_p)

    ax.set_ylabel("Percentage of papers (%)")
    ax.set_title(
        f"Corresponding author position by field\nDomain: {domain}\n"
        f"(Among papers with a corresponding author flag; first = index 0, last = final byline)"
    )
    ax.set_xticks(list(x))
    ax.set_xticklabels(fields, rotation=55, ha="right", fontsize=8)
    ax.yaxis.set_major_formatter(mtick.PercentFormatter(xmax=100))
    # Extra headroom so percentage labels above tall bars are not clipped
    ax.set_ylim(0, 108)
    ax.legend(loc="upper right")
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def plot_domain_overall(domain: str, bucket_counts: dict[str, int], out_path: Path) -> None:
    fp, mp, lp = percents(bucket_counts)
    labels = ["First", "Middle", "Last"]
    values = [fp, mp, lp]
    colors = ["#2563eb", "#ca8a04", "#16a34a"]

    fig, ax = plt.subplots(figsize=(6, 5))
    bars = ax.bar(labels, values, color=colors, edgecolor="black", linewidth=0.5)
    ax.set_ylabel("Percentage of papers (%)")
    ax.set_title(
        f"Corresponding author position\nDomain: {domain}\n"
        f"(Among papers with a corresponding author flag)"
    )
    ax.set_ylim(0, 100)
    ax.yaxis.set_major_formatter(mtick.PercentFormatter(xmax=100))
    for b, v in zip(bars, values):
        ax.text(b.get_x() + b.get_width() / 2, b.get_height() + 1.5, f"{v:.1f}%", ha="center", va="bottom", fontsize=11)
    ax.grid(axis="y", alpha=0.3)
    fig.tight_layout()
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description="Corresponding author position plots from PLOS JSONL.")
    parser.add_argument(
        "--jsonl",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "PLOS One Data.jsonl",
        help="Path to PLOS One Data.jsonl",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path(__file__).resolve().parent.parent / "outputs" / "corresponding_author",
        help="Directory to write PNG files",
    )
    args = parser.parse_args()

    if not args.jsonl.is_file():
        raise SystemExit(f"JSONL not found: {args.jsonl}")

    args.out_dir.mkdir(parents=True, exist_ok=True)

    counts_by_df, counts_domain = load_counts_by_domain_field(args.jsonl)

    safe = lambda s: s.lower().replace(" ", "_")

    for domain in DOMAINS:
        field_map = counts_by_df.get(domain, {})
        out_field = args.out_dir / f"corresponding_position_by_field_{safe(domain)}.png"
        plot_domain_field_bars(domain, field_map, out_field)
        print("Wrote", out_field)

        out_dom = args.out_dir / f"corresponding_position_domain_{safe(domain)}.png"
        plot_domain_overall(domain, counts_domain[domain], out_dom)
        print("Wrote", out_dom)

    n_fields = sum(len(counts_by_df[d]) for d in DOMAINS)
    print(f"Total distinct (domain, field) pairs with data: {n_fields}")


if __name__ == "__main__":
    main()
