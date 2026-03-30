/**
 * Category SEO intros — dynamic, user-intent-focused content for category pages.
 * Each intro is ~120 words, natural English, specific to use cases, not generic.
 */

export const CATEGORY_INTROS: Record<string, string> = {
  ads: `Running ads across Meta, Google, or TikTok? The right tools can transform how you build campaigns—from audience targeting to creative testing to ROI tracking. Whether you're managing Facebook ads, Instagram campaigns, or PPC on Google, these platforms help you reduce guesswork, automate bidding, and squeeze more value from your ad budget. From small-business owners testing their first paid campaigns to marketing teams running multi-channel strategies, finding tools that fit your workflow (and budget) matters. Stackely's curated ads tools are ranked by performance so you can skip the noise and focus on growth.`,
  
  design: `Great design is no longer just for agencies. Today's best design tools let creators, marketers, and small teams build stunning visuals without needing years of training. Whether you're making social graphics, landing page mockups, brand templates, or short-form video edits, the right tool depends on your skill level and project type. These platforms are built to be accessible—some emphasize templates and drag-and-drop simplicity, while others give advanced users full creative control. Find the design tool that matches your workflow: quick social posts, polished brand materials, or complex design projects.`,
  
  copywriting: `Your words shape how people perceive your business. Whether you're writing product descriptions, email campaigns, landing page copy, or social content, copywriting tools now help teams speed up drafting, improve clarity, and maintain brand voice. These aren't just spelling checkers—they're built to understand tone, audience fit, and persuasion. Some focus on marketing-specific language, others help you brainstorm ideas, and some excel at editing and refinement. If you're a solo founder, content creator, or marketer juggling multiple projects, the right copywriting tool can cut hours off your week while keeping quality high.`,
  
  video: `Video is everywhere—YouTube, TikTok, LinkedIn, Instagram stories. But creating video content at scale is overwhelming without the right tools. Modern video platforms range from simple editing (trimming clips, adding captions) to full production workflows (storyboarding, AI voiceover, motion graphics). Whether you're a creator managing a channel, a marketer cutting highlight reels, or a social team mass-producing short-form content, these tools handle everything from scriptwriting to publishing. Find the video platform that fits your speed, skill level, and content type—from quick turnarounds to polished productions.`,
  
  landing_pages: `Your landing page is often the first real impression—and it needs to convert. Modern landing page builders let you launch without touching code: add forms, track conversions, A/B test variations, and integrate with your sales stack. Whether you're running a campaign, pre-selling a product, or capturing leads, these platforms handle templates, hosting, and analytics all in one place. Marketers love them because you can iterate fast and see what works. Founders appreciate the low setup friction. And teams value the collaboration and integrations. Choose a builder based on speed, design flexibility, and the workflows you actually use.`,
  
  analytics: `Understanding what your users actually do (vs. what you assume) changes everything. Analytics tools track behavior across your website, app, emails, or ad campaigns—then turn that data into actionable insights. Are people dropping off at checkout? Which landing page variant converts better? What content brings back repeat visitors? These platforms range from simple dashboards to sophisticated customer journey mapping. If you're optimizing conversion rates, running experiments, or trying to understand user behavior, the right analytics tool becomes your most valuable asset—turning data into direction.`,
  
  automation: `Repetitive tasks drain your time faster than anything. Marketing automation, workflow automation, and task automation tools handle the work that doesn't need human judgment—emails, lead routing, notifying teams, updating spreadsheets. This frees you to focus on strategy and creativity. Whether you're automating email sequences, connecting apps, orchestrating notifications, or managing approvals, these platforms reduce manual effort and human error. Teams swear by them. Entrepreneurs use them to scale without hiring. The key is finding the automation tool that fits your tech stack and doesn't require a developer to set up.`,
  
  email_marketing: `Email still delivers the highest ROI of any marketing channel—if you do it right. Modern email platforms help you segment audiences, design beautiful templates, set up automation sequences, and track opens/clicks with precision. Whether you're sending newsletters, promotional campaigns, or behavioral triggered messages, email tools let you personalize at scale. Creators use them for subscriber engagement; e-commerce teams use them for cart recovery; SaaS companies use them to onboard users. The right platform balances sophistication (segmentation, A/B testing) with simplicity (drag-and-drop design, automation templates).`,
};

/**
 * Get SEO intro text for a category slug
 */
export function getCategoryIntro(categoryId: string | undefined): string | null {
  if (!categoryId) return null;
  return CATEGORY_INTROS[categoryId] || null;
}
