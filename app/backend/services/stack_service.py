"""Service layer for stack recommendation logic."""

from typing import Any, Dict, List, Literal

from sqlalchemy import select

from models.tools import Tools


PricingPreference = Literal["free_only", "free_freemium", "freemium_paid", "any"]


class StackService:
    """Provides stack recommendation logic."""

    def __init__(self, db: Any = None):
        # Database is optional; recommendations use the DB-backed tools catalog when available.
        self.db = db

    async def recommend(self, goal: str, pricing_preference: PricingPreference = "any") -> Dict[str, Any]:
        """Recommend a tool stack based on the provided goal."""

        tools = await self._load_active_tools(pricing_preference)

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
        stack = self._build_diverse_stack(relevant_tools, intent, pricing_preference)

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

    async def _load_active_tools(self, pricing_preference: PricingPreference) -> List[Dict[str, Any]]:
        """Load active tools from the primary DB-backed catalog."""
        if self.db is None:
            return []

        allowed_models = self._get_allowed_pricing_models(pricing_preference)

        result = await self.db.execute(
            select(Tools)
            .where(Tools.active.is_(True))
            .where(Tools.pricing_model.in_(allowed_models))
            .order_by(Tools.internal_score.desc().nullslast(), Tools.name.asc())
        )
        return [self._serialize_tool(tool) for tool in result.scalars().all()]

    def _get_allowed_pricing_models(self, pricing_preference: PricingPreference) -> List[str]:
        """Map frontend pricing preferences to supported pricing models."""
        pricing_map = {
            "free_only": ["free"],
            "free_freemium": ["free", "freemium"],
            "freemium_paid": ["freemium", "paid"],
            "any": ["free", "freemium", "paid"],
        }
        return pricing_map.get(pricing_preference, pricing_map["any"])

    def _filter_tools_by_pricing(
        self, tools: List[Dict[str, Any]], pricing_preference: PricingPreference
    ) -> List[Dict[str, Any]]:
        """Keep only tools compatible with the selected pricing preference."""
        allowed_models = set(self._get_allowed_pricing_models(pricing_preference))
        return [tool for tool in tools if tool.get("pricing_model") in allowed_models]

    def _serialize_tool(self, tool: Tools) -> Dict[str, Any]:
        """Convert ORM tool rows into the dict shape used by recommendation helpers."""
        return {
            "name": tool.name,
            "slug": tool.slug,
            "short_description": tool.short_description,
            "full_description": tool.full_description,
            "category": tool.category,
            "subcategory": tool.subcategory,
            "tags": tool.tags,
            "pricing_model": tool.pricing_model,
            "starting_price": tool.starting_price,
            "skill_level": tool.skill_level,
            "website_url": tool.website_url,
            "logo_url": tool.logo_url,
            "affiliate_url": tool.affiliate_url,
            "internal_score": tool.internal_score,
            "is_featured": tool.is_featured,
            "pros": tool.pros,
            "cons": tool.cons,
            "best_use_cases": tool.best_use_cases,
            "active": tool.active,
            "use_cases": tool.use_cases,
            "target_audience": tool.target_audience,
            "difficulty_score": tool.difficulty_score,
            "recommended_for": tool.recommended_for,
            "popularity_score": tool.popularity_score,
            "beginner_friendly": tool.beginner_friendly,
            "tool_type": tool.tool_type,
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

    def _extract_logo_url(self, tool: Dict[str, Any]) -> str | None:
        """Return the most reliable logo URL for a tool."""
        # Prefer explicit fields, fall back to Clearbit using website domain.
        logo_url = tool.get("logo_url") or tool.get("logo")
        if logo_url:
            return logo_url

        website = tool.get("website_url")
        if not website:
            return None

        try:
            from urllib.parse import urlparse

            hostname = urlparse(website).hostname or ""
            hostname = hostname.lstrip("www.")
            if hostname:
                return f"https://logo.clearbit.com/{hostname}"
        except Exception:
            pass

        return None

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

    def _build_diverse_stack(
        self,
        tools: List[Dict[str, Any]],
        intent: str,
        pricing_preference: PricingPreference,
    ) -> List[Dict[str, Any]]:
        """Build a diverse stack with role-based tool selection."""
        if len(tools) < 3:
            # Add fallback tools if needed
            fallback_tools = [
                {
                    "name": "Notion",
                    "short_description": "All-in-one workspace for notes and docs.",
                    "internal_score": 90,
                    "category": "automation",
                    "pricing_model": "freemium",
                    "use_cases": "project management, documentation, knowledge base",
                    "target_audience": "teams and individuals",
                    "recommended_for": "organizing work and information",
                    "website_url": "https://www.notion.so",
                    "logo_url": "https://logo.clearbit.com/notion.so",
                    "logo": "https://logo.clearbit.com/notion.so"
                },
                {
                    "name": "Zapier",
                    "short_description": "Automate workflows across apps.",
                    "internal_score": 85,
                    "category": "automation",
                    "pricing_model": "freemium",
                    "use_cases": "workflow automation, app integration, process optimization",
                    "target_audience": "businesses and teams",
                    "recommended_for": "connecting tools and automating processes",
                    "website_url": "https://zapier.com",
                    "logo_url": "https://logo.clearbit.com/zapier.com",
                    "logo": "https://logo.clearbit.com/zapier.com"
                },
                {
                    "name": "Figma",
                    "short_description": "Design and prototype interfaces.",
                    "internal_score": 80,
                    "category": "design",
                    "pricing_model": "freemium",
                    "use_cases": "ui design, prototyping, collaboration",
                    "target_audience": "designers and teams",
                    "recommended_for": "creating visual designs and prototypes",
                    "website_url": "https://www.figma.com",
                    "logo_url": "https://logo.clearbit.com/figma.com",
                    "logo": "https://logo.clearbit.com/figma.com"
                },
            ]
            filtered_fallbacks = self._filter_tools_by_pricing(fallback_tools, pricing_preference)
            tools = tools + filtered_fallbacks

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
            logo_url = self._extract_logo_url(tool)
            stack.append({
                "tool": tool.get("name"),
                "role": role,
                "why": why,
                "logo_url": logo_url,
                "logo": tool.get("logo") or logo_url,
                "website_url": tool.get("website_url"),
            })

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
