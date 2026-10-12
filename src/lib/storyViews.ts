// Story viewer tracking & persistence module.
// Stores and provides viewer lists, view counts, and reactions per story segment.

export type StoryViewerUser = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  viewed_at: string;
  reaction?: string | null;
};

export type StoryViewsData = {
  totalCount: number;
  viewers: StoryViewerUser[];
  reactions: Record<string, number>;
};

const STORAGE_KEY_PREFIX = "flick:story_views:";

// Seed viewers for initial stories to make the feed lively immediately
const SEED_PROFILES = [
  {
    id: "u-1",
    handle: "sarah_k",
    display_name: "Sarah Kim",
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
    reaction: "🔥",
  },
  {
    id: "u-2",
    handle: "marcus_dev",
    display_name: "Marcus Vance",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
    reaction: "❤️",
  },
  {
    id: "u-3",
    handle: "elena_sound",
    display_name: "Elena Rostova",
    avatar_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face",
    reaction: "👏",
  },
  {
    id: "u-4",
    handle: "kai_vision",
    display_name: "Kai Tanaka",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face",
    reaction: "⚡️",
  },
  {
    id: "u-5",
    handle: "maya_lens",
    display_name: "Maya Chen",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face",
    reaction: "😍",
  },
  {
    id: "u-6",
    handle: "lucas_beats",
    display_name: "Lucas Scott",
    avatar_url: "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200&h=200&fit=crop&crop=face",
    reaction: null,
  },
  {
    id: "u-7",
    handle: "zara_design",
    display_name: "Zara Al-Mansoor",
    avatar_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face",
    reaction: "🔥",
  },
  {
    id: "u-8",
    handle: "noah_pixel",
    display_name: "Noah Brooks",
    avatar_url: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=200&h=200&fit=crop&crop=face",
    reaction: null,
  },
];

function generateSeedViews(storyId: string): StoryViewsData {
  // Deterministic seed based on storyId
  const hash = storyId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const subsetCount = 4 + (hash % 5); // 4 to 8 viewers
  const shuffled = [...SEED_PROFILES].sort((a, b) => ((a.id.charCodeAt(2) + hash) % 5) - ((b.id.charCodeAt(2) + hash) % 5));
  const selected = shuffled.slice(0, subsetCount);

  const viewers: StoryViewerUser[] = selected.map((p, idx) => ({
    id: p.id,
    handle: p.handle,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    viewed_at: new Date(Date.now() - (idx + 1) * 1000 * 60 * (15 + (hash % 10))).toISOString(),
    reaction: p.reaction,
  }));

  const reactions: Record<string, number> = {};
  viewers.forEach((v) => {
    if (v.reaction) {
      reactions[v.reaction] = (reactions[v.reaction] || 0) + 1;
    }
  });

  return {
    totalCount: viewers.length,
    viewers,
    reactions,
  };
}

export function getStoryViews(storyId: string): StoryViewsData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PREFIX + storyId);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}

  const initial = generateSeedViews(storyId);
  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + storyId, JSON.stringify(initial));
  } catch {}
  return initial;
}

export function recordStoryView(
  storyId: string,
  user: { id: string; handle: string; display_name: string; avatar_url: string | null }
): StoryViewsData {
  const current = getStoryViews(storyId);

  // Check if this user already viewed
  const existingIdx = current.viewers.findIndex((v) => v.id === user.id);
  if (existingIdx !== -1) {
    return current;
  }

  const newViewer: StoryViewerUser = {
    id: user.id,
    handle: user.handle,
    display_name: user.display_name,
    avatar_url: user.avatar_url,
    viewed_at: new Date().toISOString(),
    reaction: null,
  };

  const updated: StoryViewsData = {
    totalCount: current.totalCount + 1,
    viewers: [newViewer, ...current.viewers],
    reactions: { ...current.reactions },
  };

  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + storyId, JSON.stringify(updated));
  } catch {}

  window.dispatchEvent(new CustomEvent("flick:story-views-updated", { detail: { storyId, data: updated } }));
  return updated;
}

export function addStoryReaction(
  storyId: string,
  user: { id: string; handle: string; display_name: string; avatar_url: string | null },
  emoji: string
): StoryViewsData {
  const current = getStoryViews(storyId);

  let updatedViewers = [...current.viewers];
  const existingIdx = updatedViewers.findIndex((v) => v.id === user.id);

  if (existingIdx !== -1) {
    const oldReaction = updatedViewers[existingIdx].reaction;
    updatedViewers[existingIdx] = {
      ...updatedViewers[existingIdx],
      reaction: emoji,
    };
  } else {
    updatedViewers.unshift({
      id: user.id,
      handle: user.handle,
      display_name: user.display_name,
      avatar_url: user.avatar_url,
      viewed_at: new Date().toISOString(),
      reaction: emoji,
    });
  }

  const reactions: Record<string, number> = {};
  updatedViewers.forEach((v) => {
    if (v.reaction) {
      reactions[v.reaction] = (reactions[v.reaction] || 0) + 1;
    }
  });

  const updated: StoryViewsData = {
    totalCount: updatedViewers.length,
    viewers: updatedViewers,
    reactions,
  };

  try {
    localStorage.setItem(STORAGE_KEY_PREFIX + storyId, JSON.stringify(updated));
  } catch {}

  window.dispatchEvent(new CustomEvent("flick:story-views-updated", { detail: { storyId, data: updated } }));
  return updated;
}

export function listenStoryViews(storyId: string, cb: (data: StoryViewsData) => void): () => void {
  const handler = (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail && detail.storyId === storyId) {
      cb(detail.data);
    }
  };
  window.addEventListener("flick:story-views-updated", handler);
  return () => window.removeEventListener("flick:story-views-updated", handler);
}
