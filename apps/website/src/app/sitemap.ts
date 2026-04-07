import { MetadataRoute } from 'next';
import { getTreeList } from '@/lib/api';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.ai花木.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const treesRes = await getTreeList({ limit: 100 }).catch(() => null);
  const trees = treesRes?.data || [];

  const treePages = trees.map((tree) => ({
    url: `${SITE_URL}/trees/${tree.treeId}`,
    lastModified: tree.updatedAt || new Date().toISOString(),
    changeFrequency: 'weekly' as const,
    priority: 0.8,
  }));

  return [
    { url: SITE_URL, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${SITE_URL}/trees`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/styles`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${SITE_URL}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    ...treePages,
  ];
}
