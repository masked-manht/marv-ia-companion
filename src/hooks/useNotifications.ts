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

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch { /* ignore */ }
  }, []);

  const sendLocalNotification = useCallback((title: string, body: string) => {
    if (permission !== "granted") return;
    
    playNotificationSound();
    
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: "/marvia-icon.png",
        badge: "/marvia-icon.png",
      } as any);
    }).catch(() => {
      new Notification(title, { body, icon: "/marvia-icon.png" });
    });
  }, [permission, playNotificationSound]);

  return { permission, supported, requestPermission, sendLocalNotification };
}
