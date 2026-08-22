from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing patch anchor: {label}")
    return text.replace(old, new, 1)

app_path = Path("src/App.jsx")
data_path = Path("src/wavoData.js")
css_path = Path("src/styles.css")

app = app_path.read_text()
data = data_path.read_text()
css = css_path.read_text()

# Data API helpers for persistent friends-only posts.
data += r'''

export async function getPosts(userId, friends = []) {
  const authorIds = [userId, ...(friends || []).map((f) => f.id)].filter(Boolean);
  if (!authorIds.length) return [];
  const { data: posts, error } = await supabase
    .from("posts")
    .select("*")
    .in("author_id", authorIds)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) throw error;
  if (!posts?.length) return [];

  const postIds = posts.map((p) => p.id);
  const profileIds = [...new Set(posts.map((p) => p.author_id))];
  const [profilesResult, reactionsResult] = await Promise.all([
    supabase.from("profiles").select("id,username,avatar_url,status").in("id", profileIds),
    supabase.from("post_reactions").select("*").in("post_id", postIds),
  ]);
  if (profilesResult.error) throw profilesResult.error;
  if (reactionsResult.error) throw reactionsResult.error;

  const profileMap = Object.fromEntries((profilesResult.data || []).map((p) => [p.id, p]));
  const reactions = reactionsResult.data || [];
  return posts.map((post) => ({
    ...post,
    author: profileMap[post.author_id],
    reactions: reactions.filter((r) => r.post_id === post.id),
  }));
}

export async function createPost(userId, { body }) {
  const { data, error } = await supabase
    .from("posts")
    .insert({ author_id: userId, body: body.trim(), visibility: "friends" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function reactToPost(userId, postId, emoji) {
  const { data: existing, error: existingError } = await supabase
    .from("post_reactions")
    .select("emoji")
    .eq("post_id", postId)
    .eq("user_id", userId)
    .maybeSingle();
  if (existingError) throw existingError;

  if (existing?.emoji === emoji) {
    const { error } = await supabase.from("post_reactions").delete().eq("post_id", postId).eq("user_id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from("post_reactions")
    .upsert({ post_id: postId, user_id: userId, emoji }, { onConflict: "post_id,user_id" });
  if (error) throw error;
}

export async function deletePost(userId, postId) {
  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("author_id", userId);
  if (error) throw error;
}
'''

# Imports.
app = replace_once(app, '  createPlan,\n  createPoll,', '  createPlan,\n  createPoll,\n  createPost,', 'createPost import')
app = replace_once(app, '  getPlans,\n  getPolls,', '  getPlans,\n  getPolls,\n  getPosts,', 'getPosts import')
app = replace_once(app, '  reactToWave,\n  respondFriendRequest,', '  reactToWave,\n  reactToPost,\n  deletePost,\n  respondFriendRequest,', 'post action imports')

# Create menu.
app = replace_once(app, 'const CREATE_TYPES = [\n  { id: "wave", label: "Wave", hint: "Share something quick", icon: Sparkles },', 'const CREATE_TYPES = [\n  { id: "post", label: "Post", hint: "Share something that stays", icon: MessageCircle },\n  { id: "wave", label: "Wave", hint: "Share something quick", icon: Sparkles },', 'post create type')

post_card = r'''
function PostCard({ post, userId, onReact, onDelete }) {
  const counts = (post.reactions || []).reduce((acc, r) => ({ ...acc, [r.emoji]: (acc[r.emoji] || 0) + 1 }), {});
  const mine = (post.reactions || []).find((r) => r.user_id === userId)?.emoji;
  const ownPost = post.author_id === userId;
  return (
    <article className="post-card">
      <div className="wave-head">
        <Avatar profile={post.author} size="sm" />
        <div><strong>{post.author?.username || "Wavo user"}</strong><span>{formatRelative(post.created_at)}</span></div>
        <span className="tiny-pill">FRIENDS</span>
      </div>
      <p>{post.body}</p>
      <div className="post-card-actions">
        <div className="reaction-row">
          {["❤️", "😂", "🔥", "👀"].map((emoji) => (
            <button key={emoji} className={mine === emoji ? "selected" : ""} onClick={() => onReact(post.id, emoji)}>
              {emoji}{counts[emoji] ? ` ${counts[emoji]}` : ""}
            </button>
          ))}
        </div>
        {ownPost && <button className="post-delete" onClick={() => onDelete(post.id)} aria-label="Delete post"><X size={15} /></button>}
      </div>
    </article>
  );
}

'''
app = replace_once(app, 'function HomeScreen(', post_card + 'function HomeScreen(', 'PostCard component')

