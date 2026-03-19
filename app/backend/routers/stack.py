"""Stack recommendation router."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from schemas.stack_schema import StackRequest, StackResponse
from services.stack_service import StackService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/stack", tags=["stack"])


@router.post("/recommend", response_model=StackResponse)
async def recommend_stack(
    request: StackRequest,
    db: AsyncSession = Depends(get_db),
):
    """Recommend a toolstack for a given user goal."""
    try:
        service = StackService(db)
        return await service.recommend(request.goal, request.pricing_preference)
    except Exception as e:
        logger.error(f"Stack recommendation failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to generate stack recommendation",
        )
