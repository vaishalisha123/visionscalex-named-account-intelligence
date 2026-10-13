from sqlalchemy import Column, Integer, String, Text, ForeignKey, JSON
from app.database import Base


class Signal(Base):
    __tablename__ = "signals"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)

    signal_number = Column(Integer, nullable=False)
    category_name = Column(String, nullable=False)
    signal_family = Column(String, nullable=False)

    observable_event = Column(Text, nullable=True)
    company_archetype_revealed = Column(Text, nullable=True)
    underlying_buying_condition = Column(Text, nullable=True)
    why_it_matters = Column(Text, nullable=True)

    likely_buyer_persona = Column(JSON, nullable=True)
    likely_buying_window = Column(String, nullable=True)
    signal_strength = Column(String, nullable=True)
    enabled = Column(Integer, nullable=False, default=1)
    illustrative_discovery_query = Column(Text, nullable=True)