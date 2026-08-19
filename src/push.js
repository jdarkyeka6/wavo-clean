// Push notification helpers — handles the browser push registration flow.
// Called from App.jsx after login.

import { supabase } from "./supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || "";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export function pushSupported() {
  return (
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn("[wavo] SW register failed:", err);
    return null;
  }
}

export async function ensureNotificationPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

// Subscribe to Web Push and claim this browser subscription for the currently
// authenticated Wavo user. Registration goes through a narrow server-side RPC
// instead of a direct table upsert so the same browser can safely switch Wavo
// accounts without an old push row causing a row-level-security failure.
export async function subscribeToPush(userId) {
  if (!userId) return null;
  if (!pushSupported()) {
    console.info("[wavo] Push not supported in this browser");
    return null;
  }
  if (!VAPID_PUBLIC_KEY) {
    console.info("[wavo] VITE_VAPID_PUBLIC_KEY not set — skipping push subscribe");
    return null;
  }
  if (Notification.permission !== "granted") return null;

  const reg = await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const subscription = sub.toJSON();
  const { error } = await supabase.rpc("claim_web_push_subscription", {
    p_subscription: subscription,
    p_user_agent: navigator.userAgent.slice(0, 200),
  });

  if (error) {
    console.warn("[wavo] Failed to save push subscription:", error);
    return null;
  }

  return sub;
}

export async function unsubscribeFromPush() {
  if (!("serviceWorker" in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
}
