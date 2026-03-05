"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff } from "lucide-react";

// Converts a base64 URL-safe string to a Uint8Array (required by PushManager)
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

type Status = "idle" | "checking" | "unsupported" | "subscribed" | "denied" | "unsubscribed";

export function NotificationSetup() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => {
        setStatus(sub ? "subscribed" : "unsubscribed");
      })
      .catch(() => setStatus("idle"));
  }, []);

  async function subscribe() {
    setStatus("checking");
    try {
      const res = await fetch("/api/notifications/vapid-public-key");
      if (!res.ok) throw new Error("VAPID key unavailable");
      const { publicKey } = (await res.json()) as { publicKey: string };

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const json = sub.toJSON();
      await fetch("/api/notifications/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: json.keys,
        }),
      });

      setStatus("subscribed");
    } catch {
      setStatus(Notification.permission === "denied" ? "denied" : "unsubscribed");
    }
  }

  async function unsubscribe() {
    setStatus("checking");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/notifications/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("unsubscribed");
    } catch {
      setStatus("unsubscribed");
    }
  }

  if (status === "unsupported" || status === "checking") return null;

  if (status === "denied") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground" title="Notifications blocked in browser settings">
        <BellOff className="h-3.5 w-3.5" />
        Notifications blocked
      </span>
    );
  }

  if (status === "subscribed") {
    return (
      <button
        onClick={unsubscribe}
        title="Disable push notifications"
        className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-green-400 hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        <Bell className="h-3.5 w-3.5" />
        Notifications on
      </button>
    );
  }

  // unsubscribed / idle
  return (
    <button
      onClick={subscribe}
      title="Enable daily reminders (8 am check-in, 4 pm trading)"
      className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
    >
      <Bell className="h-3.5 w-3.5" />
      Enable reminders
    </button>
  );
}
