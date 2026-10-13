from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.client import Client
from app.models.client_context import ClientContext
from app.services.client_context_generation import (
    process_client_context,
    save_client_context,
)

router = APIRouter(
    prefix="/clients/{client_id}/context",
    tags=["Client Context"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ClientContextUpdate(BaseModel):
    cc_location: list | None = None
    cc_description: str | None = None
    cc_services_being_sold: list | None = None
    cc_service_description: list | None = None
    cc_typical_promblems_we_solve: list | None = None
    cc_typical_engagements: list | None = None
    cc_ideal_buying_situations: list | None = None
    cc_known_affairs_subsidiaries: list | None = None
    cc_parent_company: str | None = None
    cc_alternate_names_abbreviations: list | None = None


def serialize_context(context: ClientContext):
    return {
        "id": context.id,
        "client_id": context.client_id,
        "cc_location": context.cc_location,
        "cc_description": context.cc_description,
        "cc_services_being_sold": context.cc_services_being_sold,
        "cc_service_description": context.cc_service_description,
        "cc_typical_promblems_we_solve": context.cc_typical_promblems_we_solve,
        "cc_typical_engagements": context.cc_typical_engagements,
        "cc_ideal_buying_situations": context.cc_ideal_buying_situations,
        "cc_known_affairs_subsidiaries": context.cc_known_affairs_subsidiaries,
        "cc_parent_company": context.cc_parent_company,
        "cc_alternate_names_abbreviations": context.cc_alternate_names_abbreviations,
    }


@router.get("")
def get_client_context(
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
            status_code=404,
            detail="Client context not found",
        )

    return serialize_context(context)


@router.post("/generate")
def generate_client_context_for_client(
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

    if not client.website:
        raise HTTPException(
            status_code=400,
            detail="Client website is required before generating context",
        )

    try:
        context = process_client_context(
            company_name=client.company_name,
            website=client.website,
        )

        saved = save_client_context(
            client_id=client.id,
            context=context,
        )

        return serialize_context(saved)

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Client context generation failed: {exc}",
        ) from exc


@router.put("")
def update_client_context(
    client_id: int,
    payload: ClientContextUpdate,
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
        context = ClientContext(client_id=client_id)
        db.add(context)

    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        setattr(context, field, value)

    db.commit()
    db.refresh(context)

    return serialize_context(context)