# Home feed receives and displays posts.
app = replace_once(app, 'function HomeScreen({ profile, spaces, waves, plans, polls, requests, activities, userId, actions }) {', 'function HomeScreen({ profile, spaces, posts, waves, plans, polls, requests, activities, userId, actions }) {', 'HomeScreen posts prop')
app = replace_once(app, '<p>{spaces.length} Space{spaces.length === 1 ? "" : "s"} · {upcoming.length} upcoming plan{upcoming.length === 1 ? "" : "s"} · {waves.length} active Wave{waves.length === 1 ? "" : "s"}</p>', '<p>{spaces.length} Space{spaces.length === 1 ? "" : "s"} · {upcoming.length} upcoming plan{upcoming.length === 1 ? "" : "s"} · {posts.length} friend post{posts.length === 1 ? "" : "s"}</p>', 'hero post count')
posts_section = r'''
      <section>
        <div className="section-heading"><div><span className="eyebrow">POSTS</span><h2>From friends</h2></div><button className="text-btn" onClick={() => actions.openCreate("post")}>New post</button></div>
        {posts.length ? <div className="cards-stack">{posts.map((post) => <PostCard key={post.id} post={post} userId={userId} onReact={actions.reactPost} onDelete={actions.deletePost} />)}</div> : <div className="empty-card"><MessageCircle /><strong>No posts yet</strong><span>Posts stay around and are only visible to people you've actually added.</span><button onClick={() => actions.openCreate("post")}>Post something</button></div>}
      </section>

'''
app = replace_once(app, '      <section>\n        <div className="section-heading"><div><span className="eyebrow">WAVES</span>', posts_section + '      <section>\n        <div className="section-heading"><div><span className="eyebrow">WAVES</span>', 'home posts section')

# Profile includes persistent own-post history.
app = replace_once(app, 'function ProfileScreen({ profile, privacy, locations, onPrivacy, onProfileSaved, onEnableNotifications, onStopLocations, onLogout }) {', 'function ProfileScreen({ profile, posts, userId, onPostReact, onPostDelete, onNewPost, privacy, locations, onPrivacy, onProfileSaved, onEnableNotifications, onStopLocations, onLogout }) {', 'ProfileScreen post props')
profile_posts = r'''
      <section>
        <div className="section-heading"><div><span className="eyebrow">YOUR POSTS</span><h2>What you've shared</h2></div><button className="text-btn" onClick={onNewPost}>New post</button></div>
        {posts.length ? <div className="cards-stack">{posts.map((post) => <PostCard key={post.id} post={post} userId={userId} onReact={onPostReact} onDelete={onPostDelete} />)}</div> : <div className="empty-card"><MessageCircle /><strong>Nothing posted yet</strong><span>Your persistent friend posts will live here.</span></div>}
      </section>
'''
app = replace_once(app, '      <div className="profile-hero"><Avatar profile={profile} size="xl" /><div><span className="eyebrow">YOUR WAVO</span><h1>{profile?.username}</h1><p>@{profile?.username}</p></div></div>\n      <form className="settings-card"', '      <div className="profile-hero"><Avatar profile={profile} size="xl" /><div><span className="eyebrow">YOUR WAVO</span><h1>{profile?.username}</h1><p>@{profile?.username}</p></div></div>\n' + profile_posts + '      <form className="settings-card"', 'profile posts section')

