from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship
from app.database import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(Integer, primary_key=True, index=True)
    company_name = Column(String, nullable=False)
    website = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    bu_in_focus = Column(String, nullable=True)

    accounts = relationship("Account", back_populates="client")