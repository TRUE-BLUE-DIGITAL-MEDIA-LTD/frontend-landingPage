export interface LanderCandidate {
  id: string;
  percent: number;
  route: string | null;
  supportedLanguages: string[] | null;
  language: string;
}

/**
 * Weighted A/B selection over lander metadata only — the caller fetches the
 * heavy fields (html, translations, ...) for the winner afterwards.
 *
 * Filtering semantics match the historical in-service logic exactly:
 * route match (or route-less pool), percent > 0, then language narrowing
 * that keeps the full pool when nothing matches the visitor's language.
 */
export function pickLander<T extends LanderCandidate>(
  landers: T[],
  opts: { route?: string; language: string },
  random: () => number = Math.random,
): T | undefined {
  let pool = opts.route
    ? landers.filter((l) => l.route === opts.route)
    : landers.filter((l) => !l.route);

  pool = pool.filter((l) => l.percent > 0);

  const languageMatched = pool.filter((l) => {
    const supported = l.supportedLanguages ?? [];
    if (supported.length > 0) return supported.includes(opts.language);
    // Pre-migration row with no supportedLanguages: keep the legacy match.
    return l.language === opts.language;
  });
  if (languageMatched.length !== 0) {
    pool = languageMatched;
  }

  if (pool.length === 0) return undefined;
  const totalRate = pool.reduce((sum, l) => sum + l.percent, 0);
  if (totalRate <= 0) return undefined;

  const randomNum = random();
  let coef = 0;
  for (const lander of pool) {
    coef += lander.percent / totalRate;
    if (randomNum < coef) return lander;
  }
  // Float rounding can leave the last cumulative coef fractionally below 1.
  return pool[pool.length - 1];
}
