// Quality gate: enforces SCA prevention thresholds.
//
// Thresholds (from config.safety):
//   < warnAt:                 free pass
//   warnAt..hardStopAt:       requires --acknowledge-scale
//   >= hardStopAt:            requires --i-have-audited AND --audit-report=path

import { existsSync } from "node:fs";

export function runQualityGate(postCount, safetyConfig, flags) {
  const { warnAt, hardStopAt } = safetyConfig;
  const { acknowledgeScale, iHaveAudited, auditReport } = flags;

  if (postCount >= hardStopAt) {
    if (!iHaveAudited) {
      throw new Error(blockMessage(
        `Refusing to process ${postCount} posts (>= hardStopAt=${hardStopAt}).`,
        "This is the scaled content abuse (SCA) threshold. Mass-producing AI content " +
          "without per-page editorial review will likely get your site de-indexed by Google. " +
          "Pass --i-have-audited and --audit-report=path/to/audit.md if you have actually " +
          "performed an editorial audit. See references/safety-and-quality-gates.md.",
      ));
    }
    if (!auditReport) {
      throw new Error(blockMessage(
        "--i-have-audited requires --audit-report=path/to/audit.md.",
        "The audit report should describe: which posts were sampled, who reviewed them, " +
          "what quality criteria were applied, and what changes were made.",
      ));
    }
    if (!existsSync(auditReport)) {
      throw new Error(blockMessage(
        `Audit report not found: ${auditReport}.`,
        "Create the audit report first.",
      ));
    }
    console.warn(
      `\n⚠ Quality gate: ${postCount} posts >= hardStopAt=${hardStopAt}.\n` +
      `   Override accepted (--i-have-audited, --audit-report=${auditReport}).\n`,
    );
    return;
  }

  if (postCount >= warnAt) {
    if (!acknowledgeScale) {
      throw new Error(blockMessage(
        `Refusing to process ${postCount} posts (>= warnAt=${warnAt}).`,
        "Pass --acknowledge-scale to confirm you understand: each post should have unique " +
          "value and human review. Without genuine editorial care, you risk a Google " +
          "scaled content abuse penalty. See references/safety-and-quality-gates.md.",
      ));
    }
    console.warn(
      `\n⚠ Quality gate: ${postCount} posts >= warnAt=${warnAt}, override accepted.\n`,
    );
    return;
  }

  // Below warn threshold: free pass
}

function blockMessage(headline, detail) {
  return `\n\n━━━ QUALITY GATE BLOCKED ━━━\n${headline}\n\n${detail}\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
}
