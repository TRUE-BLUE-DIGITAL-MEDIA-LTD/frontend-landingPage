import type { Translations, Language } from '../../interfaces';

const TEXT_NODE = 3;

/**
 * Replace only the element's OWN text (its direct text-node children), never
 * its child elements. A key's string is the element's own text — see the
 * backend `keyTranslatableText` — so `<p>Get <span style="color:orange">50%
 * off</span> today</p>` keys the p ("Get  today") and the span separately.
 * Assigning `textContent` on the p would destroy the styled span.
 *
 * The translation goes into the first non-blank text node (keeping its
 * surrounding whitespace); other non-blank own text nodes collapse to a single
 * space so inline spacing around child elements survives.
 */
export function replaceOwnText(el: Element, text: string): void {
  const textNodes = Array.from(el.childNodes).filter(
    (n) => n.nodeType === TEXT_NODE,
  ) as Text[];

  const current = textNodes.map((n) => n.data).join('').trim();
  if (current === text.trim()) return; // already showing this text

  const filled = textNodes.filter((n) => n.data.trim().length > 0);
  if (filled.length === 0) {
    // No own text left to replace. Only safe to write when there are no
    // child elements to destroy.
    if (el.children.length === 0) el.textContent = text;
    return;
  }

  filled.forEach((node, i) => {
    if (i === 0) {
      const lead = node.data.match(/^\s*/)?.[0] ?? '';
      const trail = node.data.match(/\s*$/)?.[0] ?? '';
      node.data = lead + text.trim() + trail;
    } else {
      node.data = /\s/.test(node.data) ? ' ' : '';
    }
  });
}

/**
 * Walk the document, replacing the own text of every [data-i18n] element
 * with the corresponding string from translations[lang], falling back to
 * translations[primary], then to the original text. Child elements, styles
 * and attributes are preserved. <script> and <style> elements are never
 * touched.
 */
export function applyI18nSubstitution(
  doc: Document,
  translations: Translations | null | undefined,
  lang: Language,
  primary: Language,
): void {
  if (!translations) return;

  const nodes = doc.querySelectorAll('[data-i18n]');
  nodes.forEach((node) => {
    const tag = node.tagName.toLowerCase();
    if (tag === 'script' || tag === 'style') return;

    const key = node.getAttribute('data-i18n');
    if (!key) return;

    const targetText = translations[lang]?.strings?.[key];
    if (typeof targetText === 'string' && targetText.length > 0) {
      replaceOwnText(node, targetText);
      return;
    }

    const primaryText = translations[primary]?.strings?.[key];
    if (typeof primaryText === 'string' && primaryText.length > 0) {
      replaceOwnText(node, primaryText);
    }
  });
}
