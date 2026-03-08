import React, { useState, useEffect } from "react";
import { MapPin, Camera, Bell, ChevronRight, Shield } from "lucide-react";

interface PermissionsRequestProps {
  onComplete: () => void;
}

type PermStep = "intro" | "location" | "camera" | "notifications" | "done";

export default function PermissionsRequest({ onComplete }: PermissionsRequestProps) {
  const [step, setStep] = useState<PermStep>("intro");
  const [locationStatus, setLocationStatus] = useState<"pending" | "granted" | "denied">("pending");
  const [cameraStatus, setCameraStatus] = useState<"pending" | "granted" | "denied">("pending");
  const [notifStatus, setNotifStatus] = useState<"pending" | "granted" | "denied">("pending");
  const [requesting, setRequesting] = useState(false);

  // Check existing permissions on mount
  useEffect(() => {
    (async () => {
      try {
        const geo = await navigator.permissions?.query({ name: "geolocation" });
        if (geo?.state === "granted") setLocationStatus("granted");
        else if (geo?.state === "denied") setLocationStatus("denied");
      } catch {}
      try {
        const cam = await navigator.permissions?.query({ name: "camera" as PermissionName });
        if (cam?.state === "granted") setCameraStatus("granted");
        else if (cam?.state === "denied") setCameraStatus("denied");
      } catch {}
      if ("Notification" in window) {
        if (Notification.permission === "granted") setNotifStatus("granted");
        else if (Notification.permission === "denied") setNotifStatus("denied");
      }
    })();
  }, []);

  const handleFinish = () => {
    localStorage.setItem("marvia-permissions-asked", "true");
    onComplete();
  };

  // Auto-advance if already granted
  const advanceTo = (next: PermStep) => {
    if (next === "location" && locationStatus === "granted") return advanceTo("camera");
    if (next === "camera" && cameraStatus === "granted") return advanceTo("notifications");
    if (next === "notifications" && notifStatus === "granted") return advanceTo("done");
    setStep(next);
  };

  const requestLocation = async () => {
    setRequesting(true);
    try {
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 15000, enableHighAccuracy: false, maximumAge: 60000 });
      });
      setLocationStatus("granted");
    } catch {
      setLocationStatus("denied");
    }
    setRequesting(false);
    advanceTo("camera");
  };

  const requestCamera = async () => {
    setRequesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(t => t.stop());
      setCameraStatus("granted");
    } catch {
      setCameraStatus("denied");
    }
    setRequesting(false);
    advanceTo("notifications");
  };

  const requestNotifications = async () => {
    setRequesting(true);
    if ("Notification" in window) {
      const result = await Notification.requestPermission();
      setNotifStatus(result === "granted" ? "granted" : "denied");
      if (result === "granted") {
        try {
          const reg = await navigator.serviceWorker.ready;
          reg.showNotification("Marv-IA", { body: "Notifications activées ! 🎉", icon: "/marvia-icon.png" } as any);
        } catch {
          try { new Notification("Marv-IA", { body: "Notifications activées ! 🎉", icon: "/marvia-icon.png" }); } catch {}
        }
      }
    }
    setRequesting(false);
    setStep("done");
  };

  const skipStep = (next: PermStep) => {
    advanceTo(next);
  };

  const StatusDot = ({ status }: { status: "pending" | "granted" | "denied" }) => (
    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
      status === "granted" ? "bg-green-500" : status === "denied" ? "bg-destructive" : "bg-muted-foreground/40"
    }`} />
  );

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-card rounded-2xl border border-border shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-primary/10 px-6 py-5 text-center">
          <div className="w-14 h-14 bg-primary/15 rounded-full flex items-center justify-center mx-auto mb-3">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h2 className="text-lg font-bold text-foreground">Autorisations</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Marv-IA a besoin de quelques accès pour fonctionner pleinement
          </p>
        </div>

        <div className="px-6 py-5">
          {step === "intro" && (
            <div className="space-y-3">
              <PermRow
                icon={<MapPin className="w-5 h-5" />}
                title="Position GPS"
                desc="Pour les recherches locales et la navigation"
                status={locationStatus}
              />
              <PermRow
                icon={<Camera className="w-5 h-5" />}
                title="Caméra"
                desc="Pour envoyer des photos et scanner des documents"
                status={cameraStatus}
              />
              <PermRow
                icon={<Bell className="w-5 h-5" />}
                title="Notifications"
                desc="Pour les mises à jour et rappels importants"
                status={notifStatus}
              />

              <button
                onClick={() => advanceTo("location")}
                className="w-full mt-4 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                Continuer
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={handleFinish}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Passer pour l'instant
              </button>
            </div>
          )}

          {step === "location" && (
            <PermPrompt
              icon={<MapPin className="w-8 h-8 text-primary" />}
              title="Accès à la position"
              desc="Permet à Marv-IA de vous localiser pour des résultats de recherche pertinents, la météo locale et la navigation."
              status={locationStatus}
              onAllow={requestLocation}
              onSkip={() => skipStep("camera")}
            />
          )}

          {step === "camera" && (
            <PermPrompt
              icon={<Camera className="w-8 h-8 text-primary" />}
              title="Accès à la caméra"
              desc="Permet à Marv-IA de prendre des photos pour analyser des images, scanner des documents ou partager des captures."
              status={cameraStatus}
              onAllow={requestCamera}
              onSkip={() => skipStep("notifications")}
            />
          )}

          {step === "notifications" && (
            <PermPrompt
              icon={<Bell className="w-8 h-8 text-primary" />}
              title="Notifications"
              desc="Recevez des alertes pour les mises à jour de l'app, le renouvellement de vos crédits et les rappels importants."
              status={notifStatus}
              onAllow={requestNotifications}
              onSkip={() => setStep("done")}
            />
          )}

          {step === "done" && (
            <div className="text-center space-y-4">
              <div className="space-y-2">
                <SummaryRow icon={<MapPin className="w-4 h-4" />} label="Position" status={locationStatus} />
                <SummaryRow icon={<Camera className="w-4 h-4" />} label="Caméra" status={cameraStatus} />
                <SummaryRow icon={<Bell className="w-4 h-4" />} label="Notifications" status={notifStatus} />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Vous pouvez modifier ces autorisations à tout moment dans les paramètres de votre navigateur.
              </p>
              <button
                onClick={handleFinish}
                className="w-full bg-primary text-primary-foreground py-3 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
              >
                C'est parti ! 🚀
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PermRow({ icon, title, desc, status }: { icon: React.ReactNode; title: string; desc: string; status: "pending" | "granted" | "denied" }) {
  return (
    <div className="flex items-center gap-3 bg-secondary rounded-xl px-3 py-3">
      <span className="text-primary flex-shrink-0">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{desc}</p>
      </div>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
        status === "granted" ? "bg-green-500" : status === "denied" ? "bg-destructive" : "bg-muted-foreground/40"
      }`} />
    </div>
  );
}

