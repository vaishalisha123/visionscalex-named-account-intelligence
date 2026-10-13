import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

from app.database import SessionLocal
from app.models.account import Account
from app.models.account_intelligence import AccountIntelligence
from app.models.account_signal import AccountSignal
from app.models.client import Client
from app.models.client_context import ClientContext
from app.models.qbc_result import QBCResult
from app.models.relevancy_result import RelevancyResult
from app.models.search_result import SearchResult
from app.models.signal import Signal


load_dotenv(override=True)


MODEL = "gpt-5.6-sol"

PROMPT_PATH = (
    Path(__file__).resolve().parent.parent
    / "prompts"
    / "qbc_checker.txt"
)


EXPECTED_KEYS = {
    "offering_type",
    "target_customer",
    "deal_size_estimate",
    "revenue_motion",
    "maturity_stage",
    "gtm_bottlenecks",
    "additional_attributes",
    "commercial_viability_score",
    "commercial_fit_reason",
    "qbc",
    "qbc_reason",
    "qbc_angle",
}


def serialize_client_context(context):
    if not context:
        return {}

    return {
        "cc_location": context.cc_location,
        "cc_description": context.cc_description,
        "cc_services_being_sold": context.cc_services_being_sold,
        "cc_service_description": context.cc_service_description,
        "cc_typical_promblems_we_solve": (
            context.cc_typical_promblems_we_solve
        ),
        "cc_typical_engagements": context.cc_typical_engagements,
        "cc_ideal_buying_situations": (
            context.cc_ideal_buying_situations
        ),
        "cc_known_affairs_subsidiaries": (
            context.cc_known_affairs_subsidiaries
        ),
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
        "company_archetype_revealed": (
            signal.company_archetype_revealed
        ),
        "underlying_buying_condition": (
            signal.underlying_buying_condition
        ),
        "why_it_matters": signal.why_it_matters,
        "likely_buyer_persona": signal.likely_buyer_persona,
        "likely_buying_window": signal.likely_buying_window,
        "signal_strength": signal.signal_strength,
        "illustrative_discovery_query": (
            signal.illustrative_discovery_query
        ),
    }


def serialize_signal_catalog(signals):
    return [serialize_signal(signal) for signal in signals]


def replace_placeholders(template, values):
    prompt = template

    for key, value in values.items():

        if value is None:
            value = ""

        if isinstance(value, (dict, list)):
            value = json.dumps(
                value,
                ensure_ascii=False,
            )

        prompt = prompt.replace(
            "{" + key + "}",
            str(value),
        )

    return prompt


def load_prompt_template():
    return PROMPT_PATH.read_text(
        encoding="utf-8"
    )


