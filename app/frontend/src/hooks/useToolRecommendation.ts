import { useState, useCallback } from 'react';
import {
  client,
  buildFocusedStack,
  fetchAIAcceleratorTools,
  fetchAlternativeTools,
  saveUserQuery,
  CATEGORIES,
  type StackTool,
  type AIAcceleratorTool,
  type RankedTool,
  type ClassificationResult,
  type PricingPreference,
  type Tool,
} from '@/lib/api';

const SYSTEM_PROMPT = `You are a marketing tool classifier. Given a user's business goal or need, classify it into:
1. One or more CATEGORIES (exact values only):
   ads, design, copywriting, video, landing_pages, analytics, automation, email_marketing

2. One or more USE_CASES that describe the specific tasks the user needs. Use snake_case tags like:
   - Ads: search_ads, display_ads, social_ads, video_ads, retargeting, campaign_management, audience_targeting, remarketing, lead_generation, brand_awareness, influencer_marketing, shopping_ads
   - Design: social_graphics, ad_creatives, ui_design, web_design, photo_editing, brand_assets, presentations, marketing_materials, prototyping, wireframing, image_manipulation, digital_art, retouching, compositing, design_systems
   - Copywriting: blog_writing, ad_copy, social_media_copy, email_copy, content_generation, seo_optimization, content_optimization, keyword_research, content_editing, proofreading, product_descriptions, professional_writing, competitor_analysis
   - Video: video_editing, social_video_editing, short_form_video, screen_recording, video_tutorials, podcast_editing, film_production, youtube_content, corporate_videos, color_grading, video_effects, transcription, tiktok_content, instagram_reels, social_media_clips
   - Landing Pages: landing_page_creation, lead_capture, ab_testing, conversion_optimization, website_building, portfolio_sites, marketing_websites, simple_landing_pages, campaign_pages, sales_pages, popup_creation, webinar_registration, cms_management
   - Analytics: web_analytics, traffic_analysis, conversion_tracking, audience_insights, performance_tracking, heatmap_analysis, session_recording, user_feedback, ux_research, product_analytics, engagement_tracking, retention_analysis, funnel_optimization, seo_research, competitive_analysis, ppc_optimization, content_strategy
   - Automation: workflow_automation, app_integration, lead_routing, data_sync, notification_automation, crm_management, marketing_automation, lead_nurturing, sales_pipeline, customer_tracking, complex_automation, data_processing, multi_step_workflows, api_integration
   - Email Marketing: email_campaigns, newsletters, drip_sequences, list_management, ecommerce_emails, creator_newsletters, course_launches, digital_product_sales, audience_building, lead_scoring, advanced_email_sequences, predictive_sending

Respond ONLY with valid JSON in this exact format:
{
  "goal": "brief summary of the user's goal",
  "categories": ["category1", "category2"],
  "use_cases": ["use_case1", "use_case2", "use_case3"],
  "reasoning": "one sentence explaining why these categories and use cases were chosen"
}

Rules:
- Return 2-5 categories that are most relevant (max 5 since we build a focused stack)
- Return 3-8 use_cases that best match the user's specific needs
- Only use the exact category names listed above
- Use snake_case for use_cases
- Be precise: if someone wants to "run Facebook ads", primary category is "ads" with use_cases like "social_ads", "campaign_management"
- Consider supporting needs: someone wanting to "launch a product" might need landing_pages, ads, email_marketing, copywriting with use_cases spanning multiple categories`;

const STACK_CONTEXT_PROMPT = `You are a marketing tool advisor. Given a user's goal and a curated stack of tools, provide a brief "use_it_for" and "why_selected" for each tool.

Respond ONLY with valid JSON array in this exact format:
[
  {
    "tool_name": "ToolName",
    "use_it_for": "One concise sentence describing what the user should use this tool for in their specific workflow",
    "why_selected": "One concise sentence explaining why this tool was chosen over alternatives for this role"
  }
]

Rules:
- Keep each sentence under 25 words
- Be specific to the user's goal, not generic
- "use_it_for" should be actionable (start with a verb)
- "why_selected" should mention a concrete advantage`;

