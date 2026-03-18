"""Service layer for stack recommendation logic."""

import json
from pathlib import Path
from typing import Any, Dict, List


class StackService:
    """Provides stack recommendation logic."""

    def __init__(self, db: Any = None):
        # Database is optional; the recommendation logic is deterministic and file-based.
        self.db = db

    async def recommend(self, goal: str) -> Dict[str, Any]:
        """Recommend a tool stack based on the provided goal."""

        # Load tool catalog from local mock data (quick, deterministic, no DB calls).
        # This file exists in the repository and is used by mock-data loader.
        tools_file = Path(__file__).resolve().parent.parent / "mock_data" / "tools.json"
        tools_data = []
        try:
            tools_data = json.loads(tools_file.read_text(encoding="utf-8"))
        except Exception:
            tools_data = []

        # Filter active tools only for deterministic output
        tools = [t for t in tools_data if t.get("active")]

        normalized_goal = (goal or "").strip().lower()

        # Basic keyword -> category mapping
        category_map = {
            "ads": "ads",
            "marketing": "ads",
            "design": "design",
            "landing": "landing_pages",
            "analytics": "analytics",
            "automation": "automation",
            "email": "email_marketing",
            "email marketing": "email_marketing",
            "video": "video",
            "copy": "copywriting",
        }

        category = None
        for keyword, mapped in category_map.items():
            if keyword in normalized_goal:
                category = mapped
                break

        if category:
            tools = [t for t in tools if t.get("category") == category]

        # Sort by internal score to keep selection deterministic
        tools.sort(key=lambda t: t.get("internal_score") or 0, reverse=True)

        # Ensure at least 3 tools by adding defaults if needed
        if len(tools) < 3:
            defaults = [
                {
                    "name": "Notion",
                    "short_description": "All-in-one workspace for notes and docs.",
                    "internal_score": 90,
                },
                {
                    "name": "Zapier",
                    "short_description": "Automate workflows across apps.",
                    "internal_score": 85,
                },
                {
                    "name": "Figma",
                    "short_description": "Design and prototype interfaces.",
                    "internal_score": 80,
                },
            ]
            tools = (tools + defaults)[:3]

        # Build response
        stack = []
        for idx, tool in enumerate(tools[:3]):
            role = "Primary tool" if idx == 0 else "Secondary tool" if idx == 1 else "Supporting tool"
            why = tool.get("short_description") or tool.get("full_description") or f"{tool.get('name')} is a good fit for {goal}."
            stack.append({"tool": tool.get("name"), "role": role, "why": why})

        # Simple comparison between top two tools
        comparison = []
        if len(tools) >= 2:
            a = tools[0]
            b = tools[1]
            score_a = a.get("internal_score") or 0
            score_b = b.get("internal_score") or 0
            if score_a >= score_b:
                winner = a.get("name")
                reason = f"{a.get('name')} has a higher internal score ({score_a}) than {b.get('name')} ({score_b})."
            else:
                winner = b.get("name")
                reason = f"{b.get('name')} has a higher internal score ({score_b}) than {a.get('name')} ({score_a})."
            comparison.append({"toolA": a.get("name"), "toolB": b.get("name"), "winner": winner, "reason": reason})
        else:
            comparison.append(
                {
                    "toolA": tools[0].get("name"),
                    "toolB": tools[0].get("name"),
                    "winner": tools[0].get("name"),
                    "reason": "Only one tool available for this recommendation.",
                }
            )

        notes = [
            f"Goal: {goal}",
            "Recommendations are based on predefined tool metadata and internal scores.",
        ]

        return {
            "goal": goal,
            "stack": stack,
            "comparison": comparison,
            "notes": notes,
        }

        # Build stack recommendations (at least 3 tools)
        stack: List[Dict[str, Any]] = []
        for idx, tool in enumerate(tools[:3]):
            role = "Primary tool" if idx == 0 else "Secondary tool" if idx == 1 else "Supporting tool"
            why = tool.short_description or tool.full_description or f"{tool.name} is suited for {goal}."
            stack.append({"tool": tool.name, "role": role, "why": why})

        # Comparison (at least one entry)
        comparison: List[Dict[str, Any]] = []
        if len(tools) >= 2:
            a = tools[0]
            b = tools[1]
            score_a = getattr(a, "internal_score", 0) or 0
            score_b = getattr(b, "internal_score", 0) or 0
            if score_a >= score_b:
                winner = a.name
                reason = f"{a.name} has a higher internal score ({score_a}) than {b.name} ({score_b})."
            else:
                winner = b.name
                reason = f"{b.name} has a higher internal score ({score_b}) than {a.name} ({score_a})."
            comparison.append({"toolA": a.name, "toolB": b.name, "winner": winner, "reason": reason})
        elif tools:
            # Only one tool available
            comparison.append(
                {
                    "toolA": tools[0].name,
                    "toolB": tools[0].name,
                    "winner": tools[0].name,
                    "reason": "Only one tool available for this recommendation.",
                }
            )

        notes: List[str] = [
            f"Goal: {goal}",
            "Recommendations are generated based on tool metadata and internal scoring.",
        ]

        return {
            "goal": goal,
            "stack": stack,
            "comparison": comparison,
            "notes": notes,
        }
