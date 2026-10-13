from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import SessionLocal
from app.models.client import Client
from app.models.client_context import ClientContext
from app.models.account import Account
from app.models.account_intelligence import AccountIntelligence
from app.models.account_signal import AccountSignal
from app.models.search_result import SearchResult
from app.models.relevancy_result import RelevancyResult
from app.models.qbc_result import QBCResult
from app.models.signal import Signal

from app.services.client_archive import (
    build_client_snapshot,
    archive_client_snapshot,
)
from app.archive_database import ArchiveSessionLocal, DeletedClientArchive

router = APIRouter(
    prefix="/clients",
    tags=["Clients"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class ClientCreate(BaseModel):
    company_name: str
    website: str | None = None
    linkedin_url: str | None = None
    bu_in_focus: str | None = None


@router.get("")
def list_clients(
    db: Session = Depends(get_db),
):
    clients = (
        db.query(Client)
        .order_by(Client.id.asc())
        .all()
    )

    return [
        {
            "id": client.id,
            "company_name": client.company_name,
            "website": client.website,
            "linkedin_url": client.linkedin_url,
            "bu_in_focus": client.bu_in_focus,
        }
        for client in clients
    ]


@router.post("")
def create_client(
    payload: ClientCreate,
    db: Session = Depends(get_db),
):
    client = Client(
        company_name=payload.company_name,
        website=payload.website,
        linkedin_url=payload.linkedin_url,
        bu_in_focus=payload.bu_in_focus,
    )

    db.add(client)
    db.commit()
    db.refresh(client)

    return {
        "id": client.id,
        "company_name": client.company_name,
        "website": client.website,
        "linkedin_url": client.linkedin_url,
        "bu_in_focus": client.bu_in_focus,
    }


@router.get("/{client_id}")
def get_client(
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

    return {
        "id": client.id,
        "company_name": client.company_name,
        "website": client.website,
        "linkedin_url": client.linkedin_url,
        "bu_in_focus": client.bu_in_focus,
    }
@router.delete("/{client_id}")
def delete_client(
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

    try:
        # 1. Build complete snapshot from active DB
        snapshot = build_client_snapshot(db, client_id)

        # 2. Save snapshot to archive DB if not already archived
        archive_db = ArchiveSessionLocal()

        try:
            existing_archive = (
                archive_db.query(DeletedClientArchive)
                .filter(
                    DeletedClientArchive.original_client_id == client_id
                )
                .first()
            )
        finally:
            archive_db.close()

        if not existing_archive:
            archive_client_snapshot(snapshot)

        # IDs needed for dependency-safe deletion
        account_ids = [
            item["id"]
            for item in snapshot["accounts"]
        ]

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

        # 3. Delete in reverse dependency order

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

        if account_ids:
            db.query(AccountSignal).filter(
                AccountSignal.account_id.in_(account_ids)
            ).delete(synchronize_session=False)

            db.query(AccountIntelligence).filter(
                AccountIntelligence.account_id.in_(account_ids)
            ).delete(synchronize_session=False)

            db.query(Account).filter(
                Account.id.in_(account_ids)
            ).delete(synchronize_session=False)

        db.query(ClientContext).filter(
            ClientContext.client_id == client_id
        ).delete(synchronize_session=False)

        db.query(Signal).filter(
            Signal.client_id == client_id
        ).delete(synchronize_session=False)

        # 4. Finally delete the client
        db.query(Client).filter(
            Client.id == client_id
        ).delete(synchronize_session=False)

        db.commit()

        return {
            "message": "Client archived and deleted successfully",
            "client_id": client_id,
            "company_name": snapshot["client"]["company_name"],
        }

    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Client deletion failed. Active database was rolled back.",
        )