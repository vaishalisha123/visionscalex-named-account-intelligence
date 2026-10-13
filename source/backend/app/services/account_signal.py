import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

from app.database import SessionLocal
from app.models.client import Client
from app.models.account import Account
from app.models.signal import Signal
from app.models.account_signal import AccountSignal

from threading import Lock
from typing import Any

load_dotenv(override=True)

# Client-specific in-memory progress for search query generation.
SEARCH_QUERY_PROGRESS: dict[int, dict[str, Any]] = {}
SEARCH_QUERY_PROGRESS_LOCK = Lock()


def update_search_query_progress(
    client_id: int,
    **updates: Any,
) -> None:
    with SEARCH_QUERY_PROGRESS_LOCK:
        current = SEARCH_QUERY_PROGRESS.setdefault(
            client_id,
            {},
        )
        current.update(updates)


def get_search_query_progress(client_id: int) -> dict[str, Any]:
    with SEARCH_QUERY_PROGRESS_LOCK:
        return dict(
            SEARCH_QUERY_PROGRESS.get(
                client_id,
                {
                    "status": "idle",
                    "completed": 0,
                    "total": 0,
                    "current_account": None,
                    "current_signal": None,
                    "error": None,
                },
            )
        )
SEARCH_QUERY_MODEL = "gpt-5.6-sol"

PROMPT_FILE = (
    Path(__file__).resolve().parent.parent
    / "prompts"
    / "account_signal_search_query.txt"
)


def build_search_query_prompt(
    company_name: str,
    website: str,
    linkedin_url: str,
    signal_family: str,
    objective: str,
    region_in_focus: str,
) -> str:

    prompt_template = PROMPT_FILE.read_text(
        encoding="utf-8"
    )

    replacements = {
        "{{clients_accounts_company_name}}": company_name or "Unknown",
        "{{clients_accounts_website}}": website or "Unknown",
        "{{clients_accounts_linkedin_url}}": linkedin_url or "Unknown",
        "{{clients_signal_family}}": signal_family or "Unknown",
        "{{clients_signal_objective}}": objective or "Unknown",
        "{{region_in_focus}}": region_in_focus,
    }

    for placeholder, value in replacements.items():
        prompt_template = prompt_template.replace(
            placeholder,
            str(value),
        )

    return prompt_template


def generate_search_query(prompt: str) -> str:

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise ValueError("OPENAI_API_KEY not found")

    client = OpenAI(api_key=api_key)

    response = client.responses.create(
        model=SEARCH_QUERY_MODEL,
        input=prompt,
    )

    query = response.output_text.strip()

    if not query:
        raise ValueError(
            "Search Query Generation returned empty output"
        )

    return query



def generate_account_signal_queries(
    client_id: int,
    region_in_focus: str,
) -> list:

    db = SessionLocal()

    try:
        # 1. GET CLIENT
        client = (
            db.query(Client)
            .filter(Client.id == client_id)
            .first()
        )

        if not client:
            raise ValueError(f"Client {client_id} not found")

        client_company_name = client.company_name

        # 2. GET ONLY THIS CLIENT'S ACCOUNTS
        accounts = (
            db.query(Account)
            .filter(Account.client_id == client_id)
            .all()
        )

        # 3. GET ONLY THIS CLIENT'S ENABLED SIGNALS
        signals = (
            db.query(Signal)
            .filter(
                Signal.client_id == client_id,
                Signal.enabled == 1,
            )
            .all()
        )

        print(
            "CLIENT:", client.id,
            "|", client_company_name,
            "| ACCOUNTS:", len(accounts),
            "| SIGNALS:", len(signals),
        )

        if not accounts:
            raise ValueError(
                f"No accounts found for Client {client_id}; "
                "existing queries were preserved."
            )

        if not signals:
            raise ValueError(
                f"No enabled signals found for Client {client_id}; "
                "existing queries were preserved."
            )

        account_ids = [account.id for account in accounts]
        total = len(accounts) * len(signals)
        pending_queries = []

        # Initialize actual progress
        update_search_query_progress(
            client_id,
            status="running",
            completed=0,
            total=total,
            current_account=None,
            current_signal=None,
            error=None,
        )

        # 4. GENERATE FRESH QUERIES
        for account in accounts:
            for signal in signals:

                if account.client_id != client_id:
                    raise ValueError(
                        f"Account {account.id} does not belong "
                        f"to Client {client_id}"
                    )

                if signal.client_id != client_id:
                    raise ValueError(
                        f"Signal {signal.id} does not belong "
                        f"to Client {client_id}"
                    )

                update_search_query_progress(
                    client_id,
                    current_account=account.account_name,
                    current_signal=signal.signal_family,
                )

                account_objective = (
                    signal.observable_event or "Unknown"
                ).replace(
                    client_company_name,
                    account.account_name,
                )

                prompt = build_search_query_prompt(
                    company_name=account.account_name,
                    website=account.website,
                    linkedin_url=account.linkedin_url,
                    signal_family=signal.signal_family,
                    objective=account_objective,
                    region_in_focus=region_in_focus
                )

                query = generate_search_query(prompt)

                pending_queries.append({
                    "account_id": account.id,
                    "signal_id": signal.id,
                    "search_query": query,
                    "query_status": "GENERATED",
                })

                update_search_query_progress(
                    client_id,
                    completed=len(pending_queries),
                )

        # 5. REPLACE ONLY THIS CLIENT'S QUERY RECORDS
        try:
            db.query(AccountSignal).filter(
                AccountSignal.account_id.in_(account_ids)
            ).delete(synchronize_session=False)

            new_records = []

            for item in pending_queries:
                record = AccountSignal(
                    account_id=item["account_id"],
                    signal_id=item["signal_id"],
                    search_query=item["search_query"],
                    query_status=item["query_status"],
                )
                db.add(record)
                new_records.append(record)

            db.flush()

            generated = [
                {
                    "id": record.id,
                    "account_id": record.account_id,
                    "signal_id": record.signal_id,
                    "search_query": record.search_query,
                    "query_status": record.query_status,
                }
                for record in new_records
            ]

            db.commit()

            update_search_query_progress(
                client_id,
                status="completed",
                completed=len(generated),
                total=total,
                current_account=None,
                current_signal=None,
                error=None,
            )

            return generated

        except Exception:
            db.rollback()
            raise

    except Exception as exc:
        update_search_query_progress(
            client_id,
            status="failed",
            error=str(exc),
            current_account=None,
            current_signal=None,
        )
        raise

    finally:
        db.close()