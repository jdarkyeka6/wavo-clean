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
  const [isFocused, setIsFocused] = useState(true);

  // GIPHY and File states
  const [showGiphy, setShowGiphy] = useState(false);
  const [giphySearch, setGiphySearch] = useState("");
  const [giphyResults, setGiphyResults] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [isLoadingGifs, setIsLoadingGifs] = useState(false);
  const fileInputRef = useRef(null);
  const bottomRef = useRef(null);
  
  const currentUser = session?.user;
  const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY;

  const chatId = useMemo(() => {
    if (!currentUser || !selectedUser) return null;
    return [currentUser.id, selectedUser.id].sort().join("_");
  }, [currentUser, selectedUser]);

  // --- UTILITIES ---
  const markAsRead = async (msgId) => {
    await supabase.from("messages").update({ is_read: true }).eq("id", msgId);
  };

  const triggerNotification = (msg) => {
    if (Notification.permission === "granted") {
      new Notification(`Wavo: ${selectedUser?.username || 'New Message'}`, {
        body: msg.content,
        icon: "/logo.png" 
      });
    }
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
  }, [currentUser]);

  // --- REALTIME ENGINE ---
  useEffect(() => {
    if (!chatId) return;
    loadMessages();

    const channel = supabase
      .channel(`chat:${chatId}`)
      .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          const newMsg = payload.new;
          setMessages((prev) => [...prev.filter(m => m.id !== newMsg.id), newMsg]);

          if (newMsg.receiver_id === currentUser.id) {
            if (isFocused) markAsRead(newMsg.id);
            else triggerNotification(newMsg);
          }
        }
      )
      .on("postgres_changes", {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          setMessages((prev) => prev.map(m => m.id === payload.new.id ? payload.new : m));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId, isFocused]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- DATA FETCHING ---
  async function loadProfile() {
    const { data } = await supabase.from("profiles").select("*").eq("id", currentUser.id).single();
    if (data) setProfile(data);
  }

  async function loadUsers() {
    const { data } = await supabase.from("profiles").select("*").neq("id", currentUser.id);
    if (data) setUsers(data);
  }

  async function loadMessages() {
    setLoadingChat(true);
    const { data } = await supabase.from("messages").select("*").eq("chat_id", chatId).order("created_at", { ascending: true });
    if (data) {
      setMessages(data);
      data.forEach(m => {
        if (m.receiver_id === currentUser.id && !m.is_read) markAsRead(m.id);
      });
    }
    setLoadingChat(false);
  }

  // --- ACTIONS ---
  async function sendMessage(e) {
    e.preventDefault();
    if (!messageText.trim() && attachments.length === 0) return;

    const content = messageText;
    setMessageText("");
    
    await supabase.from("messages").insert({
      chat_id: chatId,
      sender_id: currentUser.id,
      receiver_id: selectedUser.id,
      content: content,
      is_read: false
    });
  }

  async function handleAuth(e) {
    e.preventDefault();
    setAuthLoading(true);
    const email = `${auth.username}@wavo.app`;
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: auth.password });
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password: auth.password });
        if (error) throw error;
        await supabase.from("profiles").insert({ id: data.user.id, username: auth.username });
        setMode("login");
      }
    } catch (err) { alert(err.message); }
    setAuthLoading(false);
  }

  if (!session) {
    return (
      <main className="auth-page">
        <div className="auth-card">
          <div className="logo-mark">W</div>
          <h1>Wavo</h1>
          <form onSubmit={handleAuth} className="auth-form">
            <input type="text" placeholder="Username" onChange={e => setAuth({...auth, username: e.target.value})} />
            <input type="password" placeholder="Password" onChange={e => setAuth({...auth, password: e.target.value})} />
            <button>{mode === "login" ? "Login" : "Sign Up"}</button>
          </form>
          <button className="link-btn" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}>
            Switch to {mode === 'login' ? 'Signup' : 'Login'}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-row">
          <h2>Wavo</h2>
          <button className="ghost-btn" onClick={() => supabase.auth.signOut()}>Logout</button>
        </div>
        <div className="user-list">
          {users.map(u => (
            <button key={u.id} className={`user-row ${selectedUser?.id === u.id ? 'active' : ''}`} onClick={() => setSelectedUser(u)}>
              <div className="avatar">{u.username[0].toUpperCase()}</div>
              <strong>{u.username}</strong>
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
              {messages.map(msg => (
                <div key={msg.id} className={`bubble-wrap ${msg.sender_id === currentUser.id ? 'mine' : 'theirs'}`}>
                  <div className="bubble">
                    <p>{msg.content}</p>
                    <div className="msg-footer">
                      <span>{new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                      {msg.sender_id === currentUser.id && (
                        <span className={`receipt ${msg.is_read ? 'read' : ''}`}>
                          {msg.is_read ? " ✓✓" : " ✓"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
            <form className="composer" onSubmit={sendMessage}>
              <input value={messageText} onChange={e => setMessageText(e.target.value)} placeholder="Type a message..." />
              <button>Send</button>
            </form>
          </>
        ) : (
          <div className="empty-chat"><h1>Select a friend to start Wavo-ing</h1></div>
        )}
      </section>
    </main>
  );
}