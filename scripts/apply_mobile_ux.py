from pathlib import Path

app = Path('src/App.jsx')
text = app.read_text()

def once(old, new, label):
    global text
    if old not in text:
        raise SystemExit(f'missing anchor: {label}')
    text = text.replace(old, new, 1)

once('import "./styles.css";', '''import "./styles.css";
import "./mobile-ux.css";
import { OfflineBanner, Onboarding, UniversalSearch, CatchUpCard, QuickAccess, ChatTools, ReactionSettings, PullToRefresh } from "./MobileUX";
import { cacheAppData, loadCachedAppData, cacheMessages, loadCachedMessages, getDraft, setDraft, getUxPrefs, updateUxPrefs, rememberRecent, queueOutbox, getOutbox, removeOutboxItem } from "./offline";
import { getChatPins, setChatPinned, getNicknames, setNickname, deleteDmMessage, deleteSpaceMessage, scheduleDmMessage, markDmRead } from "./uxData";''', 'imports')

once('function Header({ profile, pendingCount, onBell }) {', 'function Header({ profile, pendingCount, onBell, onSearch }) {', 'header signature')
once('<div className="brand-lockup"><div className="mini-mark">W</div><strong>Wavo</strong></div>\n      <button className="icon-button"', '<div className="brand-lockup"><div className="mini-mark">W</div><strong>Wavo</strong></div>\n      <button className="mobile-search-trigger" onClick={onSearch} aria-label="Search Wavo"><Search size={19} /></button>\n      <button className="icon-button"', 'header search')

once('function HomeScreen({ profile, spaces, posts, waves, plans, polls, requests, activities, userId, actions }) {', 'function HomeScreen({ profile, friends, spaces, posts, waves, plans, polls, requests, activities, pins, userId, actions }) {', 'home signature')
once('''      </section>\n\n      {(requests.length > 0 || needsVote.length > 0) && (''', '''      </section>\n      <CatchUpCard requests={requests} plans={plans} polls={polls} userId={userId} />\n      <QuickAccess userId={userId} friends={friends} spaces={spaces} pins={pins || []} onFriend={actions.openFriend} onSpace={actions.openSpace} />\n\n      {(requests.length > 0 || needsVote.length > 0) && (''', 'home ux cards')

once('<button className="back-button" onClick={() => setSelectedSpace(null)}><ChevronLeft size={18} /> Spaces</button>', '<div className="mobile-detail-bar"><button className="back-button" onClick={() => setSelectedSpace(null)}><ChevronLeft size={18} /> Spaces</button><button className="mobile-tools-button" onClick={() => actions.openChatTools("space", selectedSpace)} aria-label="Space tools"><Settings size={18}/></button></div>', 'space tools')

once('function InboxScreen({ friends, requests, selectedFriend, setSelectedFriend, messages, messageText, setMessageText, sendMessage, userId, actions }) {', 'function InboxScreen({ friends, requests, selectedFriend, setSelectedFriend, messages, messageText, setMessageText, sendMessage, userId, actions, nicknames = {} }) {', 'inbox signature')
once('<header className="chat-topbar"><button onClick={() => setSelectedFriend(null)}><ChevronLeft /></button><Avatar profile={selectedFriend} size="sm" /><div><strong>{selectedFriend.username}</strong><span>{selectedFriend.status || "Wavo friend"}</span></div></header>', '<header className="chat-topbar"><button onClick={() => setSelectedFriend(null)}><ChevronLeft /></button><Avatar profile={selectedFriend} size="sm" /><div><strong>{nicknames[selectedFriend.id] || selectedFriend.username}</strong><span>{nicknames[selectedFriend.id] ? `@${selectedFriend.username}` : (selectedFriend.status || "Wavo friend")}</span></div><button className="mobile-tools-button" onClick={() => actions.openChatTools("dm", selectedFriend)} aria-label="Chat tools"><Settings size={18}/></button></header>', 'dm tools')
once('<form className="settings-card" onSubmit={saveProfile}><div className="settings-head"><Sparkles /><div><strong>Identity</strong><span>Keep it lightweight. You\'re here for people, not follower counts.</span></div></div><label>Status<input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Gaming, studying, out…" /></label><label>Bio<textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={180} placeholder="A sentence about you" /></label><button className="secondary-btn">{saving ? "Saving…" : "Save profile"}</button></form>', '<form className="settings-card" onSubmit={saveProfile}><div className="settings-head"><Sparkles /><div><strong>Identity</strong><span>Keep it lightweight. You\'re here for people, not follower counts.</span></div></div><label>Status<input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Gaming, studying, out…" /></label><label>Bio<textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={180} placeholder="A sentence about you" /></label><ReactionSettings userId={userId} /><button className="secondary-btn">{saving ? "Saving…" : "Save profile"}</button></form>', 'reaction settings')

