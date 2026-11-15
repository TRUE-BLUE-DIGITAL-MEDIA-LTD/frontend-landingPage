/**
 * The multi-step form runtime is a static script with no access to page
 * props, so the server stamps what it needs onto the form root at render
 * time: the landing page id, the page's main link (redirect fallback when
 * the form has no link of its own), and — for saving the lead — the origin
 * of the central lander API plus the visitor's country code (the API cannot
 * see Netlify's geo header).
 */
export function stampMultipleFormMeta(
  document: Document,
  meta: {
    landingPageId: string;
    fallbackLink: string;
    apiOrigin?: string;
    countryCode?: string;
  },
): void {
  const roots = document.querySelectorAll(".oxy-multiple-form");
  roots.forEach((root) => {
    root.setAttribute("data-oxy-lp-id", meta.landingPageId);
    root.setAttribute("data-oxy-fallback-link", meta.fallbackLink);
    if (meta.apiOrigin) root.setAttribute("data-oxy-api", meta.apiOrigin);
    if (meta.countryCode) {
      root.setAttribute("data-oxy-country", meta.countryCode);
    }
  });
}
