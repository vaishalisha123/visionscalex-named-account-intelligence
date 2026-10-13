from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.account import Account
from app.models.account_intelligence import AccountIntelligence
from app.models.account_signal import AccountSignal
from app.models.signal import Signal
from app.models.search_result import SearchResult
from app.models.relevancy_result import RelevancyResult
from app.models.qbc_result import QBCResult


router = APIRouter(
    prefix="/clients/{client_id}/accounts/{account_id}/dashboard",
    tags=["Account Dashboard"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("")
def get_account_dashboard(
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
    # 2. Account Intelligence
    # ---------------------------------------------------------
    intelligence = (
        db.query(AccountIntelligence)
        .filter(
            AccountIntelligence.account_id == account_id
        )
        .order_by(AccountIntelligence.id.desc())
        .first()
    )

    # ---------------------------------------------------------
    # 3. Account × Signal
    #
    # Explicitly verify that the signal belongs to this client.
    # ---------------------------------------------------------
    account_signals = (
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
    # 4. Search Results
    #
    # SearchResult
    #   → AccountSignal
    #   → Signal
    #   → SAME client
    # ---------------------------------------------------------
    search_results = (
        db.query(
            SearchResult,
            AccountSignal,
            Signal,
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
            SearchResult.id.asc()
        )
        .all()
    )

    # ---------------------------------------------------------
    # 5. GPT-1 Relevancy Results
    #
    # RelevancyResult
    #   → SearchResult
    #   → AccountSignal
    #   → Signal
    #   → SAME client
    # ---------------------------------------------------------
    relevancy_results = (
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
    # 6. GPT-2 QBC Results
    #
    # QBCResult
    #   → RelevancyResult
    #   → SearchResult
    #   → AccountSignal
    #   → Signal
    #   → SAME client
    # ---------------------------------------------------------
    qbc_results = (
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
    # 7. Return complete account dashboard
    # ---------------------------------------------------------
    return {
        "account": {
            "id": account.id,
            "client_id": account.client_id,
            "account_name": account.account_name,
            "website": account.website,
            "linkedin_url": account.linkedin_url,
        },

        "account_intelligence": (
            {
                "id": intelligence.id,
                "website_scraped_text": intelligence.website_scraped_text,
                "cc_location": intelligence.cc_location,
                "cc_description": intelligence.cc_description,
                "cc_services_being_sold": intelligence.cc_services_being_sold,
                "cc_service_description": intelligence.cc_service_description,
                "cc_typical_promblems_we_solve": (
                    intelligence.cc_typical_promblems_we_solve
                ),
                "cc_typical_engagements": (
                    intelligence.cc_typical_engagements
                ),
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
            if intelligence
            else None
        ),

        "signals": [
            {
                "account_signal_id": account_signal.id,
                "signal_id": signal.id,
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
                "search_query": account_signal.search_query,
                "query_status": account_signal.query_status,
                "created_at": account_signal.created_at,
                "updated_at": account_signal.updated_at,
            }
            for account_signal, signal in account_signals
        ],

        "search_results": [
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
            for search_result, account_signal, signal
            in search_results
        ],

        "relevancy_results": [
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
            ) in relevancy_results
        ],

        "qbc_results": [
            {
                "id": qbc_result.id,
                "relevancy_result_id": (
                    qbc_result.relevancy_result_id
                ),
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
            ) in qbc_results
        ],

        "summary": {
            "signal_count": len(account_signals),
            "search_result_count": len(search_results),
            "relevancy_result_count": len(relevancy_results),
            "qbc_result_count": len(qbc_results),
        },
    }