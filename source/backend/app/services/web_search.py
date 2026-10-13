import os
import time
from datetime import datetime

import requests
from dotenv import load_dotenv

from app.database import SessionLocal
from app.models.account import Account
from app.models.account_signal import AccountSignal
from app.models.search_result import SearchResult


load_dotenv(override=True)


APIFY_API_URL = "https://api.apify.com/v2"
APIFY_ACTOR_ID = "563JCPLOqM1kMmbbP"


def build_tbs(
    start_date: str,
    end_date: str,
) -> str:
    """
    Convert YYYY-MM-DD dates into
    the Apify date filter format.
    """

    start = datetime.strptime(
        start_date,
        "%Y-%m-%d"
    )

    end = datetime.strptime(
        end_date,
        "%Y-%m-%d"
    )

    if start > end:
        raise ValueError(
            "start_date cannot be after end_date"
        )

    return (
        f"cdr:1,"
        f"cd_min:{start.strftime('%m/%d/%Y')},"
        f"cd_max:{end.strftime('%m/%d/%Y')}"
    )


def run_apify_search(
    search_query: str,
    start_date: str,
    end_date: str,
) -> list:
    """
    Run the VisionScaleX Apify web-search actor.
    """

    api_key = os.getenv("APIFY_API_KEY")

    if not api_key:
        raise ValueError(
            "APIFY_API_KEY not found"
        )

    tbs = build_tbs(
        start_date,
        end_date
    )

    payload = {
        "include_merged": False,
        "keyword": search_query,
        "tbs": tbs,
    }

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    # -----------------------------------------
    # START APIFY ACTOR
    # -----------------------------------------

    response = requests.post(
        f"{APIFY_API_URL}/acts/"
        f"{APIFY_ACTOR_ID}/runs",
        json=payload,
        headers=headers,
        timeout=60,
    )

    response.raise_for_status()

    run_data = response.json()

    run_id = run_data["data"]["id"]

    dataset_id = (
        run_data["data"]["defaultDatasetId"]
    )

    print(
        "APIFY RUN:",
        run_id
    )

    # -----------------------------------------
    # WAIT FOR APIFY RUN
    # -----------------------------------------

    while True:

        status_response = requests.get(
            f"{APIFY_API_URL}/actor-runs/"
            f"{run_id}",
            headers=headers,
            timeout=60,
        )

        status_response.raise_for_status()

        status_data = (
            status_response
            .json()["data"]
        )

        status = status_data["status"]

        print(
            "APIFY STATUS:",
            status
        )

        if status in {
            "SUCCEEDED",
            "FAILED",
            "ABORTED",
            "TIMED-OUT",
        }:
            break

        time.sleep(5)

    if status != "SUCCEEDED":

        raise RuntimeError(
            f"Apify run failed with status: "
            f"{status}"
        )

    # -----------------------------------------
    # READ APIFY DATASET
    # -----------------------------------------

    dataset_response = requests.get(
        f"{APIFY_API_URL}/datasets/"
        f"{dataset_id}/items",
        headers=headers,
        params={
            "clean": "true"
        },
        timeout=60,
    )

    dataset_response.raise_for_status()

    return dataset_response.json()


