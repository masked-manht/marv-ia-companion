import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [checking, setChecking] = useState(false);
  const toastShownRef = useRef(false);

  const playNotificationSound = useCallback(() => {
    try {
      const audio = new Audio("/notification.mp3");
      audio.volume = 0.7;
      audio.play().catch(() => {});
    } catch { /* ignore */ }
  }, []);

  const showUpdateToast = useCallback(() => {
    if (toastShownRef.current) return;
    toastShownRef.current = true;
    playNotificationSound();
    toast.error("⚠️ Nouvelle mise à jour disponible !", {
      description: "Appuyez sur Installer pour mettre à jour maintenant.",
      duration: Infinity,
      action: {
        label: "Installer",
        onClick: () => {
          navigator.serviceWorker.getRegistration().then((reg) => {
            if (reg?.waiting) {
              reg.waiting.postMessage("SKIP_WAITING");
            } else {
              // Force reload if no waiting worker
              window.location.reload();
            }
          });
        },
      },
    });
  }, [playNotificationSound]);

  const sendUpdateNotification = useCallback(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification("Marv-IA ⚠️", {
          body: "Nouvelle mise à jour disponible ! Ouvrez l'app pour installer.",
          icon: "/marvia-icon.png",
          badge: "/marvia-icon.png",
          tag: "marvia-update",
          renotify: true,
          requireInteraction: true,
          vibrate: [200, 100, 200],
        } as any);
      }).catch(() => {});
    }
  }, []);

  const handleNewWorker = useCallback((reg: ServiceWorkerRegistration) => {
    setUpdateAvailable(true);
    setRegistration(reg);
    showUpdateToast();
    sendUpdateNotification();
  }, [showUpdateToast, sendUpdateNotification]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let pollTimer: ReturnType<typeof setInterval>;

    navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).then((reg) => {
      setRegistration(reg);

      if (reg.waiting) {
        handleNewWorker(reg);
      }

      // Force check on load
      reg.update().catch(() => {});

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            handleNewWorker(reg);
          }
        });
      });

      // Poll every 30s for updates (catches missed realtime events)
      pollTimer = setInterval(() => {
        reg.update().catch(() => {});
      }, 30_000);
    }).catch((err) => {
      console.warn("SW registration failed:", err);
    });

    // When user clicks "Installer", the new SW activates and controllerchange fires
    // We reload ONLY when the user has explicitly triggered the update
    let userTriggeredUpdate = false;
    const onControllerChange = () => {
      if (!userTriggeredUpdate) return;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    // Expose trigger for applyUpdate
    (window as any).__marviaUserTriggeredUpdate = () => { userTriggeredUpdate = true; };

    return () => {
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [handleNewWorker]);

  const applyUpdate = useCallback(() => {
    if (registration?.waiting) {
      registration.waiting.postMessage("SKIP_WAITING");
    } else {
      // No waiting worker — force hard reload
      if ("caches" in window) {
        caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => {
          globalThis.location.reload();
        });
      } else {
        globalThis.location.reload();
      }
    }
  }, [registration]);

  const checkForUpdate = useCallback(async () => {
    setChecking(true);
    toastShownRef.current = false;
    try {
      const reg = registration || await navigator.serviceWorker.getRegistration();
      if (!reg) return false;

      setRegistration(reg);
      await reg.update();
      // Brief wait for statechange to fire
      await new Promise((r) => setTimeout(r, 500));

      const hasUpdate = !!reg.waiting;
      setUpdateAvailable(hasUpdate);
      if (hasUpdate) {
        showUpdateToast();
        sendUpdateNotification();
      }
      return hasUpdate;
    } catch {
      return false;
    } finally {
      setChecking(false);
    }
  }, [registration, showUpdateToast, sendUpdateNotification]);

  return { updateAvailable, checking, checkForUpdate, applyUpdate };
}
