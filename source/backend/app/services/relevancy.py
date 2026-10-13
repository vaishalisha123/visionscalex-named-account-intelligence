import json
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(override=True)
from app.database import SessionLocal
from app.models.account import Account
from app.models.account_intelligence import AccountIntelligence
from app.models.account_signal import AccountSignal
from app.models.client import Client
from app.models.client_context import ClientContext
from app.models.relevancy_result import RelevancyResult
from app.models.search_result import SearchResult
from app.models.signal import Signal


MODEL = "gpt-5.6-sol"

PROMPT_PATH = (
    Path(__file__).resolve().parent.parent
    / "prompts"
    / "single_relevancy_checker.txt"
)


def load_prompt_template():
    return PROMPT_PATH.read_text(encoding="utf-8")


def serialize_client_context(context):
    if not context:
        return {}

    return {
        "cc_location": context.cc_location,
        "cc_description": context.cc_description,
        "cc_services_being_sold": context.cc_services_being_sold,
        "cc_service_description": context.cc_service_description,
        "cc_typical_promblems_we_solve": context.cc_typical_promblems_we_solve,
        "cc_typical_engagements": context.cc_typical_engagements,
        "cc_ideal_buying_situations": context.cc_ideal_buying_situations,
        "cc_known_affairs_subsidiaries": context.cc_known_affairs_subsidiaries,
        "cc_parent_company": context.cc_parent_company,
        "cc_alternate_names_abbreviations": (
            context.cc_alternate_names_abbreviations
        ),
    }


def serialize_signal(signal):
    return {
        "signal_number": signal.signal_number,
        "category_name": signal.category_name,
        "signal_family": signal.signal_family,
        "observable_event": signal.observable_event,
        "company_archetype_revealed": signal.company_archetype_revealed,
        "underlying_buying_condition": signal.underlying_buying_condition,
        "why_it_matters": signal.why_it_matters,
        "likely_buyer_persona": signal.likely_buyer_persona,
        "likely_buying_window": signal.likely_buying_window,
        "signal_strength": signal.signal_strength,
        "illustrative_discovery_query": signal.illustrative_discovery_query,
    }


def serialize_signal_catalog(signals):
    return [serialize_signal(signal) for signal in signals]


def replace_placeholders(template, values):
    prompt = template

    for key, value in values.items():
        if value is None:
            value = ""

        if isinstance(value, (dict, list)):
            value = json.dumps(value, ensure_ascii=False)

        prompt = prompt.replace(
            "{{" + key + "}}",
            str(value)
        )

    return prompt


