import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [checking, setChecking] = useState(false);
  const toastShownRef = useRef(false);

  const showUpdateToast = useCallback(() => {
    if (toastShownRef.current) return;
    toastShownRef.current = true;
    toast("⚠️ Nouvelle mise à jour disponible !", {
      description: "Rendez-vous dans Paramètres → Technique → Installer la mise à jour.",
      duration: 10000,
      action: {
        label: "OK",
        onClick: () => {},
      },
    });
  }, []);

  const sendUpdateNotification = useCallback(() => {
    if ("Notification" in window && Notification.permission === "granted") {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification("Marv-IA", {
          body: "⚠️ Une nouvelle mise à jour est disponible ! Ouvrez les paramètres pour l'installer.",
          icon: "/marvia-icon.png",
          badge: "/marvia-icon.png",
          tag: "marvia-update",
          renotify: true,
        } as any);
      }).catch(() => {
        try {
          new Notification("Marv-IA", {
            body: "⚠️ Une nouvelle mise à jour est disponible !",
            icon: "/marvia-icon.png",
          });
        } catch { /* ignore */ }
      });
    }
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Register SW if not already registered
    navigator.serviceWorker.register("/sw.js").then((reg) => {
      setRegistration(reg);

      // Check if there's already a waiting worker
      if (reg.waiting) {
        setUpdateAvailable(true);
        showUpdateToast();
        sendUpdateNotification();
      }

      // Listen for new service worker installations
      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
            showUpdateToast();
            sendUpdateNotification();
          }
        });
      });
    }).catch((err) => {
      console.warn("SW registration failed:", err);
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }, [showUpdateToast, sendUpdateNotification]);

  const applyUpdate = useCallback(() => {
    if (!registration?.waiting) return;
    registration.waiting.postMessage("SKIP_WAITING");
  }, [registration]);

  const checkForUpdate = useCallback(async () => {
    if (!registration) {
      // No SW registered yet, try to get one
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          setRegistration(reg);
          await reg.update();
        }
      } catch { /* ignore */ }
      return false;
    }

    setChecking(true);
    toastShownRef.current = false; // Allow toast to show again on manual check
    try {
      await registration.update();
      // Wait for updatefound to trigger
      await new Promise((r) => setTimeout(r, 2000));
      const hasUpdate = !!registration.waiting;
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
