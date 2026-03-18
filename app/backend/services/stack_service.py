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

        # Intent detection based on action verbs and goal patterns
        intent = self._detect_intent(normalized_goal)

        # Map intent to relevant categories (multiple categories per intent for diversity)
        intent_categories = self._get_intent_categories(intent)

        # Filter tools by relevant categories
        relevant_tools = [t for t in tools if t.get("category") in intent_categories]

        # If no tools found for intent, fall back to all tools
        if not relevant_tools:
            relevant_tools = tools.copy()

        # Sort by relevance-adjusted score to prioritize quality tools that match intent
        relevant_tools.sort(key=lambda t: self._calculate_relevance_score(t, intent), reverse=True)

        # Build diverse stack with role-based selection
        stack = self._build_diverse_stack(relevant_tools, intent)

        # Enhanced comparison logic using multiple factors
        comparison = self._build_smart_comparison(relevant_tools, intent)

        # Improved notes with intent information
        notes = [
            f"Goal: {goal}",
            f"Detected intent: {intent.replace('_', ' ').title()}",
            "Recommendations based on tool capabilities, user intent, and internal scoring.",
        ]

        return {
            "goal": goal,
            "stack": stack,
            "comparison": comparison,
            "notes": notes,
        }

    def _detect_intent(self, goal: str) -> str:
        """Detect user intent from goal string."""

        # Priority 1: Domain-specific phrases (highest priority)
        domain_phrases = {
            "marketing": [
                "marketing funnel", "sales funnel", "lead generation", "customer acquisition",
                "conversion rate", "traffic generation", "growth hacking", "email campaign",
                "social media marketing", "content marketing", "influencer marketing",
                "affiliate marketing", "performance marketing", "brand awareness"
            ],
            "creation": [
                "landing page", "website design", "web design", "app design", "ui design",
                "ux design", "product design", "graphic design", "logo design", "brand design",
                "mobile app", "web application", "software development", "product launch"
            ],
            "automation": [
                "lead capture", "workflow automation", "process automation", "email automation",
                "marketing automation", "sales automation", "customer automation", "task automation",
                "data integration", "api integration", "system integration", "crm automation"
            ],
            "video": [
                "demo video", "product video", "marketing video", "explainer video", "tutorial video",
                "training video", "promotional video", "brand video", "social video", "video content",
                "video production", "video editing", "motion graphics"
            ],
            "analytics": [
                "data analysis", "performance tracking", "conversion tracking", "user behavior",
                "audience insights", "campaign analytics", "roi analysis", "attribution modeling",
                "cohort analysis", "funnel analysis", "retention analysis"
            ],
            "content": [
                "content strategy", "content creation", "copywriting", "blog writing", "article writing",
                "social media content", "email copy", "advertising copy", "brand storytelling"
            ]
        }

        # Check for domain phrases first (highest priority)
        for intent, phrases in domain_phrases.items():
            for phrase in phrases:
                if phrase in goal:
                    return intent

        # Priority 2: Domain nouns and compound terms (medium priority)
        domain_nouns = {
            "marketing": ["funnel", "campaign", "conversion", "acquisition", "traffic", "engagement"],
            "creation": ["website", "landing", "design", "prototype", "mockup", "wireframe"],
            "automation": ["workflow", "integration", "automation", "sync", "pipeline"],
            "video": ["video", "film", "animation", "motion", "broadcast", "streaming"],
            "analytics": ["analytics", "tracking", "metrics", "insights", "reporting", "dashboard"],
            "content": ["content", "copy", "writing", "blog", "article", "storytelling"]
        }

        # Check for domain nouns (medium priority)
        for intent, nouns in domain_nouns.items():
            for noun in nouns:
                if noun in goal:
                    return intent

        # Priority 3: Action verbs and patterns (lowest priority - original logic)
        intent_patterns = {
            "creation": [
                "build", "create", "make", "develop", "design", "setup", "launch",
                "start", "generate", "produce", "construct", "establish"
            ],
            "marketing": [
                "market", "promote", "advertise", "sell", "campaign", "funnel",
                "acquire", "convert", "grow", "expand", "reach", "engage"
            ],
            "analytics": [
                "analyze", "measure", "track", "monitor", "report", "insights",
                "metrics", "data", "performance", "optimize", "improve"
            ],
            "automation": [
                "automate", "connect", "integrate", "workflow", "process", "streamline",
                "sync", "link", "combine", "merge", "schedule"
            ],
            "content": [
                "write", "copy", "content", "blog", "article", "story", "text",
                "copywriting", "storytelling", "narrative", "communication"
            ],
            "video": [
                "video", "film", "record", "stream", "broadcast", "media", "visual",
                "motion", "animation", "production"
            ]
        }

        # Count matches for each intent (original logic)
        intent_scores = {}
        for intent, patterns in intent_patterns.items():
            score = sum(1 for pattern in patterns if pattern in goal)
            if score > 0:
                intent_scores[intent] = score

        # Return highest scoring intent, default to creation
        if intent_scores:
            return max(intent_scores, key=intent_scores.get)

        return "creation"  # Default fallback

    def _get_intent_categories(self, intent: str) -> List[str]:
        """Map intent to relevant tool categories."""
        intent_category_map = {
            "creation": ["landing_pages", "copywriting"],  # landing page creation prioritizes landing_pages + copywriting
            "marketing": ["landing_pages", "automation", "email_marketing", "analytics"],  # marketing funnel prioritizes these
            "analytics": ["analytics"],
            "automation": ["landing_pages", "automation", "email_marketing"],  # lead capture prioritizes these
            "content": ["copywriting", "video"],
            "video": ["video", "copywriting"]  # product demo video prioritizes video + copywriting
        }

        return intent_category_map.get(intent, ["landing_pages", "copywriting"])

    def _calculate_relevance_score(self, tool: Dict[str, Any], intent: str) -> float:
        """Calculate relevance-adjusted score for tool ranking."""
        base_score = tool.get("internal_score") or 0
        category = tool.get("category", "")
        relevance_multiplier = 1.0

        # Intent-specific relevance adjustments
        if intent == "creation":
            # Strongly prefer landing_pages tools, moderately support copywriting
            if category == "landing_pages":
                relevance_multiplier = 1.3  # Boost landing page tools
            elif category == "copywriting":
                relevance_multiplier = 0.9  # Slight reduction for copywriting (support role)
            else:
                relevance_multiplier = 0.7  # Reduce unrelated tools

        elif intent in ["marketing", "automation"]:
            # Prefer product-relevant categories, penalize productivity tools
            preferred_categories = ["landing_pages", "automation", "email_marketing"]
            if category in preferred_categories:
                relevance_multiplier = 1.2  # Boost preferred categories
                # Apply penalty to workspace/collaboration-oriented automation tools
                tool_name = tool.get("name", "").lower()
                use_cases = tool.get("use_cases", "").lower()
                if category == "automation" and (
                    "communication" in use_cases or "collaboration" in use_cases or
                    "project management" in use_cases or "task" in use_cases or
                    tool_name in ["slack", "trello", "asana"]
                ):
                    relevance_multiplier = 0.7  # Penalty for workspace tools unless no better options
            elif category in ["analytics"]:  # Acceptable for marketing
                relevance_multiplier = 1.0  # Neutral for analytics in marketing context
            else:
                relevance_multiplier = 0.6  # Reduce productivity/collaboration tools

        elif intent == "video":
            # Prefer video tools, support copywriting for content
            if category == "video":
                relevance_multiplier = 1.3  # Boost video tools
            elif category == "copywriting":
                relevance_multiplier = 1.0  # Neutral for copywriting support
            else:
                relevance_multiplier = 0.7  # Reduce unrelated tools

        elif intent == "analytics":
            # Strongly prefer analytics tools
            if category == "analytics":
                relevance_multiplier = 1.4  # Strong boost for analytics tools
            else:
                relevance_multiplier = 0.5  # Reduce non-analytics tools

        elif intent == "content":
            # Prefer copywriting and video tools
            if category in ["copywriting", "video"]:
                relevance_multiplier = 1.2  # Boost content-relevant tools
            else:
                relevance_multiplier = 0.8  # Slight reduction for others

        return base_score * relevance_multiplier

    def _build_diverse_stack(self, tools: List[Dict[str, Any]], intent: str) -> List[Dict[str, Any]]:
        """Build a diverse stack with role-based tool selection."""
        if len(tools) < 3:
            # Add fallback tools if needed
            fallback_tools = [
                {
                    "name": "Notion",
                    "short_description": "All-in-one workspace for notes and docs.",
                    "internal_score": 90,
                    "category": "automation",
                    "use_cases": "project management, documentation, knowledge base",
                    "target_audience": "teams and individuals",
                    "recommended_for": "organizing work and information"
                },
                {
                    "name": "Zapier",
                    "short_description": "Automate workflows across apps.",
                    "internal_score": 85,
                    "category": "automation",
                    "use_cases": "workflow automation, app integration, process optimization",
                    "target_audience": "businesses and teams",
                    "recommended_for": "connecting tools and automating processes"
                },
                {
                    "name": "Figma",
                    "short_description": "Design and prototype interfaces.",
                    "internal_score": 80,
                    "category": "design",
                    "use_cases": "ui design, prototyping, collaboration",
                    "target_audience": "designers and teams",
                    "recommended_for": "creating visual designs and prototypes"
                },
            ]
            tools = (tools + fallback_tools)[:3]

        # Select tools with role diversity based on intent
        selected_tools = []
        categories_used = set()

        # Role definitions based on intent
        role_definitions = {
            "creation": [
                ("Foundation Builder", "landing_pages"),
                ("Content Creator", "copywriting"),
                ("Traffic Generator", "landing_pages")  # fallback to another landing page tool
            ],
            "marketing": [
                ("Lead Capture Page", "landing_pages"),
                ("Automation Engine", "automation"),
                ("Email Nurturer", "email_marketing")
            ],
            "analytics": [
                ("Data Collector", "analytics"),
                ("Insight Generator", "analytics"),
                ("Reporting Tool", "analytics")
            ],
            "automation": [
                ("Lead Capture Page", "landing_pages"),
                ("Workflow Engine", "automation"),
                ("Email System", "email_marketing")
            ],
            "content": [
                ("Content Strategist", "copywriting"),
                ("Media Producer", "video"),
                ("Distribution Tool", "automation")
            ],
            "video": [
                ("Video Creator", "video"),
                ("Content Planner", "copywriting"),
                ("Script Writer", "copywriting")  # fallback to another copywriting tool
            ]
        }

        roles = role_definitions.get(intent, role_definitions["creation"])

        for role_name, preferred_category in roles:
            # Find best tool for this role
            candidates = [t for t in tools if t.get("category") == preferred_category and t not in selected_tools]

            if not candidates:
                # Fallback to any category not used yet
                candidates = [t for t in tools if t not in selected_tools]

            if candidates:
                tool = candidates[0]  # Already sorted by internal_score
                selected_tools.append(tool)
                categories_used.add(tool.get("category"))

        # Ensure we have exactly 3 tools
        while len(selected_tools) < 3 and tools:
            remaining = [t for t in tools if t not in selected_tools]
            if remaining:
                selected_tools.append(remaining[0])

        # Build stack items with enhanced explanations
        stack = []
        for idx, tool in enumerate(selected_tools[:3]):
            role = self._get_role_for_tool(tool, intent, idx)
            why = self._generate_why_explanation(tool, intent, role)
            stack.append({"tool": tool.get("name"), "role": role, "why": why})

        return stack

    def _get_role_for_tool(self, tool: Dict[str, Any], intent: str, position: int) -> str:
        """Determine the appropriate role for a tool based on intent and position."""
        category = tool.get("category", "")

        role_map = {
            "creation": {
                "landing_pages": "Landing Page Builder",
                "copywriting": "Content Creator",
                0: "Foundation Builder",
                1: "Content Creator",
                2: "Traffic Generator"
            },
            "marketing": {
                "landing_pages": "Lead Capture Page",
                "automation": "Automation Engine",
                "email_marketing": "Email Nurturer",
                "analytics": "Performance Tracker",
                0: "Lead Capture Page",
                1: "Automation Engine",
                2: "Email Nurturer"
            },
            "analytics": {
                "analytics": "Data Analyst",
                0: "Data Collector",
                1: "Insight Generator",
                2: "Reporting Tool"
            },
            "automation": {
                "landing_pages": "Lead Capture Page",
                "automation": "Workflow Engine",
                "email_marketing": "Email System",
                0: "Lead Capture Page",
                1: "Workflow Engine",
                2: "Email System"
            },
            "content": {
                "copywriting": "Content Strategist",
                "video": "Media Producer",
                "automation": "Distribution Tool",
                0: "Content Strategist",
                1: "Media Producer",
                2: "Distribution Tool"
            },
            "video": {
                "video": "Video Creator",
                "copywriting": "Content Planner",
                0: "Video Creator",
                1: "Content Planner",
                2: "Script Writer"
            }
        }

        intent_roles = role_map.get(intent, role_map["creation"])

        # Try category-specific role first, then position-based
        return intent_roles.get(category, intent_roles.get(position, f"Tool {position + 1}"))

    def _generate_why_explanation(self, tool: Dict[str, Any], intent: str, role: str) -> str:
        """Generate contextual explanation for why this tool fits the role."""
        name = tool.get("name", "")
        use_cases = tool.get("use_cases", "")
        target_audience = tool.get("target_audience", "")
        recommended_for = tool.get("recommended_for", "")
        short_desc = tool.get("short_description", "")

        # Base explanation using tool's own description
        if short_desc:
            explanation = short_desc
        else:
            explanation = f"{name} is well-suited for {intent.replace('_', ' ')} tasks."

        # Add contextual information based on intent
        context_additions = {
            "creation": f" Perfect for building and launching new projects.",
            "marketing": f" Helps drive growth and customer acquisition.",
            "analytics": f" Provides data-driven insights for optimization.",
            "automation": f" Streamlines workflows and reduces manual effort.",
            "content": f" Enhances content creation and audience engagement.",
            "video": f" Supports visual storytelling and media production."
        }

        addition = context_additions.get(intent, "")
        if addition:
            explanation += addition

        # Add target audience if relevant
        if target_audience and len(explanation) < 200:
            explanation += f" Ideal for {target_audience}."

        return explanation

    def _build_smart_comparison(self, tools: List[Dict[str, Any]], intent: str) -> List[Dict[str, Any]]:
        """Build intelligent tool comparisons using multiple factors."""
        if len(tools) < 2:
            return [{
                "toolA": tools[0].get("name") if tools else "Tool A",
                "toolB": tools[0].get("name") if tools else "Tool B",
                "winner": tools[0].get("name") if tools else "Tool",
                "reason": "Only one tool available for this recommendation."
            }]

        # Select top 2 tools for comparison
        tool_a = tools[0]
        tool_b = tools[1]

        # Multi-factor comparison scoring with relevance
        factors = {
            "relevance_score": (self._calculate_relevance_score(tool_a, intent), self._calculate_relevance_score(tool_b, intent)),
            "popularity_score": (tool_a.get("popularity_score", 0), tool_b.get("popularity_score", 0)),
            "beginner_friendly": (1 if tool_a.get("beginner_friendly") else 0, 1 if tool_b.get("beginner_friendly") else 0),
            "pricing_accessibility": (self._score_pricing(tool_a.get("pricing_model")), self._score_pricing(tool_b.get("pricing_model")))
        }

        # Calculate weighted scores (relevance now primary factor)
        weights = {
            "relevance_score": 0.5,  # Increased weight for relevance
            "popularity_score": 0.3,
            "beginner_friendly": 0.1,
            "pricing_accessibility": 0.1
        }

        score_a = sum(factors[factor][0] * weights[factor] for factor in weights)
        score_b = sum(factors[factor][1] * weights[factor] for factor in weights)

        # Determine winner and build reason
        if score_a >= score_b:
            winner = tool_a.get("name")
            loser = tool_b.get("name")
            winner_score = score_a
            loser_score = score_b
        else:
            winner = tool_b.get("name")
            loser = tool_a.get("name")
            winner_score = score_b
            loser_score = score_a

        # Build contextual reason based on intent
        reason_parts = []

        # Score difference
        score_diff = abs(winner_score - loser_score)
        if score_diff > 10:
            reason_parts.append(f"{winner} significantly outperforms {loser} across key metrics")
        else:
            reason_parts.append(f"{winner} has a slight edge over {loser} in overall suitability")

        # Specific advantages
        if factors["beginner_friendly"][0 if winner == tool_a.get("name") else 1]:
            reason_parts.append(f"{winner} is more beginner-friendly")
        elif factors["beginner_friendly"][1 if winner == tool_a.get("name") else 0]:
            reason_parts.append(f"{loser} is more beginner-friendly, but {winner} offers better overall value")

        # Pricing consideration
        pricing_a = self._score_pricing(tool_a.get("pricing_model"))
        pricing_b = self._score_pricing(tool_b.get("pricing_model"))
        if pricing_a > pricing_b and winner == tool_a.get("name"):
            reason_parts.append(f"{winner} offers better pricing accessibility")
        elif pricing_b > pricing_a and winner == tool_b.get("name"):
            reason_parts.append(f"{winner} offers better pricing accessibility")

        reason = ". ".join(reason_parts) + "."

        return [{
            "toolA": tool_a.get("name"),
            "toolB": tool_b.get("name"),
            "winner": winner,
            "reason": reason
        }]

    def _score_pricing(self, pricing_model: str) -> int:
        """Score pricing model for accessibility (higher = more accessible)."""
        pricing_scores = {
            "free": 100,
            "freemium": 80,
            "paid": 50
        }
        return pricing_scores.get(pricing_model, 50)

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
