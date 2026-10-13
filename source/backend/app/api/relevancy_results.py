from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.account import Account
from app.models.account_signal import AccountSignal
from app.models.search_result import SearchResult
from app.models.relevancy_result import RelevancyResult
from app.models.signal import Signal


router = APIRouter(
    prefix="/clients/{client_id}/accounts/{account_id}/relevancy-results",
    tags=["Relevancy Results"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("")
def list_relevancy_results(
    client_id: int,
    account_id: int,
    db: Session = Depends(get_db),
):
    # ---------------------------------------------------------
    # 1. Verify account belongs to requested client
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
    # 2. Follow the complete ownership chain:
    #
    # RelevancyResult
    #       ↓
    # SearchResult
    #       ↓
    # AccountSignal
    #       ↓
    # Signal
    #       ↓
    # SAME client
    # ---------------------------------------------------------
    rows = (
        db.query(
            RelevancyResult,
            SearchResult,
            AccountSignal,
            Signal,
        )
        .join(
            SearchResult,
            RelevancyResult.search_result_id == SearchResult.id,
        )
        .join(
            AccountSignal,
            SearchResult.account_signal_id == AccountSignal.id,
        )
        .join(
            Signal,
            AccountSignal.signal_id == Signal.id,
        )
        .filter(
            AccountSignal.account_id == account_id,
            Signal.client_id == client_id,
        )
        .order_by(
            RelevancyResult.id.asc()
        )
        .all()
    )

    # ---------------------------------------------------------
    # 3. Return relevancy results
    # ---------------------------------------------------------
    return [
        {
            "id": relevancy_result.id,
            "search_result_id": search_result.id,
            "account_signal_id": account_signal.id,
            "signal_id": signal.id,
            "signal_number": signal.signal_number,
            "signal_family": signal.signal_family,
            "category_name": signal.category_name,
            "search_result_title": search_result.title,
            "search_result_url": search_result.url,
            "search_result_description": search_result.description,
            "published_date": search_result.published_date,
            "relevance": relevancy_result.relevance,
            "trigger": relevancy_result.trigger,
            "strength": relevancy_result.strength,
            "buyer_role": relevancy_result.buyer_role,
            "reason": relevancy_result.reason,
        }
        for (
            relevancy_result,
            search_result,
            account_signal,
            signal,
        ) in rows
    ]