const AI_ACCELERATOR_PROMPT = `You are a marketing tool advisor. Given a user's goal and a list of AI tools, provide a brief "use_it_for" sentence for each tool explaining how it accelerates the user's workflow.

Respond ONLY with valid JSON array in this exact format:
[
  {
    "tool_name": "ToolName",
    "use_it_for": "One concise sentence describing how this AI tool accelerates the user's workflow"
  }
]

Rules:
- Keep each sentence under 20 words
- Start with a verb (e.g., "Use it to...", "Generate...", "Automate...")
- Be specific to the user's goal`;

/**
 * Helper: detect if an error is a transient server/network issue (5xx, timeout, network error).
 */
function isTransientError(err: unknown): boolean {
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    if (msg.includes('520') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return true;
    if (msg.includes('network') || msg.includes('timeout') || msg.includes('fetch')) return true;
    if (msg.includes('server') && msg.includes('error')) return true;
  }
  const anyErr = err as Record<string, unknown>;
  if (typeof anyErr?.status === 'number' && anyErr.status >= 500) return true;
  return false;
}

/**
 * Helper: call AI gentxt with automatic retry on transient errors.
 */
async function callAIWithRetry(
  messages: Array<{ role: string; content: string }>,
  maxRetries = 2
): Promise<string> {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await client.ai.gentxt({
        messages,
        model: 'deepseek-v3.2',
        stream: false,
        timeout: 60_000,
      });
      return response?.data?.content || '';
    } catch (err) {
      lastError = err;
      console.warn(`AI call attempt ${attempt + 1} failed:`, err);

      if (attempt < maxRetries && isTransientError(err)) {
        const delay = Math.pow(2, attempt + 1) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
      break;
    }
  }

  throw lastError;
}

/**
 * Format a user-friendly error message from raw errors.
 */
function formatErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const msg = err.message;
    if (msg.includes('520') || msg.includes('502') || msg.includes('503') || msg.includes('504')) {
      return 'The AI service is temporarily unavailable. Please wait a moment and try again.';
    }
    if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('fetch')) {
      return 'Network connection issue. Please check your internet connection and try again.';
    }
    if (msg.toLowerCase().includes('timeout')) {
      return 'The request timed out. Please try again with a simpler goal description.';
    }
    return msg;
  }

  const anyErr = err as Record<string, unknown>;
  if (typeof anyErr?.data === 'string' && anyErr.data.includes('cloudflare')) {
    return 'The AI service is temporarily unavailable. Please wait a moment and try again.';
  }
  if (typeof anyErr?.status === 'number' && anyErr.status >= 500) {
    return 'The AI service is temporarily unavailable. Please wait a moment and try again.';
  }

  return 'Something went wrong. Please try again.';
}

