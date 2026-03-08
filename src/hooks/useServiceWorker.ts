import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";

export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [checking, setChecking] = useState(false);

  const showUpdateToast = () => {
    toast("⚠️ Nouvelle mise à jour disponible !", {
      description: "Rendez-vous dans Paramètres → Technique → Installer la mise à jour.",
      duration: 10000,
      action: {
        label: "OK",
        onClick: () => {},
      },
    });
  };

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      setRegistration(reg);

      if (reg.waiting) {
        setUpdateAvailable(true);
        sendUpdateNotification();
        showUpdateToast();
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
            sendUpdateNotification();
            showUpdateToast();
          }
        });
      });
    });

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }, []);

  const sendUpdateNotification = () => {
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
  };

  const applyUpdate = useCallback(() => {
    if (!registration?.waiting) return;
    registration.waiting.postMessage("SKIP_WAITING");
  }, [registration]);

  const checkForUpdate = useCallback(async () => {
    if (!registration) return false;
    setChecking(true);
    try {
      await registration.update();
      await new Promise((r) => setTimeout(r, 1500));
      const hasUpdate = !!registration.waiting;
      setUpdateAvailable(hasUpdate);
      if (hasUpdate) sendUpdateNotification();
      return hasUpdate;
    } catch {
      return false;
    } finally {
      setChecking(false);
    }
  }, [registration]);

  return { updateAvailable, checking, checkForUpdate, applyUpdate };
}