function PermPrompt({ icon, title, desc, status, onAllow, onSkip, requesting }: {
  icon: React.ReactNode; title: string; desc: string;
  status: "pending" | "granted" | "denied"; onAllow: () => void; onSkip: () => void; requesting?: boolean;
}) {
  return (
    <div className="text-center space-y-4">
      <div className="flex justify-center">{icon}</div>
      <div>
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      </div>
      {status === "granted" ? (
        <div className="flex flex-col items-center gap-2">
          <span className="text-sm text-green-500 font-medium">✓ Déjà autorisé</span>
          <button onClick={onSkip} className="text-xs text-primary hover:underline">Suivant</button>
        </div>
      ) : (
        <div className="space-y-2">
          <button
            onClick={onAllow}
            disabled={requesting}
            className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-60"
          >
            {requesting ? "⏳ En attente..." : "Autoriser"}
          </button>
          <button onClick={onSkip} disabled={requesting} className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1 disabled:opacity-40">
            Plus tard
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryRow({ icon, label, status }: { icon: React.ReactNode; label: string; status: "pending" | "granted" | "denied" }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-secondary rounded-lg">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-sm text-foreground flex-1 text-left">{label}</span>
      <span className={`text-xs font-medium ${status === "granted" ? "text-green-500" : "text-muted-foreground"}`}>
        {status === "granted" ? "✓ Activé" : status === "denied" ? "Refusé" : "Non demandé"}
      </span>
    </div>
  );
}