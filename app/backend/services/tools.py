import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.tools import Tools

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class ToolsService:
    """Service layer for Tools operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Tools]:
        """Create a new tools"""
        try:
            obj = Tools(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created tools with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating tools: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Tools]:
        """Get tools by ID"""
        try:
            query = select(Tools).where(Tools.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching tools {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of toolss"""
        try:
            query = select(Tools)
            count_query = select(func.count(Tools.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Tools, field):
                        query = query.where(getattr(Tools, field) == value)
                        count_query = count_query.where(getattr(Tools, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Tools, field_name):
                        query = query.order_by(getattr(Tools, field_name).desc())
                else:
                    if hasattr(Tools, sort):
                        query = query.order_by(getattr(Tools, sort))
            else:
                query = query.order_by(Tools.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching tools list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Tools]:
        """Update tools"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Tools {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated tools {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating tools {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete tools"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Tools {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted tools {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting tools {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Tools]:
        """Get tools by any field"""
        try:
            if not hasattr(Tools, field_name):
                raise ValueError(f"Field {field_name} does not exist on Tools")
            result = await self.db.execute(
                select(Tools).where(getattr(Tools, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching tools by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Tools]:
        """Get list of toolss filtered by field"""
        try:
            if not hasattr(Tools, field_name):
                raise ValueError(f"Field {field_name} does not exist on Tools")
            result = await self.db.execute(
                select(Tools)
                .where(getattr(Tools, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Tools.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching toolss by {field_name}: {str(e)}")
            raise