once('const [data, setData] = useState({ profile: null, friends: [], requests: [], spaces: [], posts: [], waves: [], plans: [], polls: [], activities: [], privacy: null, locations: [] });', 'const [data, setData] = useState({ profile: null, friends: [], requests: [], spaces: [], posts: [], waves: [], plans: [], polls: [], activities: [], privacy: null, locations: [], pins: [], nicknames: {} });', 'data state')
once('const [toast, setToast] = useState("");', '''const [toast, setToast] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [online, setOnline] = useState(() => typeof navigator === "undefined" ? true : navigator.onLine);
  const [chatToolTarget, setChatToolTarget] = useState(null);
  const [undoSend, setUndoSend] = useState(null);''', 'ux states')

once('''  useEffect(() => {
    registerServiceWorker().catch(() => {});''', '''  useEffect(() => {
    const setConnection = () => setOnline(navigator.onLine);
    window.addEventListener("online", setConnection);
    window.addEventListener("offline", setConnection);
    const command = (e) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen(true); } };
    window.addEventListener("keydown", command);
    registerServiceWorker().catch(() => {});''', 'connection effect start')
once('return () => authListener.subscription.unsubscribe();\n  }, []);', 'return () => { authListener.subscription.unsubscribe(); window.removeEventListener("online", setConnection); window.removeEventListener("offline", setConnection); window.removeEventListener("keydown", command); };\n  }, []);', 'connection cleanup')

old_refresh = '''      const [profile, friends, requests, spaces, privacy] = await Promise.all([
        getProfile(userId), getFriends(userId), getIncomingFriendRequests(userId), getSpaces(userId), getPrivacySettings(userId),
      ]);
      const [posts, waves, plans, polls, activities, locations] = await Promise.all([
        getPosts(userId, friends), getWaves(), getPlans(userId, spaces), getPolls(), getActivities(), getActiveLocationShares(),
      ]);
      setData({ profile, friends, requests, spaces, posts, waves, plans, polls, activities, privacy, locations });
    } catch (err) {
      console.error("[wavo] refresh", err);
      setToast(GENERIC_ERROR);
    }
  }

  useEffect(() => { if (userId) refresh(); }, [userId]);'''
new_refresh = '''      const [profile, friends, requests, spaces, privacy, pins, nicknames] = await Promise.all([
        getProfile(userId), getFriends(userId), getIncomingFriendRequests(userId), getSpaces(userId), getPrivacySettings(userId), getChatPins(userId), getNicknames(userId),
      ]);
      const [posts, waves, plans, polls, activities, locations] = await Promise.all([
        getPosts(userId, friends), getWaves(), getPlans(userId, spaces), getPolls(), getActivities(), getActiveLocationShares(),
      ]);
      const next = { profile, friends, requests, spaces, posts, waves, plans, polls, activities, privacy, locations, pins, nicknames };
      setData(next);
      cacheAppData(userId, next);
    } catch (err) {
      console.error("[wavo] refresh", err);
      const cached = loadCachedAppData(userId);
      if (cached) { setData((prev) => ({ ...prev, ...cached })); setToast("Offline copy loaded"); }
      else setToast(GENERIC_ERROR);
    }
  }

  useEffect(() => {
    if (!userId) return;
    const cached = loadCachedAppData(userId);
    if (cached) setData((prev) => ({ ...prev, ...cached }));
    refresh();
  }, [userId]);'''
once(old_refresh, new_refresh, 'refresh cache')

old_dm = '''    const chatId = [userId, selectedFriend.id].sort().join("_");
    getDmMessages(userId, selectedFriend.id).then((r) => setMessages(r.messages)).catch(console.error);
    const channel = supabase.channel(`wavo-dm:${chatId}`).on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` }, () => getDmMessages(userId, selectedFriend.id).then((r) => setMessages(r.messages))).subscribe();'''
