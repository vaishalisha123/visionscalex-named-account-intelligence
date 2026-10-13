from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.account import Account
from app.models.account_signal import AccountSignal
from app.models.signal import Signal
from app.models.search_result import SearchResult
from app.models.relevancy_result import RelevancyResult
from app.models.qbc_result import QBCResult


router = APIRouter(
    prefix="/clients/{client_id}/accounts/{account_id}/qbc-results",
    tags=["QBC Results"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("")
def list_qbc_results(
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
    # 2. Follow the complete ownership chain:
    #
    # QBCResult
    #      ↓
    # RelevancyResult
    #      ↓
    # SearchResult
    #      ↓
    # AccountSignal
    #      ↓
    # Signal
    #      ↓
    # SAME client
    # ---------------------------------------------------------
    rows = (
        db.query(
            QBCResult,
            RelevancyResult,
            SearchResult,
            AccountSignal,
            Signal,
        )
        .join(
            RelevancyResult,
            QBCResult.relevancy_result_id == RelevancyResult.id,
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
            QBCResult.id.asc()
        )
        .all()
    )

    # ---------------------------------------------------------
    # 3. Return QBC results
    # ---------------------------------------------------------
    return [
        {
            "id": qbc_result.id,
            "relevancy_result_id": qbc_result.relevancy_result_id,
            "search_result_id": search_result.id,
            "account_signal_id": account_signal.id,
            "signal_id": signal.id,
            "signal_number": signal.signal_number,
            "signal_family": signal.signal_family,
            "category_name": signal.category_name,
            "search_result_title": search_result.title,
            "search_result_url": search_result.url,
            "offering_type": qbc_result.offering_type,
            "target_customer": qbc_result.target_customer,
            "deal_size_estimate": qbc_result.deal_size_estimate,
            "revenue_motion": qbc_result.revenue_motion,
            "maturity_stage": qbc_result.maturity_stage,
            "gtm_bottlenecks": qbc_result.gtm_bottlenecks,
            "additional_attributes": qbc_result.additional_attributes,
            "commercial_viability_score": (
                qbc_result.commercial_viability_score
            ),
            "commercial_fit_reason": (
                qbc_result.commercial_fit_reason
            ),
            "qbc": qbc_result.qbc,
            "qbc_reason": qbc_result.qbc_reason,
            "qbc_angle": qbc_result.qbc_angle,
        }
        for (
            qbc_result,
            relevancy_result,
            search_result,
            account_signal,
            signal,
        ) in rows
    ]