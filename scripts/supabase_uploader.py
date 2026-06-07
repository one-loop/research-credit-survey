"""
Upload or update papers in Supabase from JSONL dataset files.

Uses upsert on work_id: existing rows are updated, new rows are inserted.
Columns not in the payload (e.g. work_exposure, created_at) are left unchanged.
contributions_complete is set from each paper's authors on every upsert.

Requires .env.local with:
  NEXT_PUBLIC_SUPABASE_URL
  SUPABASE_SERVICE_ROLE_KEY

Examples:
  python scripts/supabase_uploader.py "PNAS (3).jsonl"
  python scripts/supabase_uploader.py "PLOS One.jsonl"
  python scripts/supabase_uploader.py "PNAS (3).jsonl" "PLOS One.jsonl"
  python scripts/supabase_uploader.py "PLOS One.jsonl" --start-batch 100 --end-batch 150
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

import httpx
from dotenv import load_dotenv
from postgrest.exceptions import APIError
from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
load_dotenv(ROOT / ".env.local")

BATCH_SIZE = 500
MAX_RETRIES = 5
RETRY_BASE_SECONDS = 1.5

PAPER_COLUMNS = (
    "work_id",
    "publication_date",
    "journal",
    "topic",
    "subfield",
    "field",
    "domain",
    "corresponding_email",
    "authors",
    "experiment_eligibility",
)


def has_complete_contributions(paper: dict) -> bool:
    authors = paper.get("authors")
    if not isinstance(authors, list) or not authors:
        return False
    for author in authors:
        if not isinstance(author, dict):
            return False
        contributions = author.get("contributions")
        if not isinstance(contributions, list) or len(contributions) == 0:
            return False
    return True


def paper_row(paper: dict) -> dict:
    row = {key: paper[key] for key in PAPER_COLUMNS}
    row["contributions_complete"] = has_complete_contributions(paper)
    return row


def is_transient_error(err: BaseException) -> bool:
    if isinstance(err, (httpx.RemoteProtocolError, httpx.ConnectError, httpx.ReadTimeout, httpx.WriteTimeout)):
        return True
    if isinstance(err, APIError):
        error_msg = str(err).lower()
        return (
            "statement timeout" in error_msg
            or "57014" in error_msg
            or "server disconnected" in error_msg
            or "connection" in error_msg
            or "timeout" in error_msg
            or "502" in error_msg
            or "503" in error_msg
            or "504" in error_msg
        )
    return False


def upsert_batch_with_retry(
    supabase,
    batch: list[dict],
    batch_no: int,
    source: str,
    *,
    max_retries: int = MAX_RETRIES,
    retry_base_seconds: float = RETRY_BASE_SECONDS,
) -> bool:
    for attempt in range(1, max_retries + 1):
        try:
            print(
                f"[{source}] batch {batch_no} (size={len(batch)}), "
                f"attempt {attempt}/{max_retries}"
            )
            supabase.table("papers").upsert(batch, on_conflict="work_id").execute()
            return True
        except Exception as err:
            if not is_transient_error(err):
                print(f"[{source}] batch {batch_no} failed: {err}")
                return False
            if attempt == max_retries:
                print(f"[{source}] batch {batch_no} failed after {max_retries} attempts: {err}")
                return False
            # Back off longer on disconnects — Supabase may be IO-throttled.
            sleep_seconds = retry_base_seconds * (2 ** (attempt - 1))
            if isinstance(err, httpx.RemoteProtocolError) or "disconnected" in str(err).lower():
                sleep_seconds = max(sleep_seconds, 30.0)
            print(f"[{source}] batch {batch_no} transient error. Retrying in {sleep_seconds:.1f}s...")
            print(f"  ({type(err).__name__}: {err})")
            time.sleep(sleep_seconds)
    return False


def upload_jsonl(
    supabase,
    jsonl_path: Path,
    *,
    start_batch: int = 1,
    end_batch: int | None = None,
    batch_size: int = BATCH_SIZE,
    pause_between_batches: float = 0.0,
    max_retries: int = MAX_RETRIES,
) -> dict[str, int | list[int]]:
    source = jsonl_path.name
    batch: list[dict] = []
    batch_no = 1
    skipped_batches = 0
    out_of_range_batches = 0
    failed_batches: list[int] = []
    processed_batches = 0
    rows_seen = 0

    with jsonl_path.open(encoding="utf-8") as handle:
        for line_no, line in enumerate(handle, start=1):
            line = line.strip()
            if not line:
                continue
            try:
                paper = json.loads(line)
            except json.JSONDecodeError as err:
                raise ValueError(f"{source}:{line_no}: invalid JSON: {err}") from err

            missing = [key for key in PAPER_COLUMNS if key not in paper]
            if missing:
                raise ValueError(f"{source}:{line_no}: missing fields: {', '.join(missing)}")

            batch.append(paper_row(paper))
            rows_seen += 1

            if len(batch) < batch_size:
                continue

            if batch_no < start_batch:
                skipped_batches += 1
            elif end_batch is not None and batch_no > end_batch:
                out_of_range_batches += 1
            else:
                ok = upsert_batch_with_retry(
                    supabase,
                    batch,
                    batch_no,
                    source,
                    max_retries=max_retries,
                )
                processed_batches += 1
                if not ok:
                    failed_batches.append(batch_no)
                    break
                if pause_between_batches > 0:
                    time.sleep(pause_between_batches)

            batch = []
            batch_no += 1
            if end_batch is not None and batch_no > end_batch:
                break

    if batch and (end_batch is None or batch_no <= end_batch):
        if batch_no < start_batch:
            skipped_batches += 1
        else:
            ok = upsert_batch_with_retry(
                supabase,
                batch,
                batch_no,
                source,
                max_retries=max_retries,
            )
            processed_batches += 1
            if not ok:
                failed_batches.append(batch_no)

    return {
        "rows_seen": rows_seen,
        "processed_batches": processed_batches,
        "skipped_batches": skipped_batches,
        "out_of_range_batches": out_of_range_batches,
        "failed_batches": failed_batches,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Upsert papers from JSONL into Supabase.")
    parser.add_argument(
        "files",
        nargs="+",
        help='JSONL file paths, e.g. "PNAS (3).jsonl" "PLOS One.jsonl"',
    )
    parser.add_argument(
        "--start-batch",
        type=int,
        default=1,
        help="Resume from this batch number (1-based). Default: 1",
    )
    parser.add_argument(
        "--end-batch",
        type=int,
        default=None,
        help="Stop after this batch number (inclusive). Default: upload entire file.",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=BATCH_SIZE,
        help=f"Rows per upsert batch. Default: {BATCH_SIZE}. Try 200 if disconnecting.",
    )
    parser.add_argument(
        "--pause-between-batches",
        type=float,
        default=0.0,
        help="Seconds to wait after each successful batch (e.g. 2). Helps when IO is throttled.",
    )
    parser.add_argument(
        "--max-retries",
        type=int,
        default=MAX_RETRIES,
        help=f"Retries per batch on timeout/disconnect. Default: {MAX_RETRIES}.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        print("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local")
        sys.exit(1)

    supabase = create_client(url, key)

    for file_arg in args.files:
        jsonl_path = Path(file_arg)
        if not jsonl_path.is_absolute():
            jsonl_path = ROOT / jsonl_path
        if not jsonl_path.exists():
            print(f"File not found: {jsonl_path}")
            sys.exit(1)

        print(f"\nUploading {jsonl_path.name} ...")
        stats = upload_jsonl(
            supabase,
            jsonl_path,
            start_batch=args.start_batch,
            end_batch=args.end_batch,
            batch_size=args.batch_size,
            pause_between_batches=args.pause_between_batches,
            max_retries=args.max_retries,
        )
        print(f"Finished {jsonl_path.name}")
        print(f"  rows read: {stats['rows_seen']}")
        print(f"  batches processed: {stats['processed_batches']}")
        print(f"  batches skipped (before start): {stats['skipped_batches']}")
        print(f"  batches ignored (after end): {stats['out_of_range_batches']}")
        if stats["failed_batches"]:
            failed = stats["failed_batches"][0]
            print(f"  failed batches: {stats['failed_batches']}")
            print(
                f"\nResume with:\n"
                f'  python scripts/supabase_uploader.py "{file_arg}" '
                f"--start-batch {failed} --batch-size {args.batch_size}"
            )
            if args.pause_between_batches > 0:
                print(f"    --pause-between-batches {args.pause_between_batches}")
            sys.exit(1)

    print("\nAll uploads complete.")


if __name__ == "__main__":
    main()