new_dm = '''    const chatId = [userId, selectedFriend.id].sort().join("_");
    const cacheKey = `dm:${chatId}`;
    const cached = loadCachedMessages(userId, cacheKey);
    if (cached.length) setMessages(cached);
    setMessageText(getDraft(userId, cacheKey));
    markDmRead(userId, selectedFriend.id).catch(() => {});
    const load = () => getDmMessages(userId, selectedFriend.id).then((r) => { setMessages(r.messages); cacheMessages(userId, cacheKey, r.messages); }).catch(() => {});
    load();
    const channel = supabase.channel(`wavo-dm:${chatId}`).on("postgres_changes", { event: "*", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` }, load).subscribe();'''
once(old_dm, new_dm, 'dm cache')

old_space = '''    getSpaceMessages(selectedSpace.id).then(setMessages).catch(console.error);
    const channel = supabase.channel(`wavo-space:${selectedSpace.id}`).on("postgres_changes", { event: "*", schema: "public", table: "group_messages", filter: `group_id=eq.${selectedSpace.id}` }, () => getSpaceMessages(selectedSpace.id).then(setMessages)).subscribe();'''
new_space = '''    const cacheKey = `space:${selectedSpace.id}`;
    const cached = loadCachedMessages(userId, cacheKey);
    if (cached.length) setMessages(cached);
    setMessageText(getDraft(userId, cacheKey));
    const load = () => getSpaceMessages(selectedSpace.id).then((rows) => { setMessages(rows); cacheMessages(userId, cacheKey, rows); }).catch(() => {});
    load();
    const channel = supabase.channel(`wavo-space:${selectedSpace.id}`).on("postgres_changes", { event: "*", schema: "public", table: "group_messages", filter: `group_id=eq.${selectedSpace.id}` }, load).subscribe();'''
once(old_space, new_space, 'space cache')

once('''  }, [selectedSpace]);

  const actions = useMemo(() => ({''', '''  }, [selectedSpace, userId]);

  useEffect(() => {
    if (!userId) return;
    const key = selectedFriend ? `dm:${[userId, selectedFriend.id].sort().join("_")}` : selectedSpace ? `space:${selectedSpace.id}` : null;
    if (key) setDraft(userId, key, messageText);
  }, [messageText, selectedFriend?.id, selectedSpace?.id, userId]);

  useEffect(() => {
    if (!userId || !online) return;
    let cancelled = false;
    (async () => {
      for (const item of getOutbox(userId)) {
        if (cancelled) break;
        try {
          if (item.kind === "dm") await sendDmMessage(userId, item.targetId, item.content);
          else await sendSpaceMessage(item.targetId, userId, item.content);
          removeOutboxItem(userId, item.id);
        } catch { break; }
      }
    })();
    return () => { cancelled = true; };
  }, [userId, online]);

  const actions = useMemo(() => ({''', 'draft and outbox effects')

once('''    openCreate: (mode = null, spaceId = null) => { setPresetSpace(spaceId); setCreateMode(mode || true); },''', '''    openCreate: (mode = null, spaceId = null) => { setPresetSpace(spaceId); setCreateMode(mode || true); },
    openFriend: (friend) => { rememberRecent(userId, "friend", friend.id); setTab("inbox"); setSelectedSpace(null); setSelectedFriend(friend); },
    openSpace: (space) => { rememberRecent(userId, "space", space.id); setTab("spaces"); setSelectedFriend(null); setSelectedSpace(space); },
    openChatTools: (kind, target) => setChatToolTarget({ kind, target }),''', 'actions navigation')

old_send = '''  async function sendCurrentMessage(e) {
    e.preventDefault();
    const content = messageText.trim();
    if (!content) return;
    setMessageText("");
    try {
      if (selectedFriend) await sendDmMessage(userId, selectedFriend.id, content);
      else if (selectedSpace) await sendSpaceMessage(selectedSpace.id, userId, content);
    } catch (err) { console.error(err); setMessageText(content); setToast(GENERIC_ERROR); }
  }'''
