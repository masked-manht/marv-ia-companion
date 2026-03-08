import { useState, useEffect, useCallback } from "react";

export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      setRegistration(reg);

      // Detect waiting worker = update available
      if (reg.waiting) {
        setUpdateAvailable(true);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
            // Send notification
            if (Notification.permission === "granted") {
              reg.showNotification("Marv-IA", {
                body: "Une nouvelle version est disponible ! Mettez à jour dans les paramètres.",
                icon: "/marvia-icon.png",
                badge: "/marvia-icon.png",
              });
            }
          }
        });
      });
    });

    // Listen for controller change = update applied
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (!registration) return false;
    setChecking(true);
    try {
      await registration.update();
      // After update(), check if there's a waiting worker
      await new Promise((r) => setTimeout(r, 1000));
      const hasUpdate = !!registration.waiting;
      setUpdateAvailable(hasUpdate);
      return hasUpdate;
    } catch {
      return false;
    } finally {
      setChecking(false);
    }
  }, [registration]);

  const applyUpdate = useCallback(() => {
    if (!registration?.waiting) return;
    registration.waiting.postMessage("SKIP_WAITING");
  }, [registration]);

  return { updateAvailable, checking, checkForUpdate, applyUpdate };
}
