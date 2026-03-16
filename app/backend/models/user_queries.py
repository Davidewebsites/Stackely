from core.database import Base
from sqlalchemy import Column, Integer, String


class User_queries(Base):
    __tablename__ = "user_queries"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    raw_query = Column(String, nullable=True)
    detected_goal = Column(String, nullable=True)
    detected_categories = Column(String, nullable=True)
    budget_preference = Column(String, nullable=True)
    suggested_tools = Column(String, nullable=True)
    visitor_id = Column(String, nullable=True)
    created_date = Column(String, nullable=True)