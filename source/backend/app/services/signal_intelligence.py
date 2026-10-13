import json
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

from app.database import SessionLocal
from app.models.signal import Signal


load_dotenv(override=True)


SIGNAL_INTELLIGENCE_MODEL = "gpt-6-astra"

PROMPT_FILE = (
    Path(__file__).resolve().parent.parent
    / "prompts"
    / "signal_intelligence.txt"
)


def build_signal_intelligence_prompt(
    client_company_name: str,
    client_website: str,
    client_linkedin_url: str,
    client_location,
    client_description: str,
    client_services_being_sold,
    client_service_description,
    client_typical_promblems_we_solve,
    client_typical_engagements,
    client_ideal_buying_situations,
    client_known_affairs_subsidiaries,
    client_parent_company: str,
    client_alternate_names_abbreviations,
    client_bu_in_focus: str,
    client_intelligence_context,
) -> str:

    prompt_template = PROMPT_FILE.read_text(encoding="utf-8")

    replacements = {
        "{{clients_company_name}}": client_company_name,
        "{{clients_website}}": client_website,
        "{{clients_linkedin_url}}": client_linkedin_url,
        "{{clients_location}}": json.dumps(
            client_location,
            ensure_ascii=False
        ),
        "{{clients_description}}": client_description,
        "{{clients_services_being_sold}}": json.dumps(
            client_services_being_sold,
            ensure_ascii=False
        ),
        "{{clients_service_description}}": json.dumps(
            client_service_description,
            ensure_ascii=False
        ),
        "{{clients_typical_promblems_we_solve}}": json.dumps(
            client_typical_promblems_we_solve,
            ensure_ascii=False
        ),
        "{{clients_typical_engagements}}": json.dumps(
            client_typical_engagements,
            ensure_ascii=False
        ),
        "{{clients_ideal_buying_situations}}": json.dumps(
            client_ideal_buying_situations,
            ensure_ascii=False
        ),
        "{{clients_known_affairs_subsidiaries}}": json.dumps(
            client_known_affairs_subsidiaries,
            ensure_ascii=False
        ),
        "{{clients_parent_company}}": client_parent_company,
        "{{clients_alternate_names_abbreviations}}": json.dumps(
            client_alternate_names_abbreviations,
            ensure_ascii=False
        ),
        "{{clients_bu_in_focus}}": client_bu_in_focus,
        "{{clients_intelligence_context}}": json.dumps(
            client_intelligence_context,
            ensure_ascii=False
        ),
    }

    for placeholder, value in replacements.items():
        prompt_template = prompt_template.replace(
            placeholder,
            str(value) if value is not None else "Unknown"
        )

    return prompt_template


def generate_signals(prompt: str) -> list:

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise ValueError("OPENAI_API_KEY not found")

    client = OpenAI(api_key=api_key)

    response = client.responses.create(
        model=SIGNAL_INTELLIGENCE_MODEL,
        input=prompt,
    )

    raw_output = response.output_text.strip()

    signals = json.loads(raw_output)

    if not isinstance(signals, list):
        raise ValueError(
            "Signal Intelligence output must be a JSON array"
        )

    return signals


def generate_client_signals(
    client_company_name: str,
    client_website: str,
    client_linkedin_url: str,
    client_location,
    client_description: str,
    client_services_being_sold,
    client_service_description,
    client_typical_promblems_we_solve,
    client_typical_engagements,
    client_ideal_buying_situations,
    client_known_affairs_subsidiaries,
    client_parent_company: str,
    client_alternate_names_abbreviations,
    client_bu_in_focus: str,
    client_intelligence_context,
) -> list:

    prompt = build_signal_intelligence_prompt(
        client_company_name=client_company_name,
        client_website=client_website,
        client_linkedin_url=client_linkedin_url,
        client_location=client_location,
        client_description=client_description,
        client_services_being_sold=client_services_being_sold,
        client_service_description=client_service_description,
        client_typical_promblems_we_solve=client_typical_promblems_we_solve,
        client_typical_engagements=client_typical_engagements,
        client_ideal_buying_situations=client_ideal_buying_situations,
        client_known_affairs_subsidiaries=client_known_affairs_subsidiaries,
        client_parent_company=client_parent_company,
        client_alternate_names_abbreviations=client_alternate_names_abbreviations,
        client_bu_in_focus=client_bu_in_focus,
        client_intelligence_context=client_intelligence_context,
    )

    return generate_signals(prompt)


def save_client_signals(
    client_id: int,
    signals: list,
) -> list:

    db = SessionLocal()

    try:
        saved_signals = []
        db.query(Signal).filter(
            Signal.client_id == client_id
        ).delete(synchronize_session=False)

        for signal_data in signals:

            signal = Signal(
                client_id=client_id,
                signal_number=signal_data.get("signal_number"),
                category_name=signal_data.get("category_name"),
                signal_family=signal_data.get("signal_family"),
                observable_event=signal_data.get("observable_event"),
                company_archetype_revealed=signal_data.get(
                    "company_archetype_revealed"
                ),
                underlying_buying_condition=signal_data.get(
                    "underlying_buying_condition"
                ),
                why_it_matters=signal_data.get(
                    "why_it_matters"
                ),
                likely_buyer_persona=signal_data.get(
                    "likely_buyer_persona"
                ),
                likely_buying_window=signal_data.get(
                    "likely_buying_window"
                ),
                signal_strength=signal_data.get(
                    "signal_strength"
                ),
                enabled=1,
                illustrative_discovery_query=signal_data.get(
                    "illustrative_discovery_query"
                ),
            )

            db.add(signal)
            saved_signals.append(signal)

        db.commit()

        for signal in saved_signals:
            db.refresh(signal)

        return saved_signals

    finally:
        db.close()
