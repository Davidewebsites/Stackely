# Stackely — Structural Improvements

## Tasks

1. **Asset Cleanup**
   - Remove `/public/images/` folder and all contents
   - Remove `/public/favicon_old.ico`, `/public/favicon_old.png`, `/public/logo_old.png`
   - Verify all components use only `/favicon.ico`, `/favicon.png`, `/logo.png`

2. **SEO Route: /tools/:slug** (update existing /tool/:slug → /tools/:slug)
   - Update App.tsx route
   - Update all navigate/Link references from `/tool/` to `/tools/`
   - ToolDetail.tsx already exists and works

3. **SEO Route: /categories/:category**
   - Create `src/pages/CategoryPage.tsx`
   - Display category title, intro text, list of tools
   - Update App.tsx with route

4. **SEO Route: /goals/:goal**
   - Create `src/pages/GoalPage.tsx`
   - Display goal description, recommended stack, tools, alternatives
   - Update App.tsx with route

5. **Maintenance Mode**
   - Create `src/lib/maintenance.ts` config flag
   - Create `src/pages/Maintenance.tsx` branded page
   - Add maintenance check in App.tsx

6. **Update all internal links** to use new route structure
   - ToolCard → `/tools/{slug}`
   - StackCard → `/tools/{slug}`
   - Category buttons → `/categories/{category}`
   - Goal links → `/goals/{goal}`

## Files to create/modify (max 8)
- `src/pages/CategoryPage.tsx` (NEW)
- `src/pages/GoalPage.tsx` (NEW)
- `src/pages/Maintenance.tsx` (NEW)
- `src/lib/maintenance.ts` (NEW)
- `src/App.tsx` (MODIFY)
- `src/pages/Index.tsx` (MODIFY — category links)
- `src/components/ToolCard.tsx` (MODIFY — tool links)
- `src/components/StackCard.tsx` (MODIFY — tool links)