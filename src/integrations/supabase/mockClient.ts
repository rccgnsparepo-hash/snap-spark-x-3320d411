// In-memory + localStorage mock client for Supabase in offline/preview mode.
// Enables Flick to boot and operate smoothly when Supabase environment variables are unset.

const LS_PREFIX = "flick:mock_db:";

function getStorage<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    if (raw) return JSON.parse(raw);
  } catch {}
  return defaultVal;
}

function setStorage<T>(key: string, val: T): void {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(val));
  } catch {}
}

const DEFAULT_PROFILES = [
  {
    id: "u-current",
    handle: "flicker_demo",
    display_name: "Alex Rivera",
    avatar_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop&crop=face",
    bio: "Visual storyteller & digital creator ⚡️ Building the future of real-time feeds.",
    created_at: new Date(Date.now() - 86400000 * 30).toISOString(),
  },
  {
    id: "u-1",
    handle: "sarah_k",
    display_name: "Sarah Kim",
    avatar_url: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&h=200&fit=crop&crop=face",
    bio: "Designing the future 🎨 UI/UX & street photography.",
    created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
  {
    id: "u-2",
    handle: "marcus_dev",
    display_name: "Marcus Vance",
    avatar_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
    bio: "Building fast web apps 🚀 Coffee, code, and creative computing.",
    created_at: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
  {
    id: "u-3",
    handle: "elena_sound",
    display_name: "Elena Rostova",
    avatar_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&h=200&fit=crop&crop=face",
    bio: "Indie beats & ambient vibes 🎧 Night owls unite.",
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: "u-4",
    handle: "kai_vision",
    display_name: "Kai Tanaka",
    avatar_url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face",
    bio: "Cyberpunk aesthetics, neon streets, and anime sketching.",
    created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
];

const DEFAULT_POSTS = [
  {
    id: "post-1",
    author_id: "u-1",
    content: "Golden hour over the skyline today ✨ The lighting was unbelievable!",
    image_url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&fit=crop",
    media_url: "https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=800&fit=crop",
    media_type: "image",
    created_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
  {
    id: "post-2",
    author_id: "u-2",
    content: "Just shipped instant audio notes and fluid gesture replies on Flick! What feature should we build next? 🚀",
    image_url: null,
    media_url: null,
    media_type: "text",
    created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: "post-3",
    author_id: "u-3",
    content: "Weekend escape to the misty pines 🌲 Listening to low-fi acoustic tracks on repeat.",
    image_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&fit=crop",
    media_url: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&fit=crop",
    media_type: "image",
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: "post-4",
    author_id: "u-4",
    content: "Midnight coffee and concept art for the upcoming comic series ☕️ Keep experimenting!",
    image_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&fit=crop",
    media_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&fit=crop",
    media_type: "image",
    created_at: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
];

const DEFAULT_STORIES = [
  {
    id: "story-1",
    author_id: "u-1",
    image_url: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&fit=crop",
    media_type: "image",
    caption: "Sunset stroll through the arts district 🌅",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 22).toISOString(),
  },
  {
    id: "story-2",
    author_id: "u-2",
    image_url: "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&fit=crop",
    media_type: "image",
    caption: "Deep into terminal sessions and build pipelines 💻",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString(),
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 20).toISOString(),
  },
  {
    id: "story-3",
    author_id: "u-3",
    image_url: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800&fit=crop",
    media_type: "image",
    caption: "Recording session in the studio tonight 🎙️",
    created_at: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString(),
    expires_at: new Date(Date.now() + 1000 * 60 * 60 * 18).toISOString(),
  },
];

const DEFAULT_CHALLENGES = [
  {
    id: "c-1",
    title: "Monochrome Magic",
    prompt: "Post a high-contrast black and white flick capturing raw architecture or street life.",
    for_date: new Date().toISOString().slice(0, 10),
  },
  {
    id: "c-2",
    title: "Golden Hour Glow",
    prompt: "Capture natural sunlight hitting an unexpected object right before dusk.",
    for_date: new Date(Date.now() - 86400000).toISOString().slice(0, 10),
  },
  {
    id: "c-3",
    title: "Speed Sketch",
    prompt: "Post a 60-second doodle or voice note about your dream travel destination.",
    for_date: new Date(Date.now() - 86400000 * 2).toISOString().slice(0, 10),
  },
];

const DEFAULT_LIKES = [
  { user_id: "u-current", post_id: "post-1", created_at: new Date().toISOString() },
  { user_id: "u-2", post_id: "post-1", created_at: new Date().toISOString() },
  { user_id: "u-3", post_id: "post-1", created_at: new Date().toISOString() },
  { user_id: "u-1", post_id: "post-2", created_at: new Date().toISOString() },
  { user_id: "u-3", post_id: "post-2", created_at: new Date().toISOString() },
  { user_id: "u-current", post_id: "post-3", created_at: new Date().toISOString() },
];

const DEFAULT_MESSAGES = [
  {
    id: "m-1",
    sender_id: "u-1",
    recipient_id: "u-current",
    content: "Hey Alex! Loved your latest photo set from yesterday ✨",
    media_url: null,
    media_type: null,
    created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    expires_at: null,
    read_at: null,
    reply_to_id: null,
    reply_snippet: null,
  },
  {
    id: "m-2",
    sender_id: "u-2",
    recipient_id: "u-current",
    content: "Are you coming to the creator meetup this Friday?",
    media_url: null,
    media_type: null,
    created_at: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
    expires_at: null,
    read_at: null,
    reply_to_id: null,
    reply_snippet: null,
  },
];

export function createMockSupabaseClient() {
  console.info("[AI Studio] Supabase client: using responsive in-memory mock store.");

  // Initialize store tables
  if (!localStorage.getItem(LS_PREFIX + "profiles")) setStorage("profiles", DEFAULT_PROFILES);
  if (!localStorage.getItem(LS_PREFIX + "posts")) setStorage("posts", DEFAULT_POSTS);
  if (!localStorage.getItem(LS_PREFIX + "stories")) setStorage("stories", DEFAULT_STORIES);
  if (!localStorage.getItem(LS_PREFIX + "daily_challenges")) setStorage("daily_challenges", DEFAULT_CHALLENGES);
  if (!localStorage.getItem(LS_PREFIX + "likes")) setStorage("likes", DEFAULT_LIKES);
  if (!localStorage.getItem(LS_PREFIX + "messages")) setStorage("messages", DEFAULT_MESSAGES);
  if (!localStorage.getItem(LS_PREFIX + "notifications")) setStorage("notifications", []);
  if (!localStorage.getItem(LS_PREFIX + "chat_settings")) setStorage("chat_settings", []);

  // Auth state
  const authListeners = new Set<(event: string, session: any) => void>();

  const getSavedUser = () => {
    const raw = localStorage.getItem("flick:mock_user");
    if (raw) {
      try { return JSON.parse(raw); } catch {}
    }
    // Default active user is the demo profile
    return {
      id: "u-current",
      email: "alex@flick.app",
      user_metadata: { handle: "flicker_demo", display_name: "Alex Rivera" },
    };
  };

  let currentUser: any = getSavedUser();
  let currentSession: any = currentUser
    ? {
        access_token: "mock-token",
        token_type: "bearer",
        user: currentUser,
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
      }
    : null;

  const notifyAuth = (event: string) => {
    authListeners.forEach((fn) => {
      try { fn(event, currentSession); } catch (e) { console.error(e); }
    });
  };

  const getTable = (name: string): any[] => getStorage(name, []);
  const saveTable = (name: string, data: any[]) => setStorage(name, data);

  const resolveAuthor = (authorId: string) => {
    const profiles = getTable("profiles");
    const p = profiles.find((x) => x.id === authorId);
    return p ? { id: p.id, handle: p.handle, display_name: p.display_name, avatar_url: p.avatar_url } : null;
  };

  const createQueryBuilder = (table: string) => {
    let filters: Array<(row: any) => boolean> = [];
    let sortFn: ((a: any, b: any) => number) | null = null;
    let limitCount: number | null = null;
    let isSingle = false;
    let isMaybeSingle = false;

    const builder: any = {
      select: (_cols?: string) => builder,
      eq: (col: string, val: any) => {
        filters.push((r) => r[col] === val);
        return builder;
      },
      neq: (col: string, val: any) => {
        filters.push((r) => r[col] !== val);
        return builder;
      },
      is: (col: string, val: any) => {
        filters.push((r) => (val === null ? r[col] == null : r[col] === val));
        return builder;
      },
      in: (col: string, arr: any[]) => {
        filters.push((r) => arr.includes(r[col]));
        return builder;
      },
      or: (conditionStr: string) => {
        // Simple fallback parser for common Supabase .or() clauses
        if (conditionStr.includes("handle.ilike") || conditionStr.includes("display_name.ilike")) {
          const match = conditionStr.match(/%([^%]+)%/);
          const q = match ? match[1].toLowerCase() : "";
          if (q) {
            filters.push((r) =>
              (r.handle?.toLowerCase() || "").includes(q) ||
              (r.display_name?.toLowerCase() || "").includes(q)
            );
          }
        }
        return builder;
      },
      order: (col: string, opts?: { ascending?: boolean }) => {
        const asc = opts?.ascending ?? true;
        sortFn = (a, b) => {
          const valA = a[col];
          const valB = b[col];
          if (valA === valB) return 0;
          if (valA > valB) return asc ? 1 : -1;
          return asc ? -1 : 1;
        };
        return builder;
      },
      limit: (n: number) => {
        limitCount = n;
        return builder;
      },
      single: () => {
        isSingle = true;
        return builder;
      },
      maybeSingle: () => {
        isMaybeSingle = true;
        return builder;
      },
      insert: async (records: any | any[]) => {
        const rows = getTable(table);
        const toAdd = Array.isArray(records) ? records : [records];
        const inserted = toAdd.map((item) => ({
          id: item.id || `gen-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          created_at: item.created_at || new Date().toISOString(),
          ...item,
        }));
        saveTable(table, [...rows, ...inserted]);
        return { data: inserted, error: null };
      },
      update: (patch: any) => {
        return {
          ...builder,
          then: async (resolve: any, reject?: any) => {
            const rows = getTable(table);
            const updated = rows.map((r) => (filters.every((f) => f(r)) ? { ...r, ...patch } : r));
            saveTable(table, updated);
            const result = { data: updated, error: null };
            return resolve ? resolve(result) : result;
          },
        };
      },
      delete: () => {
        return {
          ...builder,
          then: async (resolve: any, reject?: any) => {
            const rows = getTable(table);
            const remaining = rows.filter((r) => !filters.every((f) => f(r)));
            saveTable(table, remaining);
            const result = { data: remaining, error: null };
            return resolve ? resolve(result) : result;
          },
        };
      },
      then: async (resolve: any, _reject?: any) => {
        let rows = getTable(table);
        if (filters.length) {
          rows = rows.filter((r) => filters.every((f) => f(r)));
        }
        if (sortFn) {
          rows = [...rows].sort(sortFn);
        }
        if (limitCount != null) {
          rows = rows.slice(0, limitCount);
        }

        // Hydrate author profiles for posts and stories
        if (table === "posts" || table === "stories") {
          rows = rows.map((item) => ({
            ...item,
            author: resolveAuthor(item.author_id),
          }));
        }

        let resultData: any = rows;
        if (isSingle) {
          resultData = rows[0] || null;
        } else if (isMaybeSingle) {
          resultData = rows[0] || null;
        }

        const res = { data: resultData, error: null, count: rows.length };
        return resolve ? resolve(res) : res;
      },
    };

    return builder;
  };

  const channelObj = {
    on: () => channelObj,
    subscribe: () => channelObj,
    unsubscribe: () => {},
  };

  return {
    auth: {
      getSession: async () => ({ data: { session: currentSession }, error: null }),
      getUser: async () => ({ data: { user: currentUser }, error: null }),
      onAuthStateChange: (cb: (event: string, session: any) => void) => {
        authListeners.add(cb);
        // Call immediately with current session
        setTimeout(() => cb("INITIAL_SESSION", currentSession), 0);
        return {
          data: {
            subscription: {
              unsubscribe: () => authListeners.delete(cb),
            },
          },
        };
      },
      signInWithPassword: async ({ email }: { email: string; password?: string }) => {
        const profiles = getTable("profiles");
        let profile = profiles.find((p) => p.handle === email.split("@")[0] || p.id === "u-current");
        if (!profile) {
          profile = {
            id: `u-${Date.now()}`,
            handle: email.split("@")[0] || "user",
            display_name: email.split("@")[0] || "Flick User",
            avatar_url: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop",
            bio: "Exploring moments on Flick ✨",
            created_at: new Date().toISOString(),
          };
          saveTable("profiles", [...profiles, profile]);
        }

        currentUser = {
          id: profile.id,
          email,
          user_metadata: { handle: profile.handle, display_name: profile.display_name },
        };
        currentSession = {
          access_token: "mock-session-token",
          token_type: "bearer",
          user: currentUser,
          expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
        };
        localStorage.setItem("flick:mock_user", JSON.stringify(currentUser));
        notifyAuth("SIGNED_IN");
        return { data: { session: currentSession, user: currentUser }, error: null };
      },
      signUp: async ({ email, options }: any) => {
        const handle = options?.data?.handle || email.split("@")[0];
        const displayName = options?.data?.display_name || handle;
        const newId = `u-${Date.now()}`;
        const newProfile = {
          id: newId,
          handle,
          display_name: displayName,
          avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${handle}`,
          bio: "Just joined Flick ✨",
          created_at: new Date().toISOString(),
        };
        const profiles = getTable("profiles");
        saveTable("profiles", [...profiles, newProfile]);

        currentUser = {
          id: newId,
          email,
          user_metadata: { handle, display_name: displayName },
        };
        currentSession = {
          access_token: "mock-session-token",
          token_type: "bearer",
          user: currentUser,
          expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
        };
        localStorage.setItem("flick:mock_user", JSON.stringify(currentUser));
        notifyAuth("SIGNED_IN");
        return { data: { session: currentSession, user: currentUser }, error: null };
      },
      signOut: async () => {
        currentUser = null;
        currentSession = null;
        localStorage.removeItem("flick:mock_user");
        notifyAuth("SIGNED_OUT");
        return { error: null };
      },
      setSession: async (tokens: any) => {
        if (tokens?.user) {
          currentUser = tokens.user;
          currentSession = tokens;
          localStorage.setItem("flick:mock_user", JSON.stringify(currentUser));
          notifyAuth("SIGNED_IN");
        }
        return { data: { session: currentSession }, error: null };
      },
    },
    from: (table: string) => createQueryBuilder(table),
    channel: (_name: string) => channelObj,
    removeChannel: (_ch: any) => {},
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, file: any) => {
          let publicUrl = "";
          if (typeof file === "object" && file instanceof Blob) {
            publicUrl = URL.createObjectURL(file);
          } else {
            publicUrl = `https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&fit=crop`;
          }
          return { data: { path, publicUrl }, error: null };
        },
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: path.startsWith("blob:") || path.startsWith("http")
              ? path
              : `https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=800&fit=crop`,
          },
        }),
        createSignedUrl: async (path: string) => ({
          data: { signedUrl: path },
          error: null,
        }),
      }),
    },
  } as any;
}