export function useToolRecommendation() {
  const [isLoading, setIsLoading] = useState(false);
  const [classification, setClassification] = useState<ClassificationResult | null>(null);
  const [stack, setStack] = useState<StackTool[]>([]);
  const [alternatives, setAlternatives] = useState<RankedTool[]>([]);
  const [aiAccelerators, setAiAccelerators] = useState<AIAcceleratorTool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activePricing, setActivePricing] = useState<PricingPreference>('any');

  const classify = useCallback(async (query: string, pricingPreference: PricingPreference = 'any') => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);
    setClassification(null);
    setStack([]);
    setAlternatives([]);
    setAiAccelerators([]);
    setActivePricing(pricingPreference);

    try {
      // Step 1: AI classification (with retry)
      const content = await callAIWithRetry([
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: query },
      ]);

      let parsed: ClassificationResult;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        throw new Error('Failed to parse AI classification response. Please try again.');
      }

      const validCategories = [
        'ads', 'design', 'copywriting', 'video',
        'landing_pages', 'analytics', 'automation', 'email_marketing',
      ];
      parsed.categories = (parsed.categories || []).filter((c) => validCategories.includes(c));
      parsed.use_cases = Array.isArray(parsed.use_cases) ? parsed.use_cases : [];

      if (parsed.categories.length === 0) {
        throw new Error('No valid categories detected. Please try rephrasing your goal.');
      }

      setClassification(parsed);

      // Step 2: Build focused stack with pricing filter
      const focusedStack = await buildFocusedStack(
        parsed.categories,
        parsed.use_cases,
        pricingPreference,
        false
      );

      if (focusedStack.length === 0) {
        throw new Error(
          'No tools found matching your pricing preference. Try selecting "Best options regardless of price" for more results.'
        );
      }

      // Step 3: Generate contextual descriptions (with retry, non-critical)
      const toolSummaries = focusedStack.map((t) => ({
        name: t.name,
        category: t.category,
        short_description: t.short_description,
        best_use_cases: t.best_use_cases,
        pros: t.pros,
      }));

      let stackContexts: Array<{ tool_name: string; use_it_for: string; why_selected: string }> = [];

      try {
        const contextContent = await callAIWithRetry([
          { role: 'system', content: STACK_CONTEXT_PROMPT },
          {
            role: 'user',
            content: `User's goal: "${query}"\n\nSelected tools:\n${JSON.stringify(toolSummaries, null, 2)}`,
          },
        ], 1);

        const jsonArrayMatch = contextContent.match(/\[[\s\S]*\]/);
        if (jsonArrayMatch) {
          stackContexts = JSON.parse(jsonArrayMatch[0]);
        }
      } catch (err) {
        console.error('Failed to generate stack context, using defaults:', err);
      }

      // Step 4: Merge into StackTool objects
      const stackTools: StackTool[] = focusedStack.map((tool) => {
        const catInfo = CATEGORIES.find((c) => c.id === tool.category);
        const context = stackContexts.find(
          (sc) => sc.tool_name?.toLowerCase() === tool.name.toLowerCase()
        );

        return {
          ...tool,
          role: catInfo?.role || catInfo?.label || tool.category,
          role_icon: '',
          use_it_for:
            context?.use_it_for || tool.best_use_cases?.split(',')[0]?.trim() || tool.short_description,
          why_selected:
            context?.why_selected ||
            `Top-ranked ${catInfo?.label || tool.category} tool with a score of ${tool.relevance_score}`,
          relevance_score: tool.relevance_score,
        };
      });

      setStack(stackTools);

      // Step 5: Fetch alternative tools (non-critical)
      const stackIds = stackTools.map((t) => t.id);

      try {
        const altTools = await fetchAlternativeTools(
          parsed.categories,
          parsed.use_cases,
          stackIds
        );
        setAlternatives(altTools);
      } catch (err) {
        console.error('Failed to fetch alternative tools:', err);
      }

      // Step 6: Fetch AI accelerator tools (non-critical)
      try {
        const allExcludeIds = [...stackIds, ...alternatives.map((a) => a.id)];
        const aiTools = await fetchAIAcceleratorTools(
          parsed.categories,
          parsed.use_cases,
          allExcludeIds
        );

        if (aiTools.length > 0) {
          // Generate contextual descriptions for AI tools
          let aiContexts: Array<{ tool_name: string; use_it_for: string }> = [];
          try {
            const aiContextContent = await callAIWithRetry([
              { role: 'system', content: AI_ACCELERATOR_PROMPT },
              {
                role: 'user',
                content: `User's goal: "${query}"\n\nAI tools:\n${JSON.stringify(
                  aiTools.map((t) => ({ name: t.name, short_description: t.short_description, category: t.category })),
                  null,
                  2
                )}`,
              },
            ], 1);

            const aiJsonMatch = aiContextContent.match(/\[[\s\S]*\]/);
            if (aiJsonMatch) {
              aiContexts = JSON.parse(aiJsonMatch[0]);
            }
          } catch {
            console.error('Failed to generate AI accelerator context');
          }

          const accelerators: AIAcceleratorTool[] = aiTools.map((tool: Tool) => {
            const ctx = aiContexts.find(
              (c) => c.tool_name?.toLowerCase() === tool.name.toLowerCase()
            );
            return {
              ...tool,
              use_it_for: ctx?.use_it_for || tool.best_use_cases?.split(',')[0]?.trim() || tool.short_description,
            };
          });

          setAiAccelerators(accelerators);
        }
      } catch (err) {
        console.error('Failed to fetch AI accelerator tools:', err);
      }

      // Step 7: Save query
      saveUserQuery({
        raw_query: query,
        detected_goal: parsed.goal,
        detected_categories: parsed.categories.join(','),
        detected_use_cases: parsed.use_cases.join(','),
        suggested_tools: stackTools.map((t) => String(t.id)).join(','),
        pricing_preference: pricingPreference,
      });
    } catch (err: unknown) {
      const message = formatErrorMessage(err);
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setClassification(null);
    setStack([]);
    setAlternatives([]);
    setAiAccelerators([]);
    setError(null);
    setIsLoading(false);
    setActivePricing('any');
  }, []);

  return { classify, reset, isLoading, classification, stack, alternatives, aiAccelerators, error, activePricing };
}