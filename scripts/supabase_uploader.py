import json
from supabase import create_client
from dotenv import load_dotenv
import os

load_dotenv(".env.local")


def main() -> None:
    supabase = create_client(
        os.getenv("NEXT_PUBLIC_SUPABASE_URL"),
        os.getenv("SUPABASE_SERVICE_ROLE_KEY"),
    )
    batch = []
    batch_no = 1

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

            # insert into suapbase database in batches of 500 papers
            if len(batch) == 1000:
                print(f"Inserting batch no {batch_no}")
                supabase.table("papers").upsert(batch).execute()
                batch = []  # reset batch
                batch_no += 1

    # insert remaining rows
    if batch:
        supabase.table("papers").upsert(batch).execute()

    print("done inserting papers")


if __name__ == "__main__":
    main()