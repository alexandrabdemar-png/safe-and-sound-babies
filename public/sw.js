// Minimal service worker for Web Push recall alerts. Registered from
// src/lib/webPush.ts (subscribeToWebPush()) — this file only needs to
// handle 'push' (show the notification) and 'notificationclick' (route the
// tap back into the app). It doesn't do any asset caching/offline work,
// which this app doesn't otherwise use.

self.addEventListener("push", (event) => {
  let payload = { title: "Safe & Sound Babies", body: "You have a new alert." };
  try {
    if (event.data) payload = event.data.json();
  } catch {
    // Non-JSON payload (shouldn't happen — the sender always sends JSON) — fall back to the default above.
  }

  const { title, body, data } = payload;
  event.waitUntil(
    self.registration.showNotification(title || "Safe & Sound Babies", {
      body: body || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: data || {},
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.type === "recall" ? "/recalls" : "/";

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of allClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(targetUrl);
          return;
        }
      }
      await self.clients.openWindow(targetUrl);
    })(),
  );
});
