from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.client import Client
from app.models.signal import Signal
from app.models.client_context import ClientContext
from app.services.signal_intelligence import (
    generate_client_signals,
    save_client_signals,
)


router = APIRouter(
    prefix="/clients/{client_id}/signals",
    tags=["Signals"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("")
def list_signals(
    client_id: int,
    db: Session = Depends(get_db),
):
    client = (
        db.query(Client)
        .filter(Client.id == client_id)
        .first()
    )

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Client not found",
        )

    signals = (
        db.query(Signal)
        .filter(Signal.client_id == client_id)
        .order_by(Signal.signal_number.asc())
        .all()
    )

    return [
        {
            "id": signal.id,
            "client_id": signal.client_id,
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
            "likely_buyer_persona": (
                signal.likely_buyer_persona
            ),
            "likely_buying_window": (
                signal.likely_buying_window
            ),
            "signal_strength": signal.signal_strength,
            "enabled": bool(signal.enabled),
            "illustrative_discovery_query": (
                signal.illustrative_discovery_query
            ),
        }
        for signal in signals
    ]


@router.get("/{signal_id}")
def get_signal(
    client_id: int,
    signal_id: int,
    db: Session = Depends(get_db),
):
    signal = (
        db.query(Signal)
        .filter(
            Signal.id == signal_id,
            Signal.client_id == client_id,
        )
        .first()
    )

    if not signal:
        raise HTTPException(
            status_code=404,
            detail="Signal not found for this client",
        )

    return {
        "id": signal.id,
        "client_id": signal.client_id,
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
        "likely_buyer_persona": (
            signal.likely_buyer_persona
        ),
        "likely_buying_window": (
            signal.likely_buying_window
        ),
        "signal_strength": signal.signal_strength,
        "enabled": bool(signal.enabled),
        "illustrative_discovery_query": (
            signal.illustrative_discovery_query
        ),
    }
@router.post("/generate")
def generate_signals_for_client(
    client_id: int,
    db: Session = Depends(get_db),
):
    client = (
        db.query(Client)
        .filter(Client.id == client_id)
        .first()
    )

    if not client:
        raise HTTPException(
            status_code=404,
            detail="Client not found",
        )

    context = (
        db.query(ClientContext)
        .filter(ClientContext.client_id == client_id)
        .order_by(ClientContext.id.desc())
        .first()
    )

    if not context:
        raise HTTPException(
            status_code=400,
            detail="Client context not found. Generate Client Intelligence first.",
        )

    try:
        generated_signals = generate_client_signals(
            client_company_name=client.company_name,
            client_website=client.website or "",
            client_linkedin_url=client.linkedin_url or "",
            client_location=context.cc_location,
            client_description=context.cc_description or "",
            client_services_being_sold=context.cc_services_being_sold,
            client_service_description=context.cc_service_description,
            client_typical_promblems_we_solve=context.cc_typical_promblems_we_solve,
            client_typical_engagements=context.cc_typical_engagements,
            client_ideal_buying_situations=context.cc_ideal_buying_situations,
            client_known_affairs_subsidiaries=context.cc_known_affairs_subsidiaries,
            client_parent_company=context.cc_parent_company or "",
            client_alternate_names_abbreviations=context.cc_alternate_names_abbreviations,
            client_bu_in_focus=client.bu_in_focus or "",
            client_intelligence_context={
                "client_context_id": context.id,
            },
        )

        saved_signals = save_client_signals(
            client_id=client_id,
            signals=generated_signals,
        )

        return [
            {
                "id": signal.id,
                "client_id": signal.client_id,
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
                "enabled": bool(signal.enabled),
                "illustrative_discovery_query": signal.illustrative_discovery_query,
            }
            for signal in saved_signals
        ]

    except HTTPException:
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Signal generation failed: {exc}",
        ) from exc


@router.patch("/{signal_id}/toggle")
def toggle_signal(
    client_id: int,
    signal_id: int,
    db: Session = Depends(get_db),
):
    signal = (
        db.query(Signal)
        .filter(
            Signal.id == signal_id,
            Signal.client_id == client_id,
        )
        .first()
    )

    if not signal:
        raise HTTPException(
            status_code=404,
            detail="Signal not found for this client",
        )

    signal.enabled = 0 if signal.enabled else 1

    db.commit()
    db.refresh(signal)

    return {
        "id": signal.id,
        "client_id": signal.client_id,
        "enabled": bool(signal.enabled),
    }
