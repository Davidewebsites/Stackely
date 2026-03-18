"""Schemas for Stack recommendation endpoint."""

from typing import List

from pydantic import BaseModel, Field


class StackRequest(BaseModel):
    """Request payload for stack recommendation."""

    goal: str = Field(..., description="User goal describing what they want to achieve")


class StackTool(BaseModel):
    """A suggested tool in the recommended stack."""

    tool: str = Field(..., description="Tool name")
    role: str = Field(..., description="Role of the tool in the suggested stack")
    why: str = Field(..., description="Why this tool is recommended")
    logo_url: str | None = Field(None, description="Optional URL for the tool logo")
    logo: str | None = Field(None, description="Optional logo URL (legacy / alternate field)")
    website_url: str | None = Field(None, description="Optional tool website URL, used for logo fallbacks")


class StackComparison(BaseModel):
    """Comparison between two tools."""

    toolA: str = Field(..., description="First tool being compared")
    toolB: str = Field(..., description="Second tool being compared")
    winner: str = Field(..., description="Tool that is recommended as the better choice")
    reason: str = Field(..., description="Why the winner is preferred")


class StackResponse(BaseModel):
    """Response payload for stack recommendation."""

    goal: str = Field(..., description="Original user goal")
    stack: List[StackTool] = Field(..., description="Recommended tool stack")
    comparison: List[StackComparison] = Field(..., description="Comparison between selected tools")
    notes: List[str] = Field(..., description="Additional notes about the recommendation")
