from pathlib import Path


def replace_once(text, old, new, label):
    if old not in text:
        raise SystemExit(f"Missing anchor: {label}")
    return text.replace(old, new, 1)

app_path = Path("src/App.jsx")
app = app_path.read_text()

app = replace_once(
    app,
    '<span className="tiny-pill">FRIENDS</span>',
    '<span className="tiny-pill">{post.visibility === "selected" ? "SELECTED" : "ALL FRIENDS"}</span>',
    "post audience badge",
)

app = replace_once(
    app,
    'function CreateModal({ mode, setMode, spaces, presetSpace, onClose, onCreated, userId }) {',
    'function CreateModal({ mode, setMode, spaces, friends, presetSpace, onClose, onCreated, userId }) {',
    "CreateModal friends prop",
)

app = replace_once(
    app,
    '    body: "", audience: presetSpace ? "space" : "friends", groupId: presetSpace || spaces[0]?.id || "", title: "", location: "", startsAt: "", notes: "", question: "", option1: "", option2: "", option3: "", activityType: "would_you_rather", items: "", name: "", description: "", emoji: "🌊",',
    '    body: "", postVisibility: "friends", postRecipients: [], audience: presetSpace ? "space" : "friends", groupId: presetSpace || spaces[0]?.id || "", title: "", location: "", startsAt: "", notes: "", question: "", option1: "", option2: "", option3: "", activityType: "would_you_rather", items: "", name: "", description: "", emoji: "🌊",',
    "post form state",
)

app = replace_once(
    app,
    '      if (mode === "post") await createPost(userId, { body: form.body });',
    '      if (mode === "post") await createPost(userId, { body: form.body, visibility: form.postVisibility, recipientIds: form.postRecipients });',
    "createPost call",
)

old_post_form = '{mode === "post" && <><label>Post<textarea required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="What do you want your friends to see?" maxLength={2000} /></label><div className="form-note">Only accepted friends can see this. Posts stay until you delete them.</div></>}'
new_post_form = '''{mode === "post" && <>
              <label>Post<textarea required value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="What do you want to share?" maxLength={2000} /></label>
              <label>Who can see this?
                <select value={form.postVisibility} onChange={(e) => setForm({ ...form, postVisibility: e.target.value, postRecipients: e.target.value === "friends" ? [] : form.postRecipients })}>
                  <option value="friends">All friends</option>
                  <option value="selected">Choose people</option>
                </select>
              </label>
              {form.postVisibility === "selected" && <div className="post-audience-picker">
                <div className="audience-picker-head"><span>Choose people</span><strong>{form.postRecipients.length} selected</strong></div>
                {friends.length ? <div className="audience-list">{friends.map((friend) => {
                  const selected = form.postRecipients.includes(friend.id);
                  return <button type="button" key={friend.id} className={selected ? "audience-person selected" : "audience-person"} aria-pressed={selected} onClick={() => setForm({ ...form, postRecipients: selected ? form.postRecipients.filter((id) => id !== friend.id) : [...form.postRecipients, friend.id] })}>
                    <Avatar profile={friend} size="sm" />
                    <span>{friend.username}</span>
                    <i className="audience-check">{selected && <Check size={16} />}</i>
                  </button>;
                })}</div> : <div className="form-note">Add a friend first, then you can choose them here.</div>}
              </div>}
              <div className="form-note">Posts stay until you delete them. Only the audience you choose can open them.</div>
            </>}'''
app = replace_once(app, old_post_form, new_post_form, "post audience form")

app = replace_once(
    app,
    '<div className="modal-actions"><button type="button" className="text-btn" onClick={() => setMode(null)}>Back</button><button className="primary-btn" disabled={busy || (needSpace && !form.groupId)}>{busy ? "Creating…" : `Create ${CREATE_TYPES.find((t) => t.id === mode)?.label}`}</button></div>',
    '<div className="modal-actions"><button type="button" className="text-btn" onClick={() => setMode(null)}>Back</button><button className="primary-btn" disabled={busy || (needSpace && !form.groupId) || (mode === "post" && form.postVisibility === "selected" && form.postRecipients.length === 0)}>{busy ? "Creating…" : `Create ${CREATE_TYPES.find((t) => t.id === mode)?.label}`}</button></div>',
    "post submit validation",
)

app = replace_once(
    app,
    '{createMode && <CreateModal mode={createMode === true ? null : createMode} setMode={setCreateMode} spaces={data.spaces} presetSpace={presetSpace} onClose={() => { setCreateMode(false); setPresetSpace(null); }} onCreated={refresh} userId={userId} />}',
    '{createMode && <CreateModal mode={createMode === true ? null : createMode} setMode={setCreateMode} spaces={data.spaces} friends={data.friends} presetSpace={presetSpace} onClose={() => { setCreateMode(false); setPresetSpace(null); }} onCreated={refresh} userId={userId} />}',
    "CreateModal invocation",
)

app = app.replace(
    "Posts stay around and are only visible to people you've actually added.",
    "Posts stay around, and you choose which friends get to see each one.",
)
app_path.write_text(app)


data_path = Path("src/wavoData.js")
data = data_path.read_text()
old_create = '''export async function createPost(userId, { body }) {
  const { data, error } = await supabase
    .from("posts")
    .insert({ author_id: userId, body: body.trim(), visibility: "friends" })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}'''
new_create = '''export async function createPost(userId, { body, visibility = "friends", recipientIds = [] }) {
  const cleanRecipients = [...new Set((recipientIds || []).filter((id) => id && id !== userId))];
  if (!['friends', 'selected'].includes(visibility)) throw new Error("Invalid post visibility");
  if (visibility === "selected" && cleanRecipients.length === 0) throw new Error("Choose at least one friend");

  const { data, error } = await supabase
    .from("posts")
    .insert({ author_id: userId, body: body.trim(), visibility })
    .select("*")
    .single();
  if (error) throw error;

  if (visibility === "selected") {
    const rows = cleanRecipients.map((friendId) => ({ post_id: data.id, author_id: userId, user_id: friendId }));
    const { error: audienceError } = await supabase.from("post_audience").insert(rows);
    if (audienceError) {
      const { error: cleanupError } = await supabase.from("posts").delete().eq("id", data.id).eq("author_id", userId);
      if (cleanupError) console.error("[wavo] post audience cleanup", cleanupError);
      throw audienceError;
    }
  }

  return data;
}'''
data = replace_once(data, old_create, new_create, "createPost data function")
data_path.write_text(data)

styles_path = Path("src/styles.css")
styles = styles_path.read_text()
marker = "/* post-audience-picker */"
if marker not in styles:
    styles += '''\n\n/* post-audience-picker */
.post-audience-picker { display: grid; gap: 10px; }
.audience-picker-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; color: var(--muted); font-size: 12px; }
.audience-picker-head strong { color: #d9f5ff; font-size: 11px; }
.audience-list { display: grid; gap: 8px; max-height: 260px; overflow-y: auto; padding-right: 2px; }
.audience-person { width: 100%; display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 11px; padding: 10px 11px; border-radius: 16px; border: 1px solid var(--line); background: rgba(255,255,255,.035); text-align: left; }
.audience-person > span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 750; }
.audience-person.selected { border-color: rgba(50,214,255,.32); background: rgba(50,214,255,.09); box-shadow: inset 0 0 0 1px rgba(50,214,255,.04); }
.audience-check { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 9px; background: rgba(255,255,255,.045); color: #76e5ff; font-style: normal; }
.audience-person.selected .audience-check { background: rgba(50,214,255,.14); }
'''
styles_path.write_text(styles)

print("Post audience picker applied")
