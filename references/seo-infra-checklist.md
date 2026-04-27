# SEO Infrastructure Checklist

This skill produces blog post **content**. The host site is responsible for making that content discoverable. Use this checklist to ensure your site has the SEO infra to support 100+ posts.

## Required (or you're wasting your effort)

### Sitemap

Your `sitemap.xml` must:
- List every blog post URL
- Update automatically when posts are added (CMS / static-site generator should do this)
- Include `<lastmod>` timestamps
- Be referenced in `robots.txt`: `Sitemap: https://yoursite.com/sitemap.xml`

### Article schema (JSON-LD)

Each blog post page should embed `schema.org/Article` JSON-LD:

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "...",
  "description": "...",
  "datePublished": "2026-04-27",
  "dateModified": "2026-04-27",
  "author": { "@type": "Organization", "name": "..." },
  "publisher": { "@type": "Organization", "name": "...", "url": "..." },
  "mainEntityOfPage": { "@type": "WebPage", "@id": "https://..." },
  "inLanguage": "ja"
}
</script>
```

### Open Graph + Twitter cards

Each post should set:
- `<meta property="og:title">`, `og:description`, `og:type=article`, `og:url`, `og:image`
- `<meta name="twitter:card" content="summary_large_image">`, `twitter:title`, `twitter:description`, `twitter:image`

For static sites, frameworks like Next.js, Astro, Gatsby auto-generate these from frontmatter.

### Canonical URL

`<link rel="canonical" href="https://yoursite.com/blog/slug">` — prevents duplicate-content issues if your site is multi-locale or has tracking-parameter variants.

## Highly recommended

### Multi-locale (if applicable)

`<link rel="alternate" hreflang="ja" href="...">` for each locale variant of a page, plus `hreflang="x-default"`.

### BreadcrumbList schema

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://..." },
    { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://.../blog" },
    { "@type": "ListItem", "position": 3, "name": "Post Title", "item": "https://.../blog/slug" }
  ]
}
</script>
```

Helps Google understand site hierarchy.

### Dynamic OG images

A unique og:image per post (not the same site banner everywhere) significantly improves social CTR. Next.js's `opengraph-image.tsx` file convention auto-generates these.

### Internal linking

The skill helps weave internal links via the `internal_links` CSV column, but the host site should:
- Auto-render related-post sections at end of each post
- Have category/tag landing pages
- Display breadcrumbs in UI

### robots.txt

Allow crawling of public content; block private/auth-gated routes:

```
User-agent: *
Allow: /
Disallow: /api/
Disallow: /account/
Disallow: /draft/
Sitemap: https://yoursite.com/sitemap.xml
```

## Optional but valuable

### FAQ schema (per-post)

For posts with a "Frequently Asked Questions" section, embed `schema.org/FAQPage`. Increases SERP feature eligibility (rich snippets).

### Course / Quiz schema (for educational sites)

If your site teaches structured curriculum, mark up Course or Quiz schemas.

### Authorship signals (E-E-A-T)

Add author bios, credentials, and publishing org information. For Google's E-E-A-T algorithm, these matter especially in YMYL (Your Money or Your Life) domains.

## Verification tools

After deploying, verify with:
- [Google Rich Results Test](https://search.google.com/test/rich-results) — checks JSON-LD
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/) — checks OG
- [Schema Markup Validator](https://validator.schema.org/) — independent schema check
- [PageSpeed Insights](https://pagespeed.web.dev/) — Core Web Vitals (separate concern but related to SEO)

## What this skill does NOT do

- Generate sitemap.xml (host framework's job)
- Generate Article schema (host framework's job)
- Implement breadcrumbs (host UI's job)
- Submit to Google Search Console (manual; one-time setup per domain)

The skill produces clean MDX/Markdown with valid frontmatter; the host site uses that to render pages with proper SEO infra.

## Reference: our IT パスポート example site

The example project (it-passport-steel.vercel.app) implements all of the above using Next.js 16 App Router. See `examples/it-passport-syllabus/` for the corresponding seo-blog config and the blog post output it produces.
