// Custom service worker code — merged into the next-pwa workbox SW.
// Handles push notifications and notification click events.

declare const self: ServiceWorkerGlobalScope;

// ── Push event ────────────────────────────────────────────────────
self.addEventListener("push", (event: PushEvent) => {
  const data = event.data?.json() as {
    title?: string;
    body?: string;
    url?: string;
    tag?: string;
  } ?? {};

  const title = data.title ?? "Life OS";
  const options: NotificationOptions = {
    body: data.body ?? "",
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    tag: data.tag ?? "life-os",
    data: { url: data.url ?? "/dashboard" },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ── Notification click ────────────────────────────────────────────
self.addEventListener("notificationclick", (event: NotificationEvent) => {
  event.notification.close();
  const target: string = (event.notification.data as { url?: string })?.url ?? "/dashboard";

  event.waitUntil(
    (self.clients as Clients)
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windowClients) => {
        const existing = windowClients.find((c) => {
          const url = new URL(c.url);
          return url.pathname === new URL(target, self.location.href).pathname;
        });
        if (existing) return existing.focus();
        return (self.clients as Clients).openWindow(target);
      })
  );
});
