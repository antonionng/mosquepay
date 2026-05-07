/**
 * Many clients ignore or strip <button>. Coerce to table-wrapped <a> CTAs when possible.
 */

function escapeHtmlText(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHref(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function stripTagsToText(html: string) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const CTA_BG = "#111827";
const CTA_FG = "#ffffff";

function tableCta(href: string, label: string) {
  const h = escapeHref(href);
  const t = escapeHtmlText(label);
  return `
<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:12px 0;">
  <tr>
    <td align="left" bgcolor="${CTA_BG}" style="border-radius:999px;">
      <a href="${h}" style="display:inline-block;border-radius:999px;background:${CTA_BG};color:${CTA_FG};font-size:15px;font-weight:700;line-height:1.25;padding:15px 22px;text-decoration:none;mso-line-height-rule:exactly;-webkit-text-size-adjust:100%;">
        ${t}
      </a>
    </td>
  </tr>
</table>`;
}

/**
 * Replaces <button>…</button> with email-safe markup. Uses formaction, data-href, data-url,
 * or the first nested <a href>.
 */
export function coerceButtonsInEmailHtml(html: string): string {
  return html.replace(
    /<button\b([^>]*)>([\s\S]*?)<\/button>/gi,
    (_full, attrs: string, inner: string) => {
      const hrefFromAttrs =
        /formaction\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ??
        /data-href\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1] ??
        /data-url\s*=\s*["']([^"']+)["']/i.exec(attrs)?.[1];
      const nestedA = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(
        inner
      );
      const href = hrefFromAttrs ?? nestedA?.[1];
      const labelSource = nestedA ? nestedA[2] : inner;
      const label = stripTagsToText(labelSource) || "Open link";

      if (!href) {
        return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:12px 0;"><tr><td style="border-radius:999px;background:#e2e8f0;color:#64748b;font-size:15px;font-weight:700;line-height:1.25;padding:15px 22px;">${escapeHtmlText(label)}</td></tr></table>`;
      }
      return tableCta(href, label);
    }
  );
}
