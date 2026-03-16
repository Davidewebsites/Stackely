from core.database import Base
from sqlalchemy import Boolean, Column, Integer, String


class Tools(Base):
    __tablename__ = "tools"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True, autoincrement=True, nullable=False)
    name = Column(String, nullable=False)
    slug = Column(String, nullable=False)
    short_description = Column(String, nullable=True)
    full_description = Column(String, nullable=True)
    category = Column(String, nullable=False)
    subcategory = Column(String, nullable=True)
    tags = Column(String, nullable=True)
    pricing_model = Column(String, nullable=False)
    starting_price = Column(String, nullable=True)
    skill_level = Column(String, nullable=True)
    website_url = Column(String, nullable=True)
    logo_url = Column(String, nullable=True)
    affiliate_url = Column(String, nullable=True)
    internal_score = Column(Integer, nullable=True)
    is_featured = Column(Boolean, nullable=True)
    pros = Column(String, nullable=True)
    cons = Column(String, nullable=True)
    best_use_cases = Column(String, nullable=True)
    active = Column(Boolean, nullable=True)
    use_cases = Column(String, nullable=True)
    target_audience = Column(String, nullable=True)
    difficulty_score = Column(Integer, nullable=True)
    recommended_for = Column(String, nullable=True)
    popularity_score = Column(Integer, nullable=True)
    beginner_friendly = Column(Boolean, nullable=True)
    tool_type = Column(String, nullable=True)