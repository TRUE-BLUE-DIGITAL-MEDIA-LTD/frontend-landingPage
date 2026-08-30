// The editor exports a lander's CTA button as an anchor pointing at the
// page itself (<a href=""> resolves to the current URL). Such an anchor's
// real destination is the page's main link. The rewrite must land in the
// DOM attribute, not just the returned value: native navigation paths —
// target="_blank" anchors (which the click hijack leaves native) and
// middle/ctrl clicks — read the attribute, never the click handler's
// local variable.
export function resolveSelfAnchorToMainLink(
  anchor: HTMLAnchorElement,
  currentHref: string,
  mainLink: string | null | undefined,
): string {
  const href = anchor.href;
  if (!mainLink) return href;
  // A bare "#" is a self-pointing CTA too; "#section" stays an in-page link.
  const isBareHash = (anchor.getAttribute("href") ?? "").trim() === "#";
  if (href !== currentHref && !isBareHash) return href;
  anchor.setAttribute("href", mainLink);
  return mainLink;
}
