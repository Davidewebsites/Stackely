from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_admin_user
from services.mock_data import sync_tools_catalog_from_mock_data

router = APIRouter(prefix="/api/v1/admin/catalog", tags=["admin-catalog"])


@router.post("/sync-tools")
async def sync_tools_catalog(
    _: dict = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Admin-only sync: upsert tools catalog from backend mock_data/tools.json."""
    try:
        result = await sync_tools_catalog_from_mock_data(db)
        return {
            "ok": True,
            "message": "Tools catalog synchronized",
            **result,
        }
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Catalog sync failed: {exc}",
        ) from exc
