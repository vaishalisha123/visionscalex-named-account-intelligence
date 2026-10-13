import json
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.account import Account
from app.models.account_intelligence import AccountIntelligence
from app.models.account_signal import AccountSignal
from app.models.search_result import SearchResult
from app.models.relevancy_result import RelevancyResult
from app.models.qbc_result import QBCResult
from app.archive_database import ArchiveSessionLocal, DeletedAccountArchive


def build_account_snapshot(db: Session, account_id: int) -> dict:
    account = (
        db.query(Account)
        .filter(Account.id == account_id)
        .first()
    )

    if not account:
        raise ValueError("Account not found")

    client = (
        db.query(Client)
        .filter(Client.id == account.client_id)
        .first()
    )

    if not client:
        raise ValueError("Client not found for account")

    account_intelligence = (
        db.query(AccountIntelligence)
        .filter(AccountIntelligence.account_id == account_id)
        .all()
    )

    account_signals = (
        db.query(AccountSignal)
        .filter(AccountSignal.account_id == account_id)
        .all()
    )

    account_signal_ids = [item.id for item in account_signals]

    search_results = (
        db.query(SearchResult)
        .filter(SearchResult.account_signal_id.in_(account_signal_ids))
        .all()
        if account_signal_ids
        else []
    )

    search_result_ids = [item.id for item in search_results]

    relevancy_results = (
        db.query(RelevancyResult)
        .filter(RelevancyResult.search_result_id.in_(search_result_ids))
        .all()
        if search_result_ids
        else []
    )

    relevancy_result_ids = [item.id for item in relevancy_results]

    qbc_results = (
        db.query(QBCResult)
        .filter(QBCResult.relevancy_result_id.in_(relevancy_result_ids))
        .all()
        if relevancy_result_ids
        else []
    )

    def row_to_dict(row):
        return {
            column.name: getattr(row, column.name)
            for column in row.__table__.columns
        }

    return {
        "archived_at": datetime.utcnow().isoformat(),
        "client": row_to_dict(client),
        "account": row_to_dict(account),
        "account_intelligence": [
            row_to_dict(row) for row in account_intelligence
        ],
        "account_signals": [
            row_to_dict(row) for row in account_signals
        ],
        "search_results": [
            row_to_dict(row) for row in search_results
        ],
        "relevancy_results": [
            row_to_dict(row) for row in relevancy_results
        ],
        "qbc_results": [
            row_to_dict(row) for row in qbc_results
        ],
    }


def archive_account_snapshot(snapshot: dict) -> None:
    client_data = snapshot["client"]
    account_data = snapshot["account"]

    archive_db = ArchiveSessionLocal()

    try:
        archive_record = DeletedAccountArchive(
            original_account_id=account_data["id"],
            client_id=client_data["id"],
            client_name=client_data["company_name"],
            account_name=account_data["account_name"],
            deleted_at=snapshot["archived_at"],
            snapshot_json=json.dumps(snapshot, default=str),
        )

        archive_db.add(archive_record)
        archive_db.commit()

    except Exception:
        archive_db.rollback()
        raise

    finally:
        archive_db.close()