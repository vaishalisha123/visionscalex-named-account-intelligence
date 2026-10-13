from sqlalchemy import Column, Integer, Text, ForeignKey, JSON
from app.database import Base


class QBCResult(Base):
    __tablename__ = "qbc_results"

    id = Column(Integer, primary_key=True, index=True)

    relevancy_result_id = Column(
        Integer,
        ForeignKey("relevancy_results.id"),
        nullable=False
    )

    offering_type = Column(Text, nullable=True)
    target_customer = Column(Text, nullable=True)
    deal_size_estimate = Column(Text, nullable=True)
    revenue_motion = Column(Text, nullable=True)
    maturity_stage = Column(Text, nullable=True)

    gtm_bottlenecks = Column(JSON, nullable=True)
    additional_attributes = Column(JSON, nullable=True)

    commercial_viability_score = Column(Integer, nullable=True)
    commercial_fit_reason = Column(Text, nullable=True)

    qbc = Column(Text, nullable=True)
    qbc_reason = Column(Text, nullable=True)
    qbc_angle = Column(Text, nullable=True)