#!/usr/bin/env node

/**
 * Sitemap generator for Stackely.
 *
 * Fetches all active tools from the backend API, extracts unique categories,
 * and combines them with predefined goal pages to produce a valid sitemap.xml.
 *
 * IMPORTANT: If the backend API is unreachable (e.g. during CI/CD builds),
 * the script preserves the existing sitemap.xml instead of overwriting it
 * with a degraded version. This ensures deployment never ships a broken sitemap.
 *
 * Usage:  node scripts/generate-sitemap.mjs
 */

import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SITE_URL = 'https://stackely.com';
const API_BASES = [
  'http://localhost:8001/api/v1/entities/tools',
  'http://localhost:8000/api/v1/entities/tools',
];
const OUTPUT_PATH = resolve(__dirname, '..', 'public', 'sitemap.xml');

/** Predefined goal slugs for public goal pages */
const GOAL_SLUGS = [
  'create-instagram-ads',
  'start-youtube-channel',
  'launch-ecommerce-store',
  'automate-marketing',
  'create-website',
  'build-saas-landing-page',
  'grow-newsletter',
  'create-social-media-content',
];

/** Minimum number of URLs we expect in a valid sitemap (homepage + goals = 9) */
const MIN_VALID_URLS = 20;

/** Today's date in YYYY-MM-DD format */
function today() {
  return new Date().toISOString().split('T')[0];
}

/** Build a single <url> XML block */
function urlEntry(loc, lastmod, changefreq, priority) {
  return [
    '  <url>',
    `    <loc>${loc}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    '  </url>',
  ].join('\n');
}

/** Count <url> entries in an existing sitemap file */
function countExistingUrls() {
  if (!existsSync(OUTPUT_PATH)) return 0;
  try {
    const content = readFileSync(OUTPUT_PATH, 'utf-8');
    return (content.match(/<url>/g) || []).length;
  } catch {
    return 0;
  }
}

/** Try each API base URL until one responds */
async function findWorkingApiBase() {
  for (const base of API_BASES) {
    try {
      const res = await fetch(`${base}/all?limit=1`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        console.log(`   Using API at: ${base}`);
        return base;
      }
    } catch {
      // Try next
    }
  }
  return null;
}

async function fetchAllTools() {
  const apiBase = await findWorkingApiBase();
  if (!apiBase) {
    console.warn('   ⚠ No reachable backend API found.');
    return [];
  }

  const tools = [];
  let skip = 0;
  const limit = 200;

  while (true) {
    const queryParam = encodeURIComponent(JSON.stringify({ active: true }));
    const url = `${apiBase}/all?query=${queryParam}&limit=${limit}&skip=${skip}&sort=-internal_score&fields=slug,category`;

    const res = await fetch(url);

    if (!res.ok) {
      console.error(`   API error (status ${res.status}) at skip=${skip}`);
      break;
    }

    const data = await res.json();
    const items = data?.items || data?.data?.items || [];
    if (!Array.isArray(items) || items.length === 0) break;

    tools.push(...items);
    if (items.length < limit) break;
    skip += limit;
  }

  return tools;
}

async function main() {
  console.log('🗺️  Generating sitemap for Stackely…');

  const existingUrlCount = countExistingUrls();
  console.log(`   Existing sitemap has ${existingUrlCount} URLs.`);

  // 1. Try to fetch tools from backend
  let tools = [];
  let apiReachable = false;
  try {
    tools = await fetchAllTools();
    apiReachable = tools.length > 0;
    console.log(`   Fetched ${tools.length} active tools from the database.`);
  } catch (err) {
    console.warn(`   ⚠ Could not reach backend API: ${err.message}`);
  }

  // 2. If API is unreachable and we already have a good sitemap, preserve it
  if (!apiReachable && existingUrlCount >= MIN_VALID_URLS) {
    console.log(`   ✅ Backend unavailable but existing sitemap has ${existingUrlCount} URLs — preserving it.`);
    console.log(`   ℹ  To regenerate, ensure the backend is running and run: pnpm run generate:sitemap`);
    return;
  }

  // 3. If API is unreachable and no good existing sitemap, generate static-only with a warning
  if (!apiReachable) {
    console.warn('   ⚠ Backend unavailable and no existing sitemap to preserve.');
    console.warn('   ⚠ Generating static-only sitemap (homepage + goals). Re-run with backend to get full sitemap.');
  }

  // 4. Deduplicate tools by slug
  const slugSet = new Set();
  const uniqueTools = [];
  for (const tool of tools) {
    const slug = (tool.slug || '').toLowerCase().trim();
    if (slug && !slugSet.has(slug)) {
      slugSet.add(slug);
      uniqueTools.push(tool);
    }
  }

  // 5. Extract unique categories
  const categorySet = new Set();
  for (const tool of uniqueTools) {
    if (tool.category) {
      categorySet.add(tool.category.toLowerCase().trim());
    }
  }

  const date = today();

  // 6. Build URL entries
  const entries = [];

  // Homepage
  entries.push(urlEntry(`${SITE_URL}/`, date, 'daily', '1.0'));

  // Tool pages
  for (const tool of uniqueTools) {
    entries.push(urlEntry(`${SITE_URL}/tools/${tool.slug}`, date, 'weekly', '0.8'));
  }

  // Category pages
  for (const category of [...categorySet].sort()) {
    entries.push(urlEntry(`${SITE_URL}/categories/${category}`, date, 'weekly', '0.7'));
  }

  // Goal pages
  for (const goal of GOAL_SLUGS) {
    entries.push(urlEntry(`${SITE_URL}/goals/${goal}`, date, 'monthly', '0.6'));
  }

  // 7. Safety check: don't overwrite a good sitemap with a degraded one
  if (entries.length < existingUrlCount && entries.length < MIN_VALID_URLS) {
    console.warn(`   ⚠ Generated only ${entries.length} URLs vs existing ${existingUrlCount}. Preserving existing sitemap.`);
    return;
  }

  // 8. Assemble XML
  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...entries,
    '</urlset>',
    '',
  ].join('\n');

  // 9. Write to public/sitemap.xml
  writeFileSync(OUTPUT_PATH, xml, 'utf-8');

  console.log(`   ✅ sitemap.xml written to ${OUTPUT_PATH}`);
  console.log(`   📊 ${uniqueTools.length} tool pages, ${categorySet.size} category pages, ${GOAL_SLUGS.length} goal pages`);
  console.log(`   📄 Total URLs: ${entries.length}`);
}

main().catch((err) => {
  console.error('Sitemap generation failed:', err);
  // Don't exit with error code — preserve existing sitemap on failure
  console.warn('   ⚠ Sitemap generation failed but build will continue with existing sitemap.');
});