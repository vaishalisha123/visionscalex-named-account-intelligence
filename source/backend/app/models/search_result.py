from sqlalchemy import Column, Integer, Text, String, ForeignKey
from app.database import Base


class SearchResult(Base):
    __tablename__ = "search_results"

    id = Column(Integer, primary_key=True, index=True)

    account_signal_id = Column(
        Integer,
        ForeignKey("account_signals.id"),
        nullable=False
    )

    title = Column(Text, nullable=True)
    url = Column(Text, nullable=True)
    description = Column(Text, nullable=True)
    published_date = Column(String, nullable=True)

    raw_result = Column(Text, nullable=True)