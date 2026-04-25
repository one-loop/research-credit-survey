import json
import os
import time

from dotenv import load_dotenv
from postgrest.exceptions import APIError
from supabase import create_client

load_dotenv(".env.local")

BATCH_SIZE = 500
MAX_RETRIES = 5
RETRY_BASE_SECONDS = 1.5
START_FROM_BATCH = 365
END_AT_BATCH = 369


def upsert_batch_with_retry(supabase, batch: list[dict], batch_no: int) -> bool:
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"Inserting batch no {batch_no} (size={len(batch)}), attempt {attempt}/{MAX_RETRIES}")
            supabase.table("papers").upsert(batch).execute()
            return True
        except APIError as err:
            error_msg = str(err)
            is_timeout = "statement timeout" in error_msg.lower() or "57014" in error_msg
            if not is_timeout:
                print(f"Batch {batch_no} failed with non-timeout error: {error_msg}")
                return False
            if attempt == MAX_RETRIES:
                print(f"Batch {batch_no} timed out after {MAX_RETRIES} attempts. Skipping batch.")
                return False
            sleep_seconds = RETRY_BASE_SECONDS * (2 ** (attempt - 1))
            print(f"Batch {batch_no} timed out. Retrying in {sleep_seconds:.1f}s...")
            time.sleep(sleep_seconds)
    return False


def main() -> None:
    supabase = create_client(
        os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
    )
    batch: list[dict] = []
    batch_no = 1
    skipped_batches = 0
    out_of_range_batches = 0
    failed_batches: list[int] = []
    processed_batches = 0

    with open("PLOS One Data (1).jsonl") as f:
        for line in f:
            paper = json.loads(line)  # get the json object for the line

            batch.append({
                "work_id": paper["work_id"],
                "publication_date": paper["publication_date"],
                "journal": paper["journal"],
                "topic": paper["topic"],
                "subfield": paper["subfield"],
                "field": paper["field"],
                "domain": paper["domain"],
                "corresponding_email": paper["corresponding_email"],
                "authors": paper["authors"],
                "experiment_eligibility": paper["experiment_eligibility"],
            })

            # insert into supabase database in smaller batches to reduce timeout risk
            if len(batch) == BATCH_SIZE:
                if batch_no < START_FROM_BATCH:
                    print(f"Skipping batch no {batch_no} (resume starts at {START_FROM_BATCH})")
                    skipped_batches += 1
                elif batch_no > END_AT_BATCH:
                    out_of_range_batches += 1
                else:
                    ok = upsert_batch_with_retry(supabase, batch, batch_no)
                    processed_batches += 1
                    if not ok:
                        failed_batches.append(batch_no)
                batch = []  # reset batch
                batch_no += 1
                if batch_no > END_AT_BATCH:
                    break

    # insert remaining rows
    if batch:
        if batch_no < START_FROM_BATCH:
            print(f"Skipping batch no {batch_no} (resume starts at {START_FROM_BATCH})")
            skipped_batches += 1
        elif batch_no > END_AT_BATCH:
            out_of_range_batches += 1
        else:
            ok = upsert_batch_with_retry(supabase, batch, batch_no)
            processed_batches += 1
            if not ok:
                failed_batches.append(batch_no)

    print("done inserting papers")
    print(f"Target batch range: {START_FROM_BATCH} to {END_AT_BATCH}")
    print(f"Processed batches in range: {processed_batches}")
    print(f"Skipped batches: {skipped_batches}")
    print(f"Ignored batches after range end: {out_of_range_batches}")
    if failed_batches:
        print(f"Failed and skipped batches after retries: {failed_batches}")


if __name__ == "__main__":
    main()