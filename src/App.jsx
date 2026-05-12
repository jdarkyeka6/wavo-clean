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

  // New states for GIF and file features
  const [showGiphy, setShowGiphy] = useState(false);
  const [giphySearch, setGiphySearch] = useState("");
  const [giphyResults, setGiphyResults] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const fileInputRef = useRef(null);

  const bottomRef = useRef(null);
  const currentUser = session?.user;

  // Your GIPHY API key - replace with your actual key
  const GIPHY_API_KEY = "YOUR_GIPHY_API_KEY_HERE";

  const chatId = useMemo(() => {
    if (!currentUser || !selectedUser) return null;
    return [currentUser.id, selectedUser.id].sort().join("_");
  }, [currentUser, selectedUser]);

  function usernameToEmail(username) {
    return `${username.trim().toLowerCase()}@wavo.app`;
  }

  // GIPHY search function
  const searchGiphy = async (searchTerm) => {
    if (!searchTerm) return;
    setIsLoadingGifs(true);
    try {
      const response = await fetch(
        `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchTerm)}&limit=12&rating=r`
      );
      const data = await response.json();
      setGiphyResults(data.data);
    } catch (error) {
      console.error("GIPHY search failed:", error);
    } finally {
      setIsLoadingGifs(false);
    }
  };

  // Select a GIF and add to message
  const selectGif = (gifUrl) => {
    setMessageText(prev => prev + (prev ? " " : "") + gifUrl);
    setShowGiphy(false);
    setGiphySearch("");
  };

  // Handle file attachment
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = files.filter(file => file.size <= 10 * 1024 * 1024);
    
    if (validFiles.length !== files.length) {
      alert("Some files are too large! Max 10MB each");
    }
    
    setAttachments(prev => [...prev, ...validFiles]);
  };

  const removeAttachment = (index) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Convert file to base64 for preview/sending
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

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
    if ((!clean && attachments.length === 0) || !chatId || !currentUser || !selectedUser) return;

    // Handle attachments - convert to text links or store separately
    let attachmentText = "";
    if (attachments.length > 0) {
      const attachmentUrls = await Promise.all(
        attachments.map(async (file) => {
          const base64 = await fileToBase64(file);
          return `[FILE: ${file.name} (${(file.size / 1024).toFixed(1)}KB)] ${base64.substring(0, 100)}...`;
        })
      );
      attachmentText = "\n" + attachmentUrls.join("\n");
    }

    const fullMessage = clean + attachmentText;
    
    setMessageText("");
    setAttachments([]);
    setShowGiphy(false);

    const { error } = await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: currentUser.id,
      receiver_id: selectedUser.id,
      content: fullMessage || "📎 File attached",
    });

    if (error) {
      alert(error.message);
      setMessageText(clean);
      setAttachments(attachments);
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
                // Check if message contains GIF or FILE
                const hasGif = msg.content?.includes("giphy.com/media/");
                const hasFile = msg.content?.startsWith("[FILE:");

                return (
                  <div key={msg.id} className={`bubble-wrap ${mine ? "mine" : "theirs"}`}>
                    <div className="bubble">
                      {hasGif ? (
                        <img src={msg.content} alt="GIF" className="message-gif" />
                      ) : hasFile ? (
                        <div className="file-message">
                          <span>📎</span>
                          <p className="file-name">{msg.content.split("]")[0]?.replace("[FILE:", "")}</p>
                          <small>File shared</small>
                        </div>
                      ) : (
                        <p>{msg.content}</p>
                      )}
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
              <div className="composer-actions">
                <button type="button" className="action-btn" onClick={() => setShowGiphy(!showGiphy)} title="Add GIF">
                  🎬
                </button>
                <button type="button" className="action-btn" onClick={() => fileInputRef.current?.click()} title="Attach file">
                  📎
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  style={{ display: "none" }}
                />
              </div>
              
              <input
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder={`Message ${selectedUser.username}`}
              />

              <button disabled={!messageText.trim() && attachments.length === 0}>
                Send
              </button>
            </form>

            {/* Attachment previews */}
            {attachments.length > 0 && (
              <div className="attachment-previews">
                {attachments.map((file, idx) => (
                  <div key={idx} className="attachment-pill">
                    <span>📎 {file.name} ({(file.size / 1024).toFixed(1)}KB)</span>
                    <button type="button" onClick={() => removeAttachment(idx)}>×</button>
                  </div>
                ))}
              </div>
            )}

            {/* GIPHY panel */}
            {showGiphy && (
              <div className="giphy-panel">
                <div className="giphy-search">
                  <input
                    type="text"
                    placeholder="Search GIFs..."
                    value={giphySearch}
                    onChange={(e) => setGiphySearch(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && searchGiphy(giphySearch)}
                  />
                  <button onClick={() => searchGiphy(giphySearch)} disabled={isLoadingGifs}>
                    {isLoadingGifs ? "..." : "Search"}
                  </button>
                </div>
                <div className="giphy-results">
                  {giphyResults.map((gif) => (
                    <button key={gif.id} onClick={() => selectGif(gif.images.fixed_height_small.url)}>
                      <img src={gif.images.fixed_height_small.url} alt={gif.title} />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}