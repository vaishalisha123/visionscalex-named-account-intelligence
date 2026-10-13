from sqlalchemy import Column, Integer, Text, ForeignKey, JSON
from app.database import Base


class AccountIntelligence(Base):
    __tablename__ = "account_intelligence"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("accounts.id"), nullable=False)

    website_scraped_text = Column(Text, nullable=True)

    cc_location = Column(JSON, nullable=True)
    cc_description = Column(Text, nullable=True)
    cc_services_being_sold = Column(JSON, nullable=True)
    cc_service_description = Column(JSON, nullable=True)
    cc_typical_promblems_we_solve = Column(JSON, nullable=True)
    cc_typical_engagements = Column(JSON, nullable=True)
    cc_ideal_buying_situations = Column(JSON, nullable=True)
    cc_known_affairs_subsidiaries = Column(JSON, nullable=True)
    cc_parent_company = Column(Text, nullable=True)
    cc_alternate_names_abbreviations = Column(JSON, nullable=True)
