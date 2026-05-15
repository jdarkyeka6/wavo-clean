import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import { Bell, Image as ImageIcon, X, Search } from "lucide-react";
import "./styles.css";

const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY;

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mode, setMode] = useState("login");
  const [auth, setAuth] = useState({ username: "", password: "" });
  const [authLoading, setAuthLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);
  const [isFocused, setIsFocused] = useState(true);

  // notifications
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);

  // giphy
  const [showGiphy, setShowGiphy] = useState(false);
  const [giphySearch, setGiphySearch] = useState("");
  const [giphyResults, setGiphyResults] = useState([]);
  const [giphyLoading, setGiphyLoading] = useState(false);

  const bottomRef = useRef(null);
  const selectedUserRef = useRef(null);
  const isFocusedRef = useRef(true);

  const currentUser = session?.user;

  const chatId = useMemo(() => {
    if (!currentUser || !selectedUser) return null;
    return [currentUser.id, selectedUser.id].sort().join("_");
  }, [currentUser, selectedUser]);

  useEffect(() => {
    selectedUserRef.current = selectedUser;
  }, [selectedUser]);
  useEffect(() => {
    isFocusedRef.current = isFocused;
  }, [isFocused]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const unreadByUser = useMemo(() => {
    const map = {};
    notifications.forEach((n) => {
      if (!n.is_read && n.sender_id) {
        map[n.sender_id] = (map[n.sender_id] || 0) + 1;
      }
    });
    return map;
  }, [notifications]);

  // --- UTILITIES ---
  const initial = (name) => (name?.trim()?.[0] || "?").toUpperCase();

  const markAsRead = async (msgId) => {
    await supabase
      .from("messages")
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq("id", msgId);
  };

  const triggerNotification = (msg, fromName) => {
    if (Notification.permission === "granted") {
      new Notification(`Wavo: ${fromName || "New Message"}`, {
        body: msg.content,
        icon: "/favicon.svg",
      });
    }
  };

  const clearNotifsFromSender = async (senderId) => {
    const toClear = notifications.filter(
      (n) => n.sender_id === senderId && !n.is_read
    );
    if (toClear.length === 0) return;
    setNotifications((prev) =>
      prev.map((n) => (n.sender_id === senderId ? { ...n, is_read: true } : n))
    );
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("sender_id", senderId)
      .eq("user_id", currentUser.id)
      .eq("is_read", false);
  };

  const markAllNotifsRead = async () => {
    if (unreadCount === 0) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", currentUser.id)
      .eq("is_read", false);
  };

  // --- LIFECYCLE & FOCUS ---
  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      if (Notification.permission === "default") Notification.requestPermission();
    }
    init();

    const onFocus = () => setIsFocused(true);
    const onBlur = () => setIsFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    loadProfile();
    loadUsers();
    loadNotifications();
  }, [currentUser]);

  // --- NOTIFICATIONS REALTIME ---
  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel(`notifications:${currentUser.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${currentUser.id}`,
        },
        (payload) => {
          const notif = payload.new;
          setNotifications((prev) => [notif, ...prev]);

          const openChatId = selectedUserRef.current
            ? [currentUser.id, selectedUserRef.current.id].sort().join("_")
            : null;
          const chatIsActive =
            isFocusedRef.current && openChatId === notif.chat_id;

          if (!chatIsActive) {
            triggerNotification({ content: notif.body }, notif.title);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  // --- CHAT MESSAGES REALTIME ---
  useEffect(() => {
    if (!chatId) return;
    loadMessages();

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMsg = payload.new;
          setMessages((prev) => [...prev.filter((m) => m.id !== newMsg.id), newMsg]);

          if (newMsg.receiver_id === currentUser.id && isFocused) {
            markAsRead(newMsg.id);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === payload.new.id ? payload.new : m))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId, isFocused]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- DATA FETCHING ---
  async function loadProfile() {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();
    if (data) setProfile(data);
  }

  async function loadUsers() {
    const { data } = await supabase.from("profiles").select("*").neq("id", currentUser.id);
    if (data) setUsers(data);
  }

  async function loadNotifications() {
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", currentUser.id)
      .order("created_at", { ascending: false })
      .limit(30);
    if (data) setNotifications(data);
  }

  async function loadMessages() {
    setLoadingChat(true);
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (data) {
      setMessages(data);
      data.forEach((m) => {
        if (m.receiver_id === currentUser.id && !m.is_read) markAsRead(m.id);
      });
    }
    setLoadingChat(false);
  }

  // --- ACTIONS ---
  function openChat(user) {
    setSelectedUser(user);
    setShowGiphy(false);
    clearNotifsFromSender(user.id);
  }

  // shared insert helper — used by both text and GIF sends
  async function insertMessage(content, type) {
    if (!chatId || !selectedUser) return;
    await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: currentUser.id,
      receiver_id: selectedUser.id,
      content,
      type,
      is_read: false,
    });
  }

  async function sendMessage(e) {
    e.preventDefault();
    const text = messageText.trim();
    if (!text) return;
    setMessageText("");
    await insertMessage(text, "text");
  }

  async function sendGif(gifUrl) {
    setShowGiphy(false);
    setGiphySearch("");
    setGiphyResults([]);
    await insertMessage(gifUrl, "image");
  }

  // --- GIPHY ---
  async function searchGiphy(e) {
    e?.preventDefault();
    const q = giphySearch.trim();
    if (!GIPHY_API_KEY) {
      alert("GIPHY API key is missing. Add VITE_GIPHY_API_KEY in Vercel.");
      return;
    }
    setGiphyLoading(true);
    try {
      const endpoint = q
        ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(
            q
          )}&limit=18&rating=pg`
        : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=18&rating=pg`;
      const res = await fetch(endpoint);
      const json = await res.json();
      setGiphyResults(json.data || []);
    } catch (err) {
      alert("Couldn't load GIFs: " + err.message);
    }
    setGiphyLoading(false);
  }

  function toggleGiphy() {
    const next = !showGiphy;
    setShowGiphy(next);
    if (next && giphyResults.length === 0) {
      // preload trending GIFs when the panel first opens
      searchGiphy();
    }
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthLoading(true);
    const email = `${auth.username}@wavo.app`;
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password: auth.password,
        });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: auth.password,
        });
        if (error) throw error;
        await supabase.from("profiles").insert({ id: data.user.id, username: auth.username });
        setMode("login");
      }
    } catch (err) {
      alert(err.message);
    }
    setAuthLoading(false);
  }

  // --- TIME FORMATTING ---
  const fmtTime = (ts) =>
    new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const fmtRelative = (ts) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  // --- AUTH SCREEN ---
  if (!session) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="logo-mark">W</div>
          <h1>Wavo</h1>
          <form onSubmit={handleAuth} className="auth-form">
            <input
              type="text"
              placeholder="Username"
              value={auth.username}
              onChange={(e) => setAuth({ ...auth, username: e.target.value })}
            />
            <input
              type="password"
              placeholder="Password"
              value={auth.password}
              onChange={(e) => setAuth({ ...auth, password: e.target.value })}
            />
            <button disabled={authLoading}>
              {authLoading ? "Please wait…" : mode === "login" ? "Login" : "Sign Up"}
            </button>
          </form>
          <button
            className="link-btn"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
          >
            {mode === "login" ? "New here? Create an account" : "Already have an account? Login"}
          </button>
        </div>
      </main>
    );
  }

  // --- MAIN APP ---
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <h2>Wavo</h2>
          <div className="brand-actions">
            <div className="notif-wrap">
              <button
                className="icon-btn"
                onClick={() => setShowNotifs((s) => !s)}
                aria-label="Notifications"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="notif-dot">{unreadCount > 9 ? "9+" : unreadCount}</span>
                )}
              </button>

              {showNotifs && (
                <div className="notif-panel">
                  <div className="notif-panel-head">
                    <strong>Notifications</strong>
                    {unreadCount > 0 && (
                      <button className="link-btn-sm" onClick={markAllNotifsRead}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="notif-list">
                    {notifications.length === 0 && (
                      <div className="notif-empty">Nothing yet</div>
                    )}
                    {notifications.map((n) => (
                      <div
                        key={n.id}
                        className={`notif-item ${n.is_read ? "" : "unread"}`}
                      >
                        <div className="notif-item-top">
                          <strong>{n.title}</strong>
                          <span>{fmtRelative(n.created_at)}</span>
                        </div>
                        {n.body && <p>{n.body}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button className="ghost-btn" onClick={() => supabase.auth.signOut()}>
              Logout
            </button>
          </div>
        </div>
        <div className="user-list">
          {users.map((u) => (
            <button
              key={u.id}
              className={`user-row ${selectedUser?.id === u.id ? "active" : ""}`}
              onClick={() => openChat(u)}
            >
              <div className="avatar">{initial(u.username)}</div>
              <strong>{u.username}</strong>
              {unreadByUser[u.id] > 0 && (
                <span className="user-badge">{unreadByUser[u.id]}</span>
              )}
            </button>
          ))}
        </div>
      </aside>

      <section className="chat">
        {selectedUser ? (
          <>
            <header className="chat-header">
              <h3>{selectedUser.username}</h3>
              <div className="status-pill">Live</div>
            </header>
            <div className="messages">
              {messages.map((msg) => {
                const mine = msg.sender_id === currentUser.id;
                const isImage = msg.type === "image";
                return (
                  <div key={msg.id} className={`bubble-wrap ${mine ? "mine" : "theirs"}`}>
                    <div className={`bubble ${isImage ? "bubble-image" : ""}`}>
                      {isImage ? (
                        <img
                          className="msg-image"
                          src={msg.content}
                          alt="GIF"
                          loading="lazy"
                        />
                      ) : (
                        <p>{msg.content}</p>
                      )}
                      <div className="msg-footer">
                        <span>{fmtTime(msg.created_at)}</span>
                        {mine && (
                          <span className={`receipt ${msg.is_read ? "read" : ""}`}>
                            {msg.is_read
                              ? msg.read_at
                                ? `Read ${fmtTime(msg.read_at)}`
                                : "✓✓"
                              : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {showGiphy && (
              <div className="giphy-panel">
                <form className="giphy-search" onSubmit={searchGiphy}>
                  <Search size={15} />
                  <input
                    value={giphySearch}
                    onChange={(e) => setGiphySearch(e.target.value)}
                    placeholder="Search GIFs…"
                    autoFocus
                  />
                  <button type="submit">Search</button>
                </form>
                <div className="giphy-grid">
                  {giphyLoading && <div className="giphy-status">Loading…</div>}
                  {!giphyLoading && giphyResults.length === 0 && (
                    <div className="giphy-status">No GIFs found</div>
                  )}
                  {!giphyLoading &&
                    giphyResults.map((g) => (
                      <button
                        key={g.id}
                        className="giphy-thumb"
                        onClick={() => sendGif(g.images.fixed_height.url)}
                      >
                        <img
                          src={g.images.fixed_width_small.url}
                          alt={g.title || "GIF"}
                          loading="lazy"
                          width={g.images.fixed_width_small.width}
                          height={g.images.fixed_width_small.height}
                        />
                      </button>
                    ))}
                </div>
              </div>
            )}

            <form className="composer" onSubmit={sendMessage}>
              <button
                type="button"
                className={`composer-icon ${showGiphy ? "active" : ""}`}
                onClick={toggleGiphy}
                aria-label="Send a GIF"
              >
                {showGiphy ? <X size={18} /> : <ImageIcon size={18} />}
              </button>
              <input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Type a message…"
              />
              <button>Send</button>
            </form>
          </>
        ) : (
          <div className="empty-chat">
            <h1>Select a friend to start Wavo-ing</h1>
          </div>
        )}
      </section>
    </main>
  );
}