def search_one_account_signal(
    account_signal_id: int,
    start_date: str,
    end_date: str,
) -> list:
    """
    Run web search for ONE AccountSignal
    and save unique SearchResult rows.
    """

    db = SessionLocal()

    try:

        # -----------------------------------------
        # GET ACCOUNT SIGNAL
        # -----------------------------------------

        account_signal = (
            db.query(AccountSignal)
            .filter(
                AccountSignal.id
                == account_signal_id
            )
            .first()
        )

        if not account_signal:

            raise ValueError(
                f"AccountSignal "
                f"{account_signal_id} not found"
            )

        # -----------------------------------------
        # GET NAMED ACCOUNT
        # -----------------------------------------

        account = (
            db.query(Account)
            .filter(
                Account.id
                == account_signal.account_id
            )
            .first()
        )

        if not account:

            raise ValueError(
                f"Account "
                f"{account_signal.account_id} "
                f"not found"
            )

        print(
            "ACCOUNT:",
            account.account_name
        )

        print(
            "SEARCH QUERY:",
            account_signal.search_query
        )

        print(
            "DATE RANGE:",
            start_date,
            "→",
            end_date
        )

        # -----------------------------------------
        # RUN APIFY
        # -----------------------------------------

        results = run_apify_search(
            search_query=(
                account_signal.search_query
            ),
            start_date=start_date,
            end_date=end_date,
        )

        saved_results = []

        # -----------------------------------------
        # PROCESS DATASET ITEMS
        # -----------------------------------------

        for item in results:

            # Some Apify datasets return:
            #
            # {
            #     "results": [...]
            # }
            #
            # while some may return a
            # result object directly.

            if "results" in item:

                result_items = item["results"]

            else:

                result_items = [item]

            # -------------------------------------
            # PROCESS EACH SEARCH RESULT
            # -------------------------------------

            for result in result_items:

                result_url = result.get(
                    "url"
                )

                # ---------------------------------
                # IGNORE RESULTS WITHOUT URL
                # ---------------------------------

                if not result_url:

                    print(
                        "SKIP RESULT WITHOUT URL"
                    )

                    continue

                # ---------------------------------
                # DUPLICATE PROTECTION
                # ---------------------------------

                existing = (
                    db.query(SearchResult)
                    .filter(
                        SearchResult
                        .account_signal_id
                        == account_signal.id,

                        SearchResult.url
                        == result_url,
                    )
                    .first()
                )

                if existing:

                    print(
                        "SKIP DUPLICATE:",
                        result_url
                    )

                    continue

                # ---------------------------------
                # CREATE SEARCH RESULT
                # ---------------------------------

                search_result = SearchResult(
                    account_signal_id=(
                        account_signal.id
                    ),

                    title=result.get(
                        "title"
                    ),

                    url=result_url,

                    description=result.get(
                        "description"
                    ),

                    published_date=result.get(
                        "date"
                    ),
                )

                db.add(
                    search_result
                )

                saved_results.append(
                    search_result
                )

        # -----------------------------------------
        # SAVE
        # -----------------------------------------

        db.commit()

        print(
            "RESULTS SAVED:",
            len(saved_results)
        )

        return saved_results

    finally:

        db.close()


def search_all_account_signals(
    client_id: int,
    start_date: str,
    end_date: str,
) -> list:
    """
    Run web search for every AccountSignal
    belonging to the Client's Named Accounts.
    """

    db = SessionLocal()

    try:

        # -----------------------------------------
        # GET THIS CLIENT'S ACCOUNT SIGNALS ONLY
        # -----------------------------------------

        account_signals = (
            db.query(AccountSignal)
            .join(
                Account,
                Account.id
                == AccountSignal.account_id
            )
            .filter(
                Account.client_id
                == client_id
            )
            .order_by(
                AccountSignal.id
            )
            .all()
        )

        print(
            "CLIENT ID:",
            client_id
        )

        print(
            "ACCOUNT SIGNALS FOUND:",
            len(account_signals)
        )

        all_results = []

        # -----------------------------------------
        # PROCESS EACH ACCOUNT × SIGNAL
        # -----------------------------------------

        for index, account_signal in enumerate(
            account_signals,
            start=1
        ):

            print(
                "\n================================"
            )

            print(
                f"PROCESSING "
                f"{index}/"
                f"{len(account_signals)}"
            )

            print(
                "ACCOUNT SIGNAL ID:",
                account_signal.id
            )

            results = (
                search_one_account_signal(
                    account_signal_id=(
                        account_signal.id
                    ),
                    start_date=start_date,
                    end_date=end_date,
                )
            )

            all_results.extend(
                results
            )

        print(
            "\n================================"
        )

        print(
            "TOTAL NEW RESULTS:",
            len(all_results)
        )

        return all_results

    finally:

        db.close()