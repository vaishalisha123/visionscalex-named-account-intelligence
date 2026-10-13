from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.account import Account
from app.models.account_intelligence import AccountIntelligence
from app.services.account_intelligence import (
    process_account_intelligence,
    save_account_intelligence,
)


router = APIRouter(
    prefix="/clients/{client_id}/accounts/{account_id}/intelligence",
    tags=["Account Intelligence"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_account(
    client_id: int,
    account_id: int,
    db: Session,
) -> Account:
    account = (
        db.query(Account)
        .filter(
            Account.id == account_id,
            Account.client_id == client_id,
        )
        .first()
    )

    if not account:
        raise HTTPException(
            status_code=404,
            detail="Account not found for this client",
        )

    return account


def _serialize_intelligence(
    intelligence: AccountIntelligence,
) -> dict:
    return {
        "id": intelligence.id,
        "account_id": intelligence.account_id,
        "website_scraped_text": intelligence.website_scraped_text,
        "cc_location": intelligence.cc_location,
        "cc_description": intelligence.cc_description,
        "cc_services_being_sold": intelligence.cc_services_being_sold,
        "cc_service_description": intelligence.cc_service_description,
        "cc_typical_promblems_we_solve": (
            intelligence.cc_typical_promblems_we_solve
        ),
        "cc_typical_engagements": intelligence.cc_typical_engagements,
        "cc_ideal_buying_situations": (
            intelligence.cc_ideal_buying_situations
        ),
        "cc_known_affairs_subsidiaries": (
            intelligence.cc_known_affairs_subsidiaries
        ),
        "cc_parent_company": intelligence.cc_parent_company,
        "cc_alternate_names_abbreviations": (
            intelligence.cc_alternate_names_abbreviations
        ),
    }


@router.get("")
def get_account_intelligence(
    client_id: int,
    account_id: int,
    db: Session = Depends(get_db),
):
    _get_account(client_id, account_id, db)

    intelligence = (
        db.query(AccountIntelligence)
        .filter(
            AccountIntelligence.account_id == account_id
        )
        .order_by(AccountIntelligence.id.desc())
        .first()
    )

    if not intelligence:
        raise HTTPException(
            status_code=404,
            detail="Account intelligence not found",
        )

    return _serialize_intelligence(intelligence)


@router.post("/generate")
def generate_account_intelligence_for_account(
    client_id: int,
    account_id: int,
    db: Session = Depends(get_db),
):
    account = _get_account(client_id, account_id, db)

    if not account.website:
        raise HTTPException(
            status_code=400,
            detail="Account website is required before generating intelligence",
        )

    try:
        intelligence = process_account_intelligence(
            company_name=account.account_name,
            website=account.website,
        )

        saved = save_account_intelligence(
            account_id=account.id,
            intelligence=intelligence,
        )

        return _serialize_intelligence(saved)

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Account intelligence generation failed: {exc}",
        ) from exc