new_send = '''  async function sendCurrentMessage(e) {
    e.preventDefault();
    const content = messageText.trim();
    if (!content) return;
    const kind = selectedFriend ? "dm" : "space";
    const targetId = selectedFriend?.id || selectedSpace?.id;
    if (!targetId) return;
    setMessageText("");
    const tempId = `temp:${Date.now()}`;
    const optimistic = { id: tempId, sender_id: userId, user_id: userId, content, type: "text", created_at: new Date().toISOString(), queued: !online };
    setMessages((prev) => [...prev, optimistic]);
    if (!online) {
      const queued = queueOutbox(userId, { kind, targetId, content });
      setUndoSend({ ...queued, tempId, offline: true });
      setToast("Queued. Wavo will send it when you're back online.");
      return;
    }
    try {
      const sent = kind === "dm" ? await sendDmMessage(userId, targetId, content) : await sendSpaceMessage(targetId, userId, content);
      setMessages((prev) => prev.map((m) => m.id === tempId ? (sent || { ...optimistic, id: tempId }) : m));
      if (sent?.id) {
        setUndoSend({ kind, id: sent.id });
        setTimeout(() => setUndoSend((current) => current?.id === sent.id ? null : current), 5000);
      }
    } catch (err) { console.error(err); setMessages((prev) => prev.filter((m) => m.id !== tempId)); setMessageText(content); setToast(GENERIC_ERROR); }
  }

  async function undoLastSend() {
    const item = undoSend;
    if (!item) return;
    try {
      if (item.offline) { removeOutboxItem(userId, item.id); setMessages((prev) => prev.filter((m) => m.id !== item.tempId)); }
      else { if (item.kind === "dm") await deleteDmMessage(userId, item.id); else await deleteSpaceMessage(userId, item.id); setMessages((prev) => prev.filter((m) => m.id !== item.id)); }
      setUndoSend(null); setToast("Message undone");
    } catch { setToast(GENERIC_ERROR); }
  }

  async function toggleCurrentPin() {
    const current = chatToolTarget; if (!current) return;
    const kind = current.kind === "dm" ? "dm" : "space"; const id = String(current.target.id);
    const pinned = data.pins.some((p) => p.kind === kind && p.target_id === id);
    await setChatPinned(userId, kind, id, !pinned); await refresh(); setToast(pinned ? "Unpinned" : "Pinned");
  }

  async function saveCurrentNickname(value) {
    if (chatToolTarget?.kind !== "dm") return;
    await setNickname(userId, chatToolTarget.target.id, value); await refresh(); setToast("Nickname saved");
  }

  async function scheduleCurrentMessage(content, when) {
    if (chatToolTarget?.kind !== "dm") return;
    await scheduleDmMessage(userId, chatToolTarget.target.id, content, new Date(when).toISOString()); setToast("Message scheduled");
  }'''
once(old_send, new_send, 'send offline optimistic')

once('''  return (
    <main className="app-shell">
      {!isDeepView && <Header profile={data.profile} pendingCount={data.requests.length} onBell={() => setTab("inbox")} />}
      <div className="app-content">''', '''  const uxPrefs = getUxPrefs(userId);
  const currentToolPinned = chatToolTarget ? data.pins.some((p) => p.kind === (chatToolTarget.kind === "dm" ? "dm" : "space") && p.target_id === String(chatToolTarget.target.id)) : false;
  const currentToolMuted = chatToolTarget?.kind === "space" ? Boolean(uxPrefs.mutedSpaces?.[chatToolTarget.target.id]) : false;

  return (
    <main className="app-shell">
      <OfflineBanner online={online} queued={getOutbox(userId).length} />
      {!isDeepView && <Header profile={data.profile} pendingCount={data.requests.length} onBell={() => setTab("inbox")} onSearch={() => setSearchOpen(true)} />}
      <PullToRefresh onRefresh={refresh}><div className="app-content">''', 'app render top')
once('''        {tab === "inbox" && <InboxScreen friends={data.friends} requests={data.requests} selectedFriend={selectedFriend} setSelectedFriend={setSelectedFriend} messages={messages} messageText={messageText} setMessageText={setMessageText} sendMessage={sendCurrentMessage} userId={userId} actions={actions} />}
        {tab === "you"''', '''        {tab === "inbox" && <InboxScreen friends={data.friends} requests={data.requests} selectedFriend={selectedFriend} setSelectedFriend={setSelectedFriend} messages={messages} messageText={messageText} setMessageText={setMessageText} sendMessage={sendCurrentMessage} userId={userId} actions={actions} nicknames={data.nicknames} />}
        {tab === "you"''', 'inbox nicknames')
once('''      </div>
      {!isDeepView && <BottomNav''', '''      </div></PullToRefresh>
      {!isDeepView && <BottomNav''', 'pull close')
