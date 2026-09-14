// Shared news wire used by the News page and the in-app news popup.
export type NewsItem = {
  id: string;
  title: string;
  url: string;
  source: string;
  image: string | null;
  ts: number;
  summary: string;
};

export const NEWS_TABS = ["For You", "Top", "Tech", "World"] as const;
export type NewsTab = (typeof NEWS_TABS)[number];

export async function fetchHN(): Promise<NewsItem[]> {
  const res = await fetch("https://hn.algolia.com/api/v1/search?tags=front_page");
  const j = await res.json();
  return (j.hits ?? []).map(
    (h: { objectID: string; title: string; url: string | null; created_at_i: number; story_text?: string }) => ({
      id: `hn-${h.objectID}`,
      title: h.title,
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      source: "Hacker News",
      image: null,
      ts: h.created_at_i * 1000,
      summary: h.story_text ?? "",
    }),
  );
}

export async function fetchSpaceflight(): Promise<NewsItem[]> {
  const res = await fetch("https://api.spaceflightnewsapi.net/v4/articles/?limit=20");
  const j = await res.json();
  return (j.results ?? []).map(
    (a: { id: number; title: string; url: string; news_site: string; image_url: string; published_at: string; summary: string }) => ({
      id: `sf-${a.id}`,
      title: a.title,
      url: a.url,
      source: a.news_site,
      image: a.image_url,
      ts: +new Date(a.published_at),
      summary: a.summary,
    }),
  );
}

export async function fetchReddit(sub: string): Promise<NewsItem[]> {
  const res = await fetch(`https://www.reddit.com/r/${sub}/hot.json?limit=20`);
  const j = await res.json();
  return (j?.data?.children ?? []).map(
    (c: { data: { id: string; title: string; url: string; subreddit_name_prefixed: string; thumbnail: string; created_utc: number; selftext: string; preview?: { images: { source: { url: string } }[] } } }) => {
      const d = c.data;
      const img =
        d.preview?.images?.[0]?.source?.url?.replace(/&amp;/g, "&") ||
        (d.thumbnail?.startsWith("http") ? d.thumbnail : null);
      return {
        id: `rd-${d.id}`,
        title: d.title,
        url: d.url,
        source: d.subreddit_name_prefixed,
        image: img,
        ts: d.created_utc * 1000,
        summary: d.selftext ?? "",
      };
    },
  );
}

export async function fetchNews(tab: NewsTab = "For You"): Promise<NewsItem[]> {
  const loaders: Promise<NewsItem[]>[] =
    tab === "Top"
      ? [fetchHN()]
      : tab === "Tech"
        ? [fetchHN(), fetchReddit("technology")]
        : tab === "World"
          ? [fetchReddit("worldnews")]
          : [fetchHN(), fetchSpaceflight(), fetchReddit("worldnews")];
  const groups = await Promise.all(loaders.map((p) => p.catch(() => [] as NewsItem[])));
  return groups.flat().sort((a, b) => b.ts - a.ts);
}

export function readerPath(it: NewsItem) {
  return `/news/read?u=${encodeURIComponent(it.url)}&t=${encodeURIComponent(it.title)}&s=${encodeURIComponent(it.source)}`;
}
