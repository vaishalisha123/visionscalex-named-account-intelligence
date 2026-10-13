from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.models.account_intelligence import AccountIntelligence
from app.database import SessionLocal
from app.models.account import Account
from app.models.relevancy_result import RelevancyResult
from pydantic import BaseModel
from app.models.account_signal import AccountSignal
from app.models.search_result import SearchResult
from app.models.qbc_result import QBCResult
from app.services.account_archive import (
    build_account_snapshot,
    archive_account_snapshot,
)
from app.archive_database import (
    ArchiveSessionLocal,
    DeletedAccountArchive,
)

router = APIRouter(
    prefix="/clients/{client_id}/accounts",
    tags=["Accounts"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.get("")
def list_accounts(
    client_id: int,
    db: Session = Depends(get_db),
):
    accounts = (
        db.query(Account)
        .filter(Account.client_id == client_id)
        .order_by(Account.id.asc())
        .all()
    )

    return [
        {
            "id": account.id,
            "client_id": account.client_id,
            "account_name": account.account_name,
            "website": account.website,
            "linkedin_url": account.linkedin_url,
        }
        for account in accounts
    ]


class AccountCreate(BaseModel):
    account_name: str
    website: str
    linkedin_url: str | None = None

@router.post("")
def create_account(
    client_id: int,
    payload: AccountCreate,
    db: Session = Depends(get_db),
):
    account = Account(
        client_id=client_id,
        account_name=payload.account_name,
        website=payload.website,
        linkedin_url=payload.linkedin_url,
    )

    db.add(account)
    db.commit()
    db.refresh(account)

    return {
        "id": account.id,
        "client_id": account.client_id,
        "account_name": account.account_name,
        "website": account.website,
        "linkedin_url": account.linkedin_url,
    }

@router.get("/{account_id}")
def get_account(
    client_id: int,
    account_id: int,
    db: Session = Depends(get_db),
):
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

    return {
        "id": account.id,
        "client_id": account.client_id,
        "account_name": account.account_name,
        "website": account.website,
        "linkedin_url": account.linkedin_url,
    }

@router.delete("/{account_id}")
def delete_account(
    client_id: int,
    account_id: int,
    db: Session = Depends(get_db),
):
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
            detail="Account not found",
        )

    try:
        # 1. Build complete account snapshot
        snapshot = build_account_snapshot(db, account_id)

        # 2. Save snapshot to archive DB if not already archived
        archive_db = ArchiveSessionLocal()

        try:
            existing_archive = (
                archive_db.query(DeletedAccountArchive)
                .filter(
                    DeletedAccountArchive.original_account_id == account_id
                )
                .first()
            )
        finally:
            archive_db.close()

        if not existing_archive:
            archive_account_snapshot(snapshot)

        # IDs needed for dependency-safe deletion
        account_signal_ids = [
            item["id"]
            for item in snapshot["account_signals"]
        ]

        search_result_ids = [
            item["id"]
            for item in snapshot["search_results"]
        ]

        relevancy_result_ids = [
            item["id"]
            for item in snapshot["relevancy_results"]
        ]

        # 3. Delete dependent data in reverse dependency order

        if relevancy_result_ids:
            db.query(QBCResult).filter(
                QBCResult.relevancy_result_id.in_(relevancy_result_ids)
            ).delete(synchronize_session=False)

        if search_result_ids:
            db.query(RelevancyResult).filter(
                RelevancyResult.search_result_id.in_(search_result_ids)
            ).delete(synchronize_session=False)

        if account_signal_ids:
            db.query(SearchResult).filter(
                SearchResult.account_signal_id.in_(account_signal_ids)
            ).delete(synchronize_session=False)

            db.query(AccountSignal).filter(
                AccountSignal.account_id == account_id
            ).delete(synchronize_session=False)

        db.query(AccountIntelligence).filter(
            AccountIntelligence.account_id == account_id
        ).delete(synchronize_session=False)

        # 4. Finally delete the account
        db.query(Account).filter(
            Account.id == account_id
        ).delete(synchronize_session=False)

        db.commit()

        return {
            "message": "Account archived and deleted successfully",
            "account_id": account_id,
            "account_name": snapshot["account"]["account_name"],
            "client_id": snapshot["client"]["id"],
            "client_name": snapshot["client"]["company_name"],
        }

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Account deletion failed. Active database was rolled back.",
        )