once('''      {createMode && <CreateModal mode={createMode === true ? null : createMode} setMode={setCreateMode} spaces={data.spaces} friends={data.friends} presetSpace={presetSpace} onClose={() => { setCreateMode(false); setPresetSpace(null); }} onCreated={refresh} userId={userId} />}
      <Toast message={toast} onClose={() => setToast("")} />''', '''      {createMode && <CreateModal mode={createMode === true ? null : createMode} setMode={setCreateMode} spaces={data.spaces} friends={data.friends} presetSpace={presetSpace} onClose={() => { setCreateMode(false); setPresetSpace(null); }} onCreated={refresh} userId={userId} />}
      <Onboarding userId={userId} onCreateSpace={() => actions.openCreate("space")} onAddFriend={() => setTab("inbox")} />
      <UniversalSearch open={searchOpen} onClose={() => setSearchOpen(false)} data={data} messages={messages} onOpenFriend={actions.openFriend} onOpenSpace={actions.openSpace} onOpenTab={setTab} />
      <ChatTools open={Boolean(chatToolTarget)} onClose={() => setChatToolTarget(null)} target={chatToolTarget?.target} kind={chatToolTarget?.kind} messages={messages} pinned={currentToolPinned} nickname={chatToolTarget?.kind === "dm" ? data.nicknames[chatToolTarget.target.id] : ""} onTogglePin={toggleCurrentPin} onNickname={saveCurrentNickname} onSchedule={scheduleCurrentMessage} muted={currentToolMuted} onMute={() => { const id = chatToolTarget.target.id; const mutedSpaces = { ...(getUxPrefs(userId).mutedSpaces || {}), [id]: !currentToolMuted }; updateUxPrefs(userId, { mutedSpaces }); setToast(!currentToolMuted ? "Space muted" : "Space unmuted"); }} />
      {undoSend && <div className="undo-toast"><span>{undoSend.offline ? "Message queued" : "Message sent"}</span><button onClick={undoLastSend}>Undo</button></div>}
      <Toast message={toast} onClose={() => setToast("")} />''', 'ux overlays')

app.write_text(text)

# Return inserted rows so optimistic messages can be replaced and undone.
data = Path('src/wavoData.js')
w = data.read_text()
old = '''export async function sendSpaceMessage(groupId, userId, content) {
  const { error } = await supabase.from("group_messages").insert({
    group_id: groupId,
    user_id: userId,
    sender_id: userId,
    content: content.trim(),
    type: "text",
  });
  if (error) throw error;
}'''
new = '''export async function sendSpaceMessage(groupId, userId, content) {
  const { data, error } = await supabase.from("group_messages").insert({
    group_id: groupId,
    user_id: userId,
    sender_id: userId,
    content: content.trim(),
    type: "text",
  }).select("*").single();
  if (error) throw error;
  return data;
}'''
if old not in w: raise SystemExit('missing sendSpaceMessage anchor')
w = w.replace(old, new, 1)
old = '''export async function sendDmMessage(userId, friendId, content, type = "text") {
  const chatId = [userId, friendId].sort().join("_");
  const { error } = await supabase.from("messages").insert({ chat_id: chatId, sender_id: userId, receiver_id: friendId, content, type, is_read: false });
  if (error) throw error;
}'''
new = '''export async function sendDmMessage(userId, friendId, content, type = "text") {
  const chatId = [userId, friendId].sort().join("_");
  const { data, error } = await supabase.from("messages").insert({ chat_id: chatId, sender_id: userId, receiver_id: friendId, content, type, is_read: false }).select("*").single();
  if (error) throw error;
  return data;
}'''
if old not in w: raise SystemExit('missing sendDmMessage anchor')
w = w.replace(old, new, 1)
data.write_text(w)

# Web/PWA offline shell. Native iOS already bundles the web assets and uses the
# local cache above for data/messages.
sw = Path('public/sw.js')
s = sw.read_text()
needle = 'self.addEventListener("install", () => {\n  // Activate immediately on first install (don\'t wait for old SW to die)\n  self.skipWaiting();\n});'
replacement = '''const CACHE_NAME = "wavo-shell-v2";
const SHELL = ["/", "/index.html", "/favicon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});'''
if needle not in s: raise SystemExit('missing service worker install anchor')
s = s.replace(needle, replacement, 1)
insert = '''\nself.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  event.respondWith(caches.match(req).then((cached) => {
    const network = fetch(req).then((res) => {
      if (res && res.ok) caches.open(CACHE_NAME).then((cache) => cache.put(req, res.clone()));
      return res;
    }).catch(() => cached);
    return cached || network;
  }));
});\n'''
s = s.replace('// Fires when the push service delivers a message from our Edge Function', insert + '\n// Fires when the push service delivers a message from our Edge Function', 1)
sw.write_text(s)
