import json
import logging
from typing import List, Optional


from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.tools import ToolsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/tools", tags=["tools"])


# ---------- Pydantic Schemas ----------
class ToolsData(BaseModel):
    """Entity data schema (for create/update)"""
    name: str
    slug: str
    short_description: str = None
    full_description: str = None
    category: str
    subcategory: str = None
    tags: str = None
    pricing_model: str
    starting_price: str = None
    skill_level: str = None
    website_url: str = None
    logo_url: str = None
    affiliate_url: str = None
    internal_score: int = None
    is_featured: bool = None
    pros: str = None
    cons: str = None
    best_use_cases: str = None
    active: bool = None
    use_cases: str = None
    target_audience: str = None
    difficulty_score: int = None
    recommended_for: str = None
    popularity_score: int = None
    beginner_friendly: bool = None
    tool_type: str = None


class ToolsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    name: Optional[str] = None
    slug: Optional[str] = None
    short_description: Optional[str] = None
    full_description: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    tags: Optional[str] = None
    pricing_model: Optional[str] = None
    starting_price: Optional[str] = None
    skill_level: Optional[str] = None
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    affiliate_url: Optional[str] = None
    internal_score: Optional[int] = None
    is_featured: Optional[bool] = None
    pros: Optional[str] = None
    cons: Optional[str] = None
    best_use_cases: Optional[str] = None
    active: Optional[bool] = None
    use_cases: Optional[str] = None
    target_audience: Optional[str] = None
    difficulty_score: Optional[int] = None
    recommended_for: Optional[str] = None
    popularity_score: Optional[int] = None
    beginner_friendly: Optional[bool] = None
    tool_type: Optional[str] = None


class ToolsResponse(BaseModel):
    """Entity response schema"""
    id: int
    name: str
    slug: str
    short_description: Optional[str] = None
    full_description: Optional[str] = None
    category: str
    subcategory: Optional[str] = None
    tags: Optional[str] = None
    pricing_model: str
    starting_price: Optional[str] = None
    skill_level: Optional[str] = None
    website_url: Optional[str] = None
    logo_url: Optional[str] = None
    affiliate_url: Optional[str] = None
    internal_score: Optional[int] = None
    is_featured: Optional[bool] = None
    pros: Optional[str] = None
    cons: Optional[str] = None
    best_use_cases: Optional[str] = None
    active: Optional[bool] = None
    use_cases: Optional[str] = None
    target_audience: Optional[str] = None
    difficulty_score: Optional[int] = None
    recommended_for: Optional[str] = None
    popularity_score: Optional[int] = None
    beginner_friendly: Optional[bool] = None
    tool_type: Optional[str] = None

    class Config:
        from_attributes = True


class ToolsListResponse(BaseModel):
    """List response schema"""
    items: List[ToolsResponse]
    total: int
    skip: int
    limit: int


class ToolsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[ToolsData]


class ToolsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: ToolsUpdateData


class ToolsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[ToolsBatchUpdateItem]


class ToolsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=ToolsListResponse)
async def query_toolss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query toolss with filtering, sorting, and pagination"""
    logger.debug(f"Querying toolss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = ToolsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} toolss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying toolss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=ToolsListResponse)
async def query_toolss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query toolss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying toolss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = ToolsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} toolss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying toolss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=ToolsResponse)
async def get_tools(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single tools by ID"""
    logger.debug(f"Fetching tools with id: {id}, fields={fields}")
    
    service = ToolsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Tools with id {id} not found")
            raise HTTPException(status_code=404, detail="Tools not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching tools {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=ToolsResponse, status_code=201)
async def create_tools(
    data: ToolsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new tools"""
    logger.debug(f"Creating new tools with data: {data}")
    
    service = ToolsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create tools")
        
        logger.info(f"Tools created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating tools: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating tools: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[ToolsResponse], status_code=201)
async def create_toolss_batch(
    request: ToolsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple toolss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} toolss")
    
    service = ToolsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} toolss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[ToolsResponse])
async def update_toolss_batch(
    request: ToolsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple toolss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} toolss")
    
    service = ToolsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} toolss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=ToolsResponse)
async def update_tools(
    id: int,
    data: ToolsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing tools"""
    logger.debug(f"Updating tools {id} with data: {data}")

    service = ToolsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Tools with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Tools not found")
        
        logger.info(f"Tools {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating tools {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating tools {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_toolss_batch(
    request: ToolsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple toolss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} toolss")
    
    service = ToolsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} toolss successfully")
        return {"message": f"Successfully deleted {deleted_count} toolss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_tools(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single tools by ID"""
    logger.debug(f"Deleting tools with id: {id}")
    
    service = ToolsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Tools with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Tools not found")
        
        logger.info(f"Tools {id} deleted successfully")
        return {"message": "Tools deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting tools {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")