from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.account import Account
from app.models.account_signal import AccountSignal
from app.models.search_result import SearchResult
from app.models.signal import Signal


router = APIRouter(
    prefix="/clients/{client_id}/accounts/{account_id}/search-results",
    tags=["Search Results"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("")
def list_search_results(
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
    # 2. Get search results only through AccountSignals
    #    connected to Signals belonging to the same client
    # ---------------------------------------------------------
    rows = (
        db.query(SearchResult, AccountSignal, Signal)
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
            SearchResult.id.asc()
        )
        .all()
    )

    # ---------------------------------------------------------
    # 3. Return search-result data
    # ---------------------------------------------------------
    return [
        {
            "id": search_result.id,
            "account_signal_id": account_signal.id,
            "signal_id": signal.id,
            "signal_number": signal.signal_number,
            "signal_family": signal.signal_family,
            "category_name": signal.category_name,
            "title": search_result.title,
            "url": search_result.url,
            "description": search_result.description,
            "published_date": search_result.published_date,
        }
        for search_result, account_signal, signal in rows
    ]