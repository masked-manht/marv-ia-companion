import { useState, useEffect, useCallback } from "react";

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [supported] = useState(() => "Notification" in window && "serviceWorker" in navigator);

  const requestPermission = useCallback(async () => {
    if (!supported) return false;
    const result = await Notification.requestPermission();
    setPermission(result);
    return result === "granted";
  }, [supported]);

  const sendLocalNotification = useCallback((title: string, body: string) => {
    if (permission !== "granted") return;
    
    // Use service worker registration for persistent notifications
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: "/marvia-icon.png",
        badge: "/marvia-icon.png",
        vibrate: [100, 50, 100],
      });
    }).catch(() => {
      // Fallback to basic notification
      new Notification(title, { body, icon: "/marvia-icon.png" });
    });
  }, [permission]);

  return { permission, supported, requestPermission, sendLocalNotification };
}
