from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import SessionLocal
from app.models.account import Account
from app.models.account_signal import AccountSignal
from app.models.signal import Signal
from app.services.account_signal import (
    generate_account_signal_queries,
    get_search_query_progress,
)

router = APIRouter(
    prefix="/clients/{client_id}/accounts/{account_id}/signals",
    tags=["Account Signals"],
)
client_router = APIRouter(
    prefix="/clients/{client_id}/account-signals",
    tags=["Account Signals"],
)

class RegionInFocusRequest(BaseModel):
    region_in_focus: str

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/generate")
def generate_account_signal_queries_for_account(
    client_id: int,
    account_id: int,
    payload: RegionInFocusRequest,
):

    region = payload.region_in_focus.strip()
    
    if not region:
        raise HTTPException(
            status_code=400,
            detail="Region in Focus is required.",
        )
    try:

        generated = generate_account_signal_queries(
            client_id,
            region,
        )
        
        account_queries = [
            {
                "id": item["id"],
                "account_id": item["account_id"],
                "signal_id": item["signal_id"],
                "search_query": item["search_query"],
                "query_status": item["query_status"],
            }
            for item in generated
            if item["account_id"] == account_id
        ]


        return account_queries

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Search query generation failed: {exc}",
        ) from exc
    
@router.get("")
def list_account_signals(
    client_id: int,
    account_id: int,
    db: Session = Depends(get_db),
):
    # ---------------------------------------------------------
    # 1. Verify that the account belongs to the requested client
    # ---------------------------------------------------------
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

    # ---------------------------------------------------------
    # 2. Get only signals belonging to the same client
    # ---------------------------------------------------------
    rows = (
        db.query(AccountSignal, Signal)
        .join(
            Signal,
            AccountSignal.signal_id == Signal.id,
        )
        .filter(
            AccountSignal.account_id == account_id,
            Signal.client_id == client_id,
        )
        .order_by(
            Signal.signal_number.asc()
        )
        .all()
    )

    # ---------------------------------------------------------
    # 3. Return account × signal relationship
    # ---------------------------------------------------------
    return [
        {
            "id": account_signal.id,
            "account_id": account_signal.account_id,
            "signal_id": account_signal.signal_id,
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
            "search_query": account_signal.search_query,
            "query_status": account_signal.query_status,
            "created_at": account_signal.created_at,
            "updated_at": account_signal.updated_at,
        }
        for account_signal, signal in rows
    ]

@client_router.post("/generate")
def generate_all_account_signal_queries(
    client_id: int,
    payload: RegionInFocusRequest,
):
    region = payload.region_in_focus.strip()

    if not region:
        raise HTTPException(
            status_code=400,
            detail="Region in Focus is required.",
        )
    
    try:
        generated = generate_account_signal_queries(client_id,region,)

        
        return [
            {
                "id": item["id"],
                "account_id": item["account_id"],
                "signal_id": item["signal_id"],
                "search_query": item["search_query"],
                "query_status": item["query_status"],
            }
            for item in generated
        ]


    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Search query generation failed: {exc}",
        ) from exc
    
@client_router.get("/progress")
def get_account_signal_query_generation_progress(
    client_id: int,
):
    return get_search_query_progress(client_id)