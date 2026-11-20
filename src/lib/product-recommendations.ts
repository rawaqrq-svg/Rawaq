type Category = { id: string; parentId: string | null; slug: string };
type Candidate = { id: string; categoryId: string; brandId: string | null; isBestSeller: boolean; isTrending: boolean; isNew: boolean };

const complementary: Record<string, string[]> = {
  makeup: ['skincare', 'face-care', 'accessories', 'gifts-sets'],
  skincare: ['makeup', 'face-care', 'gifts-sets'],
  'face-care': ['makeup', 'skincare', 'gifts-sets'],
  'body-care': ['perfumes-fragrances', 'musk-perfume', 'gifts-sets'],
  'perfumes-fragrances': ['body-care', 'gifts-sets', 'accessories'],
  'musk-perfume': ['body-care', 'perfumes-fragrances', 'gifts-sets'],
  'fashion-abayas': ['accessories', 'perfumes-fragrances', 'gifts-sets'],
  accessories: ['fashion-abayas', 'makeup', 'gifts-sets'],
  'gifts-sets': ['perfumes-fragrances', 'makeup', 'skincare'],
};

/** Choose a changing, category-aware mix while keeping results stable for one product. */
export function pickRecommendedProducts<T extends Candidate>(product: Candidate, candidates: T[], categories: Category[], limit = 8): T[] {
  const byId = new Map(categories.map(category => [category.id, category]));
  const ancestry = (id: string) => {
    const ids: string[] = [];
    for (let current = byId.get(id); current && ids.length < 5; current = current.parentId ? byId.get(current.parentId) : undefined) ids.push(current.id);
    return ids;
  };
  const ownTrail = ancestry(product.categoryId);
  const ownRoot = byId.get(ownTrail.at(-1) || '')?.slug || '';
  const complementSlugs = new Set(complementary[ownRoot] || []);
  const categoryRoot = (id: string) => byId.get(ancestry(id).at(-1) || '')?.slug || '';
  const seed = [...product.id].reduce((n, char) => n * 31 + char.charCodeAt(0), 0) >>> 0;
  const scored = candidates.filter(candidate => candidate.id !== product.id).map((candidate, index) => {
    const trail = ancestry(candidate.categoryId);
    const root = categoryRoot(candidate.categoryId);
    let score = candidate.categoryId === product.categoryId ? 100 : trail.some(id => ownTrail.includes(id)) ? 70 : complementSlugs.has(root) ? 55 : 10;
    if (candidate.brandId && candidate.brandId === product.brandId) score += 7;
    if (candidate.isBestSeller) score += 5;
    if (candidate.isTrending) score += 3;
    if (candidate.isNew) score += 2;
    return { candidate, score, tie: (seed ^ ((index + 1) * 2654435761)) >>> 0, root };
  }).sort((a, b) => b.score - a.score || a.tie - b.tie);
  const chosen: T[] = [];
  const used = new Set<string>();
  const rootCounts = new Map<string, number>();
  while (chosen.length < limit && chosen.length < scored.length) {
    const next = scored.find(item => !used.has(item.candidate.id) && (rootCounts.get(item.root) || 0) < 3)
      || scored.find(item => !used.has(item.candidate.id));
    if (!next) break;
    chosen.push(next.candidate);
    used.add(next.candidate.id);
    rootCounts.set(next.root, (rootCounts.get(next.root) || 0) + 1);
  }
  return chosen;
}
