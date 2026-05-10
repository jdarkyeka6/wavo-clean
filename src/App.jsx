import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "./supabaseClient";
import "./styles.css";

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

  const bottomRef = useRef(null);
  const currentUser = session?.user;

  const chatId = useMemo(() => {
    if (!currentUser || !selectedUser) return null;
    return [currentUser.id, selectedUser.id].sort().join("_");
  }, [currentUser, selectedUser]);

  function usernameToEmail(username) {
    return `${username.trim().toLowerCase()}@wavo.app`;
  }

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
    }

    init();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setProfile(null);
      setUsers([]);
      setSelectedUser(null);
      setMessages([]);
      return;
    }

    loadProfile();
    loadUsers();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    const channel = supabase
      .channel("profiles-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "profiles",
        },
        () => {
          loadUsers();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser]);

  useEffect(() => {
    if (!chatId) return;

    loadMessages();

    const channel = supabase
      .channel(`messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((msg) => msg.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chatId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function loadProfile() {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUser.id)
      .single();

    if (!error) setProfile(data);
  }

  async function loadUsers() {
    if (!currentUser) return;

    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, created_at")
      .neq("id", currentUser.id)
      .order("username", { ascending: true });

    if (error) {
      console.error("Load users error:", error.message);
      return;
    }

    setUsers(data ?? []);
  }

  async function loadMessages() {
    if (!chatId) return;

    setLoadingChat(true);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Load messages error:", error.message);
      setLoadingChat(false);
      return;
    }

    setMessages(data ?? []);
    setLoadingChat(false);
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthLoading(true);

    const username = auth.username.trim().toLowerCase();
    const password = auth.password;
    const fakeEmail = usernameToEmail(username);

    try {
      if (!username) throw new Error("Username is required.");
      if (!/^[a-z0-9_]{3,20}$/.test(username)) {
        throw new Error("Username must be 3-20 characters: letters, numbers, underscores only.");
      }
      if (!password || password.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }

      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: fakeEmail,
          password,
        });

        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: fakeEmail,
          password,
        });

        if (error) throw error;

        if (data.user) {
          const { error: profileError } = await supabase.from("profiles").insert({
            id: data.user.id,
            username,
          });

          if (profileError) throw profileError;
        }

        alert("Account created. Now log in.");
        setMode("login");
      }
    } catch (err) {
      alert(err.message);
    }

    setAuthLoading(false);
  }

  async function sendMessage(e) {
    e.preventDefault();

    const clean = messageText.trim();
    if (!clean || !chatId || !currentUser || !selectedUser) return;

    setMessageText("");

    const { error } = await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: currentUser.id,
      receiver_id: selectedUser.id,
      content: clean,
    });

    if (error) {
      alert(error.message);
      setMessageText(clean);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  if (!session) {
    return (
      <main className="auth-page">
        <section className="auth-card">
          <div className="logo-mark">W</div>
          <h1>Wavo</h1>
          <p className="muted">Username. Password. Message. No email nonsense.</p>

          <form onSubmit={handleAuth} className="auth-form">
            <input
              type="text"
              placeholder="Username"
              value={auth.username}
              onChange={(e) => setAuth({ ...auth, username: e.target.value })}
              autoComplete="username"
              required
            />

            <input
              type="password"
              placeholder="Password"
              value={auth.password}
              onChange={(e) => setAuth({ ...auth, password: e.target.value })}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />

            <button disabled={authLoading}>
              {authLoading ? "Working..." : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <button className="link-btn" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? "Need an account? Sign up" : "Already have an account? Log in"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <div>
            <h2>Wavo</h2>
            <p>@{profile?.username || "loading"}</p>
          </div>

          <button className="ghost-btn" onClick={logout}>
            Logout
          </button>
        </div>

        <div className="search-note">Chats</div>

        <div className="user-list">
          {users.length === 0 && <p className="empty-mini">No other users yet.</p>}

          {users.map((u) => (
            <button
              key={u.id}
              className={`user-row ${selectedUser?.id === u.id ? "active" : ""}`}
              onClick={() => setSelectedUser(u)}
            >
              <div className="avatar">{u.username?.[0]?.toUpperCase() || "?"}</div>
              <div>
                <strong>{u.username}</strong>
                <span>Tap to message</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <section className="chat">
        {!selectedUser ? (
          <div className="empty-chat">
            <div className="big-icon">💬</div>
            <h1>Pick a chat</h1>
            <p>Clean. Simple. Actually works.</p>
          </div>
        ) : (
          <>
            <header className="chat-header">
              <div className="chat-title">
                <div className="avatar small">{selectedUser.username?.[0]?.toUpperCase() || "?"}</div>
                <div>
                  <h3>{selectedUser.username}</h3>
                  <p>Realtime chat</p>
                </div>
              </div>

              <div className="status-pill">Live</div>
            </header>

            <div className="messages">
              {loadingChat && <p className="empty-mini">Loading messages...</p>}

              {!loadingChat && messages.length === 0 && (
                <div className="first-message">
                  <h2>No messages yet</h2>
                  <p>Send the first Wavo.</p>
                </div>
              )}

              {messages.map((msg) => {
                const mine = msg.sender_id === currentUser.id;

                return (
                  <div key={msg.id} className={`bubble-wrap ${mine ? "mine" : "theirs"}`}>
                    <div className="bubble">
                      <p>{msg.content}</p>
                      <span>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                );
              })}

              <div ref={bottomRef} />
            </div>

            <form className="composer" onSubmit={sendMessage}>
              <input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={`Message ${selectedUser.username}`}
              />

              <button disabled={!messageText.trim()}>Send</button>
            </form>
          </>
        )}
      </section>
    </main>
  );
}