from sqlalchemy import Column, Integer, String, ForeignKey
from app.database import Base
from sqlalchemy.orm import relationship


class Account(Base):
    __tablename__ = "accounts"

    id = Column(Integer, primary_key=True, index=True)
    client_id = Column(Integer, ForeignKey("clients.id"), nullable=False)
    account_name = Column(String, nullable=False)
    website = Column(String, nullable=True)
    linkedin_url = Column(String, nullable=True)
    client = relationship("Client", back_populates="accounts")