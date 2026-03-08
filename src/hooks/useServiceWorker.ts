import { useState, useEffect, useCallback } from "react";

export function useServiceWorker() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [checking, setChecking] = useState(false);

  const applyUpdate = useCallback((reg: ServiceWorkerRegistration) => {
    if (!reg?.waiting) return;
    reg.waiting.postMessage("SKIP_WAITING");
  }, []);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistration().then((reg) => {
      if (!reg) return;
      setRegistration(reg);

      // Auto-apply if update already waiting
      if (reg.waiting) {
        setUpdateAvailable(true);
        applyUpdate(reg);
      }

      reg.addEventListener("updatefound", () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            setUpdateAvailable(true);
            // Auto-apply update immediately
            applyUpdate(reg);
          }
        });
      });
    });

    // Reload when new service worker takes over
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      window.location.reload();
    });
  }, [applyUpdate]);

  const checkForUpdate = useCallback(async () => {
    if (!registration) return false;
    setChecking(true);
    try {
      await registration.update();
      await new Promise((r) => setTimeout(r, 1000));
      const hasUpdate = !!registration.waiting;
      setUpdateAvailable(hasUpdate);
      if (hasUpdate) applyUpdate(registration);
      return hasUpdate;
    } catch {
      return false;
    } finally {
      setChecking(false);
    }
  }, [registration, applyUpdate]);

  return { updateAvailable, checking, checkForUpdate, applyUpdate: () => registration && applyUpdate(registration) };
}