def build_qbc_prompt(search_result_id):
    db = SessionLocal()

    try:

        # ---------------------------------------------------------
        # SEARCH RESULT
        # ---------------------------------------------------------

        search_result = (
            db.query(SearchResult)
            .filter(
                SearchResult.id == search_result_id
            )
            .first()
        )

        if not search_result:
            raise ValueError(
                f"SearchResult {search_result_id} not found."
            )

        # ---------------------------------------------------------
        # ACCOUNT SIGNAL
        # ---------------------------------------------------------

        account_signal = (
            db.query(AccountSignal)
            .filter(
                AccountSignal.id
                == search_result.account_signal_id
            )
            .first()
        )

        if not account_signal:
            raise ValueError(
                f"AccountSignal "
                f"{search_result.account_signal_id} "
                f"not found."
            )

        # ---------------------------------------------------------
        # ACCOUNT
        # ---------------------------------------------------------

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
                f"not found."
            )

        # ---------------------------------------------------------
        # CLIENT
        # ---------------------------------------------------------

        client = (
            db.query(Client)
            .filter(
                Client.id == account.client_id
            )
            .first()
        )

        if not client:
            raise ValueError(
                f"Client for Account "
                f"{account.id} not found."
            )

        # ---------------------------------------------------------
        # LATEST ACCOUNT INTELLIGENCE
        # ---------------------------------------------------------

        account_intelligence = (
            db.query(AccountIntelligence)
            .filter(
                AccountIntelligence.account_id
                == account.id
            )
            .order_by(
                AccountIntelligence.id.desc()
            )
            .first()
        )

        if not account_intelligence:
            raise ValueError(
                f"Account Intelligence for "
                f"Account {account.id} not found."
            )

        # ---------------------------------------------------------
        # CLIENT CONTEXT
        # ---------------------------------------------------------

        client_context = (
            db.query(ClientContext)
            .filter(
                ClientContext.client_id
                == client.id
            )
            .order_by(
                ClientContext.id.desc()
            )
            .first()
        )

        # ---------------------------------------------------------
        # COMPLETE SIGNAL CATALOG
        # ---------------------------------------------------------

        signals = (
            db.query(Signal)
            .filter(
                Signal.client_id == client.id
            )
            .order_by(
                Signal.signal_number.asc()
            )
            .all()
        )

        if not signals:
            raise ValueError(
                f"No signals found for "
                f"Client {client.id}."
            )

        # ---------------------------------------------------------
        # CURRENT SIGNAL
        # ---------------------------------------------------------

        current_signal = (
            db.query(Signal)
            .filter(
                Signal.id
                == account_signal.signal_id
            )
            .first()
        )

        if not current_signal:
            raise ValueError(
                f"Signal "
                f"{account_signal.signal_id} "
                f"not found."
            )

        # ---------------------------------------------------------
        # GPT-1 RESULT
        # ---------------------------------------------------------

        relevancy_result = (
            db.query(RelevancyResult)
            .filter(
                RelevancyResult.search_result_id
                == search_result_id
            )
            .first()
        )

        if not relevancy_result:
            raise ValueError(
                f"RelevancyResult for "
                f"SearchResult {search_result_id} "
                f"not found. "
                f"Run GPT-1 first."
            )

        # ---------------------------------------------------------
        # SERIALIZE GPT-1 RESULT
        # ---------------------------------------------------------

        gpt1_result = {
            "relevance": relevancy_result.relevance,
            "trigger": relevancy_result.trigger,
            "strength": relevancy_result.strength,
            "buyer_role": relevancy_result.buyer_role,
            "reason": relevancy_result.reason,
        }

        # ---------------------------------------------------------
        # SIGNAL OBJECTIVE
        # ---------------------------------------------------------

        signal_objective = (
            current_signal.underlying_buying_condition
            or current_signal.observable_event
            or ""
        )

        # ---------------------------------------------------------
        # PROMPT
        # ---------------------------------------------------------

        template = load_prompt_template()

        values = {

            "evaluation_date": "",

            "seller_reference": json.dumps(
                serialize_client_context(
                    client_context
                ),
                ensure_ascii=False,
            ),

            "signal_catalog": json.dumps(
                serialize_signal_catalog(
                    signals
                ),
                ensure_ascii=False,
            ),

            "ca_name": (
                account.account_name
                or ""
            ),

            "ca_website": (
                account.website
                or ""
            ),

            "ca_linkedin_url": (
                account.linkedin_url
                or ""
            ),

            "ca_company_description": (
                account_intelligence.cc_description
                or ""
            ),

            "ca_company_website_dump": (
                account_intelligence.website_scraped_text
                or ""
            ),

            "ca_services_being_sold": (
                account_intelligence.cc_services_being_sold
                or []
            ),

            "ca_service_description": (
                account_intelligence.cc_service_description
                or []
            ),

            "ca_typical_problems_we_solve": (
                account_intelligence
                .cc_typical_promblems_we_solve
                or []
            ),

            "ca_typical_engagements": (
                account_intelligence
                .cc_typical_engagements
                or []
            ),

            "ca_ideal_buying_situations": (
                account_intelligence
                .cc_ideal_buying_situations
                or []
            ),

            "ca_location": (
                account_intelligence.cc_location
                or []
            ),

            "ca_parent_company": (
                account_intelligence
                .cc_parent_company
                or ""
            ),

            "ca_known_affairs_subsidiaries": (
                account_intelligence
                .cc_known_affairs_subsidiaries
                or []
            ),

            "ca_alternate_names_abbreviations": (
                account_intelligence
                .cc_alternate_names_abbreviations
                or []
            ),

            "signal_family": (
                current_signal.signal_family
                or ""
            ),

            "objective": signal_objective,

            "search_queries": (
                account_signal.search_query
                or ""
            ),

            "title": (
                search_result.title
                or ""
            ),

            "url": (
                search_result.url
                or ""
            ),

            "description": (
                search_result.description
                or ""
            ),

            "published_date": (
                search_result.published_date
                or ""
            ),

            # No configurable criteria source exists yet.
            # The QBC prompt contains its default behavior.
            "relevancy_criteria": "",

            "qbc_criteria": "",

            "signal_relevancy_checker_result": json.dumps(
                gpt1_result,
                ensure_ascii=False,
            ),
        }

        prompt = replace_placeholders(
            template,
            values,
        )

        return prompt

    finally:
        db.close()


