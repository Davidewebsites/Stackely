import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.user_queries import User_queries

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class User_queriesService:
    """Service layer for User_queries operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[User_queries]:
        """Create a new user_queries"""
        try:
            obj = User_queries(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created user_queries with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating user_queries: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[User_queries]:
        """Get user_queries by ID"""
        try:
            query = select(User_queries).where(User_queries.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching user_queries {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of user_queriess"""
        try:
            query = select(User_queries)
            count_query = select(func.count(User_queries.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(User_queries, field):
                        query = query.where(getattr(User_queries, field) == value)
                        count_query = count_query.where(getattr(User_queries, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(User_queries, field_name):
                        query = query.order_by(getattr(User_queries, field_name).desc())
                else:
                    if hasattr(User_queries, sort):
                        query = query.order_by(getattr(User_queries, sort))
            else:
                query = query.order_by(User_queries.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching user_queries list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[User_queries]:
        """Update user_queries"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"User_queries {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated user_queries {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating user_queries {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete user_queries"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"User_queries {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted user_queries {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting user_queries {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[User_queries]:
        """Get user_queries by any field"""
        try:
            if not hasattr(User_queries, field_name):
                raise ValueError(f"Field {field_name} does not exist on User_queries")
            result = await self.db.execute(
                select(User_queries).where(getattr(User_queries, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching user_queries by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[User_queries]:
        """Get list of user_queriess filtered by field"""
        try:
            if not hasattr(User_queries, field_name):
                raise ValueError(f"Field {field_name} does not exist on User_queries")
            result = await self.db.execute(
                select(User_queries)
                .where(getattr(User_queries, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(User_queries.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching user_queriess by {field_name}: {str(e)}")
            raise