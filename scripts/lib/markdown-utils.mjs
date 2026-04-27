// Markdown structural helpers: H2 detection, bullet finding, internal-link
// extraction. Pure functions, no I/O.

const H2_RE = /^##\s+(.+?)\s*$/gm;
const H3_RE = /^###\s+(.+?)\s*$/gm;
const BULLET_RE = /^- (.+)$/gm;
const INTERNAL_LINK_RE = /\[([^\]]+)\]\(([^)]+)\)/g;

/** Extract all H2 headings from a markdown body. Returns string[]. */
export function extractH2(body) {
  return [...body.matchAll(H2_RE)].map((m) => m[1].trim());
}

/** Extract all H3 headings from a markdown body. Returns string[]. */
export function extractH3(body) {
  return [...body.matchAll(H3_RE)].map((m) => m[1].trim());
}

/** Count bullet lines (top-level `-` lists). */
export function countBullets(body) {
  return [...body.matchAll(BULLET_RE)].length;
}

/** Extract all internal link targets (paths starting with `/`). */
export function extractInternalLinks(body) {
  const links = [];
  for (const match of body.matchAll(INTERNAL_LINK_RE)) {
    const [, text, href] = match;
    if (href.startsWith("/")) {
      links.push({ text, href });
    }
  }
  return links;
}

/** Approximate Japanese character count (CJK chars + non-CJK words). */
export function countContentChars(body) {
  // strip code fences and tables to count just prose
  const stripped = body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^\|.*\|$/gm, "")
    .replace(/^[#\-*>].*$/gm, "");
  return stripped.replace(/\s+/g, "").length;
}

/** Replace placeholders {{key}} in template with values from data object.
 *  Missing keys remain as {{key}} for later resolution. */
export function fillPlaceholders(template, data) {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return data[key] !== undefined ? String(data[key]) : match;
  });
}