def generate_qbc(prompt):
    api_key = os.getenv(
        "OPENAI_API_KEY"
    )

    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY not found"
        )

    client = OpenAI(
        api_key=api_key
    )

    response = client.responses.create(
        model=MODEL,
        input=prompt,
    )

    raw_output = (
        response.output_text.strip()
    )

    try:
        result = json.loads(
            raw_output
        )
    except json.JSONDecodeError as exc:
        raise ValueError(
            "GPT-2 returned invalid JSON:\n"
            f"{raw_output}"
        ) from exc

    if not isinstance(
        result,
        dict,
    ):
        raise ValueError(
            "GPT-2 output must be a JSON object."
        )

    actual_keys = set(
        result.keys()
    )

    if actual_keys != EXPECTED_KEYS:
        raise ValueError(
            "GPT-2 returned unexpected keys.\n"
            f"Expected: "
            f"{sorted(EXPECTED_KEYS)}\n"
            f"Received: "
            f"{sorted(actual_keys)}\n"
            f"Output: {raw_output}"
        )

    return result


def save_qbc_result(
    search_result_id,
    result,
):
    db = SessionLocal()

    try:

        relevancy_result = (
            db.query(RelevancyResult)
            .filter(
                RelevancyResult.search_result_id
                == search_result_id
            )
            .first()
        )

        if not relevancy_result:
            raise ValueError(
                f"RelevancyResult for "
                f"SearchResult {search_result_id} "
                f"not found."
            )

        existing = (
            db.query(QBCResult)
            .filter(
                QBCResult.relevancy_result_id
                == relevancy_result.id
            )
            .first()
        )

        if existing:
            row = existing
        else:
            row = QBCResult(
                relevancy_result_id=
                relevancy_result.id
            )
            db.add(row)

        row.offering_type = (
            result["offering_type"]
        )

        row.target_customer = (
            result["target_customer"]
        )

        row.deal_size_estimate = (
            result["deal_size_estimate"]
        )

        row.revenue_motion = (
            result["revenue_motion"]
        )

        row.maturity_stage = (
            result["maturity_stage"]
        )

        row.gtm_bottlenecks = (
            result["gtm_bottlenecks"]
        )

        row.additional_attributes = (
            result["additional_attributes"]
        )

        row.commercial_viability_score = (
            result[
                "commercial_viability_score"
            ]
        )

        row.commercial_fit_reason = (
            result["commercial_fit_reason"]
        )

        row.qbc = result["qbc"]

        row.qbc_reason = (
            result["qbc_reason"]
        )

        row.qbc_angle = (
            result["qbc_angle"]
        )

        db.commit()
        db.refresh(row)

        return row

    finally:
        db.close()


def analyze_qbc(search_result_id):
    print(
        "GPT-2 QBC ANALYSIS | "
        f"SEARCH RESULT: {search_result_id}"
    )

    prompt = build_qbc_prompt(
        search_result_id
    )

    print("QBC PROMPT BUILT")

    result = generate_qbc(
        prompt
    )

    print(
        "GPT-2 OUTPUT:"
    )

    print(
        json.dumps(
            result,
            indent=2,
            ensure_ascii=False,
        )
    )

    saved = save_qbc_result(
        search_result_id,
        result,
    )

    print(
        "QBC RESULT SAVED: "
        f"{saved.id}"
    )

    return saved