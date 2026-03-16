import json
import logging
from typing import List, Optional


from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.user_queries import User_queriesService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/user_queries", tags=["user_queries"])


# ---------- Pydantic Schemas ----------
class User_queriesData(BaseModel):
    """Entity data schema (for create/update)"""
    raw_query: str = None
    detected_goal: str = None
    detected_categories: str = None
    budget_preference: str = None
    suggested_tools: str = None
    visitor_id: str = None
    created_date: str = None


class User_queriesUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    raw_query: Optional[str] = None
    detected_goal: Optional[str] = None
    detected_categories: Optional[str] = None
    budget_preference: Optional[str] = None
    suggested_tools: Optional[str] = None
    visitor_id: Optional[str] = None
    created_date: Optional[str] = None


class User_queriesResponse(BaseModel):
    """Entity response schema"""
    id: int
    raw_query: Optional[str] = None
    detected_goal: Optional[str] = None
    detected_categories: Optional[str] = None
    budget_preference: Optional[str] = None
    suggested_tools: Optional[str] = None
    visitor_id: Optional[str] = None
    created_date: Optional[str] = None

    class Config:
        from_attributes = True


class User_queriesListResponse(BaseModel):
    """List response schema"""
    items: List[User_queriesResponse]
    total: int
    skip: int
    limit: int


class User_queriesBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[User_queriesData]


class User_queriesBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: User_queriesUpdateData


class User_queriesBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[User_queriesBatchUpdateItem]


class User_queriesBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=User_queriesListResponse)
async def query_user_queriess(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query user_queriess with filtering, sorting, and pagination"""
    logger.debug(f"Querying user_queriess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = User_queriesService(db)
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
        logger.debug(f"Found {result['total']} user_queriess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying user_queriess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=User_queriesListResponse)
async def query_user_queriess_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query user_queriess with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying user_queriess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = User_queriesService(db)
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
        logger.debug(f"Found {result['total']} user_queriess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying user_queriess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=User_queriesResponse)
async def get_user_queries(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single user_queries by ID"""
    logger.debug(f"Fetching user_queries with id: {id}, fields={fields}")
    
    service = User_queriesService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"User_queries with id {id} not found")
            raise HTTPException(status_code=404, detail="User_queries not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching user_queries {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=User_queriesResponse, status_code=201)
async def create_user_queries(
    data: User_queriesData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new user_queries"""
    logger.debug(f"Creating new user_queries with data: {data}")
    
    service = User_queriesService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create user_queries")
        
        logger.info(f"User_queries created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating user_queries: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating user_queries: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[User_queriesResponse], status_code=201)
async def create_user_queriess_batch(
    request: User_queriesBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple user_queriess in a single request"""
    logger.debug(f"Batch creating {len(request.items)} user_queriess")
    
    service = User_queriesService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} user_queriess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[User_queriesResponse])
async def update_user_queriess_batch(
    request: User_queriesBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple user_queriess in a single request"""
    logger.debug(f"Batch updating {len(request.items)} user_queriess")
    
    service = User_queriesService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} user_queriess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=User_queriesResponse)
async def update_user_queries(
    id: int,
    data: User_queriesUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing user_queries"""
    logger.debug(f"Updating user_queries {id} with data: {data}")

    service = User_queriesService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"User_queries with id {id} not found for update")
            raise HTTPException(status_code=404, detail="User_queries not found")
        
        logger.info(f"User_queries {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating user_queries {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating user_queries {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_user_queriess_batch(
    request: User_queriesBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple user_queriess by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} user_queriess")
    
    service = User_queriesService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} user_queriess successfully")
        return {"message": f"Successfully deleted {deleted_count} user_queriess", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_user_queries(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single user_queries by ID"""
    logger.debug(f"Deleting user_queries with id: {id}")
    
    service = User_queriesService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"User_queries with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="User_queries not found")
        
        logger.info(f"User_queries {id} deleted successfully")
        return {"message": "User_queries deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user_queries {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")