def build_relevancy_prompt(search_result_id):
    db = SessionLocal()

    try:
        search_result = (
            db.query(SearchResult)
            .filter(SearchResult.id == search_result_id)
            .first()
        )

        if not search_result:
            raise ValueError(
                f"SearchResult {search_result_id} not found."
            )

        account_signal = (
            db.query(AccountSignal)
            .filter(
                AccountSignal.id == search_result.account_signal_id
            )
            .first()
        )

        if not account_signal:
            raise ValueError(
                f"AccountSignal {search_result.account_signal_id} not found."
            )

        account = (
            db.query(Account)
            .filter(Account.id == account_signal.account_id)
            .first()
        )

        if not account:
            raise ValueError(
                f"Account {account_signal.account_id} not found."
            )

        client = (
            db.query(Client)
            .filter(Client.id == account.client_id)
            .first()
        )

        if not client:
            raise ValueError(
                f"Client for Account {account.id} not found."
            )

        # IMPORTANT:
        # Use the latest Account Intelligence row.
        account_intelligence = (
            db.query(AccountIntelligence)
            .filter(
                AccountIntelligence.account_id == account.id
            )
            .order_by(AccountIntelligence.id.desc())
            .first()
        )

        if not account_intelligence:
            raise ValueError(
                f"Account Intelligence for Account {account.id} not found."
            )

        client_context = (
            db.query(ClientContext)
            .filter(ClientContext.client_id == client.id)
            .order_by(ClientContext.id.desc())
            .first()
        )

        # IMPORTANT:
        # GPT-1 needs the COMPLETE client signal catalog,
        # not just the signal attached to this AccountSignal.
        signals = (
            db.query(Signal)
            .filter(Signal.client_id == client.id)
            .order_by(Signal.signal_number.asc())
            .all()
        )

        if not signals:
            raise ValueError(
                f"No signals found for Client {client.id}."
            )

        current_signal = (
            db.query(Signal)
            .filter(Signal.id == account_signal.signal_id)
            .first()
        )

        if not current_signal:
            raise ValueError(
                f"Signal {account_signal.signal_id} not found."
            )

        template = load_prompt_template()

        # The stored signal objective is represented by
        # underlying_buying_condition in the current schema.
        signal_objective = (
            current_signal.underlying_buying_condition
            or current_signal.observable_event
            or ""
        )

        values = {
            "evaluation_date": "",
            
            "clients_account_intelligence_context": json.dumps(
                serialize_client_context(client_context),
                ensure_ascii=False,
            ),

            "clients_signal_catalog": json.dumps(
                serialize_signal_catalog(signals),
                ensure_ascii=False,
            ),

            "clients_accounts_company_name": account.account_name,
            "clients_accounts_website": account.website or "",
            "clients_accounts_linkedin_url": account.linkedin_url or "",

            "clients_accounts_description": (
                account_intelligence.cc_description or ""
            ),

            "clients_accounts_website_scraped_text": (
                account_intelligence.website_scraped_text or ""
            ),

            "clients_accounts_services_being_sold": (
                account_intelligence.cc_services_being_sold or []
            ),

            "clients_accounts_service_description": (
                account_intelligence.cc_service_description or []
            ),

            "clients_accounts_typical_promblems_we_solve": (
                account_intelligence.cc_typical_promblems_we_solve or []
            ),

            "clients_accounts_typical_engagements": (
                account_intelligence.cc_typical_engagements or []
            ),

            "clients_accounts_ideal_buying_situations": (
                account_intelligence.cc_ideal_buying_situations or []
            ),

            "clients_accounts_location": (
                account_intelligence.cc_location or []
            ),

            "clients_accounts_parent_company": (
                account_intelligence.cc_parent_company or ""
            ),

            "clients_accounts_known_affairs_subsidiaries": (
                account_intelligence.cc_known_affairs_subsidiaries or []
            ),

            "clients_accounts_alternate_names_abbreviations": (
                account_intelligence.cc_alternate_names_abbreviations or []
            ),

            "clients_signal_family": (
                current_signal.signal_family or ""
            ),

            "clients_signal_objective": signal_objective,

            "account_signal_search_query": (
                account_signal.search_query or ""
            ),

            "search_result_title": (
                search_result.title or ""
            ),

            "search_result_url": (
                search_result.url or ""
            ),

            "search_result_description": (
                search_result.description or ""
            ),

            "search_result_published_date": (
                search_result.published_date or ""
            ),

            # No criteria configuration exists yet.
            # The GPT-1 prompt defines the default behavior
            # when RELEVANCY_CRITERIA is blank.
            "relevancy_criteria": "",

            # GPT-1 explicitly does NOT use QBC criteria.
            "qbc_criteria": "",
        }

        prompt = replace_placeholders(template, values)

        return prompt

    finally:
        db.close()


def generate_relevancy(prompt):
    client = OpenAI()

    response = client.responses.create(
        model=MODEL,
        input=prompt,
    )

    raw_output = response.output_text.strip()

    try:
        result = json.loads(raw_output)
    except json.JSONDecodeError as exc:
        raise ValueError(
            f"GPT-1 returned invalid JSON:\n{raw_output}"
        ) from exc

    expected_keys = {
        "relevance",
        "trigger",
        "strength",
        "buyer_role",
        "reason",
    }

    actual_keys = set(result.keys())

    if actual_keys != expected_keys:
        raise ValueError(
            "GPT-1 returned unexpected keys.\n"
            f"Expected: {sorted(expected_keys)}\n"
            f"Received: {sorted(actual_keys)}\n"
            f"Output: {raw_output}"
        )

    return result


def save_relevancy_result(search_result_id, result):
    db = SessionLocal()

    try:
        existing = (
            db.query(RelevancyResult)
            .filter(
                RelevancyResult.search_result_id
                == search_result_id
            )
            .first()
        )

        if existing:
            row = existing
        else:
            row = RelevancyResult(
                search_result_id=search_result_id
            )
            db.add(row)

        row.relevance = result["relevance"]
        row.trigger = result["trigger"]
        row.strength = result["strength"]
        row.buyer_role = result["buyer_role"]
        row.reason = result["reason"]

        db.commit()
        db.refresh(row)

        return row

    finally:
        db.close()


def analyze_search_result(search_result_id):
    print(
        f"GPT-1 RELEVANCE ANALYSIS | "
        f"SEARCH RESULT: {search_result_id}"
    )

    prompt = build_relevancy_prompt(search_result_id)

    print("PROMPT BUILT")

    result = generate_relevancy(prompt)

    print("GPT-1 OUTPUT:")
    print(json.dumps(result, indent=2, ensure_ascii=False))

    saved = save_relevancy_result(
        search_result_id,
        result
    )

    print(
        f"RELEVANCY RESULT SAVED: {saved.id}"
    )

    return saved