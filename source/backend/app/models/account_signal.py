from sqlalchemy import Column, Integer, Text, String, ForeignKey
from app.database import Base


class AccountSignal(Base):
    __tablename__ = "account_signals"

    id = Column(Integer, primary_key=True, index=True)

    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)
    signal_id = Column(Integer, ForeignKey("signals.id"), nullable=False)

    search_query = Column(Text, nullable=True)
    query_status = Column(String, nullable=True)

    created_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=True)