# Composer creates Posts.
app = replace_once(app, '      if (mode === "wave") await createWave(userId, { body: form.body, audience: form.audience, groupId: form.audience === "space" ? form.groupId : null });', '      if (mode === "post") await createPost(userId, { body: form.body });\n      if (mode === "wave") await createWave(userId, { body: form.body, audience: form.audience, groupId: form.audience === "space" ? form.groupId : null });', 'create post submit')
app = replace_once(app, '            {mode === "wave" && <><label>Wave<textarea required value={form.body}', '            {mode === "post" && <><label>Post<textarea required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="What do you want your friends to see?" maxLength={2000} /></label><div className="form-note">Only accepted friends can see this. Posts stay until you delete them.</div></>}\n            {mode === "wave" && <><label>Wave<textarea required value={form.body}', 'post form')

# App state + refresh.
app = replace_once(app, 'const [data, setData] = useState({ profile: null, friends: [], requests: [], spaces: [], waves: [], plans: [], polls: [], activities: [], privacy: null, locations: [] });', 'const [data, setData] = useState({ profile: null, friends: [], requests: [], spaces: [], posts: [], waves: [], plans: [], polls: [], activities: [], privacy: null, locations: [] });', 'posts state')
app = replace_once(app, '      const [waves, plans, polls, activities, locations] = await Promise.all([\n        getWaves(), getPlans(userId, spaces), getPolls(), getActivities(), getActiveLocationShares(),\n      ]);\n      setData({ profile, friends, requests, spaces, waves, plans, polls, activities, privacy, locations });', '      const [posts, waves, plans, polls, activities, locations] = await Promise.all([\n        getPosts(userId, friends), getWaves(), getPlans(userId, spaces), getPolls(), getActivities(), getActiveLocationShares(),\n      ]);\n      setData({ profile, friends, requests, spaces, posts, waves, plans, polls, activities, privacy, locations });', 'refresh posts')
app = replace_once(app, '    react: async (waveId, emoji) => { await reactToWave(userId, waveId, emoji); await refresh(); },', '    react: async (waveId, emoji) => { await reactToWave(userId, waveId, emoji); await refresh(); },\n    reactPost: async (postId, emoji) => { await reactToPost(userId, postId, emoji); await refresh(); },\n    deletePost: async (postId) => { await deletePost(userId, postId); await refresh(); setToast("Post deleted"); },', 'post actions')
app = replace_once(app, '{tab === "you" && <ProfileScreen profile={data.profile} privacy={data.privacy} locations={data.locations.filter((l) => l.owner_id === userId)} onPrivacy={updatePrivacy} onProfileSaved={refresh} onEnableNotifications={enableNotifications} onStopLocations={stopLocations} onLogout={() => supabase.auth.signOut()} />}', '{tab === "you" && <ProfileScreen profile={data.profile} posts={data.posts.filter((p) => p.author_id === userId)} userId={userId} onPostReact={actions.reactPost} onPostDelete={actions.deletePost} onNewPost={() => actions.openCreate("post")} privacy={data.privacy} locations={data.locations.filter((l) => l.owner_id === userId)} onPrivacy={updatePrivacy} onProfileSaved={refresh} onEnableNotifications={enableNotifications} onStopLocations={stopLocations} onLogout={() => supabase.auth.signOut()} />}', 'profile call posts')

# Visual treatment.
css = replace_once(css, '.plan-card, .poll-card, .wave-card, .settings-card, .add-friend-card, .space-chat-card {', '.plan-card, .poll-card, .wave-card, .post-card, .settings-card, .add-friend-card, .space-chat-card {', 'post panel style')
css += r'''

.post-card { padding: 18px; border-radius: 24px; }
.post-card > p { margin: 17px 2px; font-size: 16px; line-height: 1.58; white-space: pre-wrap; overflow-wrap: anywhere; }
.post-card-actions { display: flex; align-items: center; gap: 10px; }
.post-card-actions .reaction-row { flex: 1; }
.post-card .reaction-row button.selected { color: #dffaff; border-color: rgba(50,214,255,.32); background: rgba(50,214,255,.11); }
.post-delete { flex: 0 0 auto; width: 34px; height: 34px; display: grid; place-items: center; border-radius: 12px; color: var(--danger); background: rgba(255,107,122,.08); border: 1px solid rgba(255,107,122,.15); }
'''

app_path.write_text(app)
data_path.write_text(data)
css_path.write_text(css)
print("Friend-only Posts feature applied")
