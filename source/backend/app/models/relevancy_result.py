from sqlalchemy import Column, Integer, Text, ForeignKey
from app.database import Base


class RelevancyResult(Base):
    __tablename__ = "relevancy_results"

    id = Column(Integer, primary_key=True, index=True)

    search_result_id = Column(
        Integer,
        ForeignKey("search_results.id"),
        nullable=False
    )

    relevance = Column(Text, nullable=True)
    trigger = Column(Text, nullable=True)
    strength = Column(Integer, nullable=True)
    buyer_role = Column(Text, nullable=True)
    reason = Column(Text, nullable=True)