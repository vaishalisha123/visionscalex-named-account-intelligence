import json
import os
import re
import time
from pathlib import Path

import requests
from dotenv import load_dotenv
from openai import OpenAI

from app.database import SessionLocal
from app.models.client_context import ClientContext


load_dotenv(override=True)


APIFY_ACTOR_ID = "vFDBqKNXeGllTgOLz"
CLIENT_CONTEXT_MODEL = "gpt-5.6-sol"

PROMPT_FILE = (
    Path(__file__).resolve().parent.parent
    / "prompts"
    / "client_context.txt"
)


def scrape_website(website: str) -> str:

    if not website:
        return "Unknown"

    website = str(website).strip()

    if not website.startswith("http"):
        website = "https://" + website

    api_key = os.getenv("APIFY_API_KEY")

    if not api_key:
        raise ValueError("APIFY_API_KEY not found")

    response = requests.post(
        f"https://api.apify.com/v2/acts/{APIFY_ACTOR_ID}/runs",
        params={"token": api_key},
        json={"startUrls": [website]},
        timeout=60,
    )

    response.raise_for_status()

    run_data = response.json()["data"]

    run_id = run_data["id"]
    dataset_id = run_data["defaultDatasetId"]

    while True:

        status_response = requests.get(
            f"https://api.apify.com/v2/actor-runs/{run_id}",
            params={"token": api_key},
            timeout=60,
        )

        status_response.raise_for_status()

        status = status_response.json()["data"]["status"]

        if status == "SUCCEEDED":
            break

        if status in [
            "FAILED",
            "ABORTED",
            "TIMED-OUT",
        ]:
            raise RuntimeError(
                f"Apify run failed: {status}"
            )

        time.sleep(5)

    dataset_response = requests.get(
        f"https://api.apify.com/v2/datasets/{dataset_id}/items",
        params={
            "token": api_key,
            "clean": "true",
            "format": "json",
        },
        timeout=60,
    )

    dataset_response.raise_for_status()

    items = dataset_response.json()

    if not items:
        return "Unknown"

    all_text = []

    for item in items:

        text = (
            item.get("Text")
            or item.get("text")
            or item.get("Body")
            or item.get("body")
            or item.get("Content")
            or item.get("content")
            or item.get("Markdown")
            or item.get("markdown")
            or ""
        )

        if text:
            all_text.append(str(text))

    final_text = " ".join(all_text)

    final_text = re.sub(
        r"\s+",
        " ",
        final_text
    ).strip()

    return final_text or "Unknown"


def build_client_context_prompt(
    company_name: str,
    website: str,
    scraped_website_text: str,
) -> str:

    prompt_template = PROMPT_FILE.read_text(
        encoding="utf-8"
    )

    replacements = {
        "{{clients_company_name}}": (
            company_name or "Unknown"
        ),
        "{{clients_website}}": (
            website or "Unknown"
        ),
        "{{clients_website_scraped_text}}": (
            scraped_website_text or "Unknown"
        ),
    }

    for placeholder, value in replacements.items():

        prompt_template = prompt_template.replace(
            placeholder,
            str(value) if value is not None else "Unknown",
        )

    return prompt_template


def generate_client_context(
    prompt: str,
) -> dict:

    api_key = os.getenv("OPENAI_API_KEY")

    if not api_key:
        raise ValueError("OPENAI_API_KEY not found")

    client = OpenAI(
        api_key=api_key
    )

    response = client.responses.create(
        model=CLIENT_CONTEXT_MODEL,
        input=prompt,
    )

    raw_output = response.output_text.strip()

    context = json.loads(raw_output)

    if not isinstance(context, dict):
        raise ValueError(
            "Client Context output must be a JSON object"
        )

    return context


def process_client_context(
    company_name: str,
    website: str,
) -> dict:

    scraped_website_text = scrape_website(
        website
    )

    prompt = build_client_context_prompt(
        company_name=company_name,
        website=website,
        scraped_website_text=scraped_website_text,
    )

    context = generate_client_context(
        prompt
    )

    context["website_scraped_text"] = scraped_website_text

    return context


def save_client_context(
    client_id: int,
    context: dict,
) -> ClientContext:

    db = SessionLocal()

    try:

        client_context = (
            ClientContext(
                client_id=client_id,

                cc_location=context.get(
                    "cc_location"
                ),

                cc_description=context.get(
                    "cc_description"
                ),

                cc_services_being_sold=context.get(
                    "cc_services_being_sold"
                ),

                cc_service_description=context.get(
                    "cc_service_description"
                ),

                cc_typical_promblems_we_solve=context.get(
                    "cc_typical_promblems_we_solve"
                ),

                cc_typical_engagements=context.get(
                    "cc_typical_engagements"
                ),

                cc_ideal_buying_situations=context.get(
                    "cc_ideal_buying_situations"
                ),

                cc_known_affairs_subsidiaries=context.get(
                    "cc_known_affairs_subsidiaries"
                ),

                cc_parent_company=context.get(
                    "cc_parent_company"
                ),

                cc_alternate_names_abbreviations=context.get(
                    "cc_alternate_names_abbreviations"
                ),
            )
        )

        db.add(client_context)

        db.commit()

        db.refresh(client_context)

        return client_context

    finally:

        db.close()
