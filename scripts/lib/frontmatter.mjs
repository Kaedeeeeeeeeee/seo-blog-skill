// Thin gray-matter wrapper. Centralizes frontmatter parsing/serialization
// so we can swap implementations or add validation in one place.

import matter from "gray-matter";

export function parse(raw) {
  const parsed = matter(raw);
  return { data: parsed.data ?? {}, content: parsed.content ?? "" };
}

export function stringify(data, content) {
  return matter.stringify(content, data);
}

/** Validate a frontmatter object against the configured schema.
 *  Returns { ok, errors: string[] }. */
export function validate(data, schema) {
  const errors = [];
  for (const field of schema.required ?? []) {
    if (data[field] === undefined || data[field] === null || data[field] === "") {
      errors.push(`required field missing: ${field}`);
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Strip fields configured to be removed at publish time (e.g. status: draft). */
export function stripPublish(data, schema) {
  const out = { ...data };
  for (const field of schema.stripOnPublish ?? []) {
    delete out[field];
  }
  return out;
}
