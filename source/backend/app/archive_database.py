import os
from sqlalchemy import create_engine, Column, Integer, String, Text
from sqlalchemy.orm import declarative_base, sessionmaker

ARCHIVE_DATABASE_URL = os.getenv("ARCHIVE_DATABASE_URL", "sqlite:///./visionscalex_archive.db")

archive_engine = create_engine(
    ARCHIVE_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

ArchiveBase = declarative_base()

ArchiveSessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=archive_engine,
)


class DeletedClientArchive(ArchiveBase):
    __tablename__ = "deleted_clients"

    archive_id = Column(Integer, primary_key=True, index=True)
    original_client_id = Column(Integer, nullable=False, index=True)
    company_name = Column(String, nullable=False)
    deleted_at = Column(String, nullable=False)
    snapshot_json = Column(Text, nullable=False)

class DeletedAccountArchive(ArchiveBase):
    __tablename__ = "deleted_accounts"

    archive_id = Column(Integer, primary_key=True, index=True)
    original_account_id = Column(Integer, nullable=False, index=True)
    client_id = Column(Integer, nullable=False, index=True)
    client_name = Column(String, nullable=False)
    account_name = Column(String, nullable=False)
    deleted_at = Column(String, nullable=False)
    snapshot_json = Column(Text, nullable=False)
    
ArchiveBase.metadata.create_all(bind=archive_engine)
