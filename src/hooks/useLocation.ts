import { useState, useCallback, useRef } from "react";

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  altitudeAccuracy: number | null;
  heading: number | null;
  speed: number | null;
}

export function useLocation() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const bestReadingRef = useRef<LocationData | null>(null);

  const requestLocation = useCallback((): Promise<LocationData | null> => {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      setLoading(true);
      bestReadingRef.current = null;
      let resolved = false;

      const finish = (watchId: number) => {
        if (resolved) return;
        resolved = true;
        navigator.geolocation.clearWatch(watchId);
        setLoading(false);
        if (bestReadingRef.current) setLocation(bestReadingRef.current);
        resolve(bestReadingRef.current);
      };

      // Try getCurrentPosition first for a fast initial reading
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const reading: LocationData = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            altitudeAccuracy: pos.coords.altitudeAccuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          };
          bestReadingRef.current = reading;
          setLocation(reading);
          // If good enough, resolve immediately
          if (reading.accuracy <= 50) {
            resolved = true;
            setLoading(false);
            resolve(reading);
          }
        },
        () => {},
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 30000 }
      );

      // Also start watchPosition for better accuracy
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (resolved) return;
          const reading: LocationData = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            altitude: pos.coords.altitude,
            altitudeAccuracy: pos.coords.altitudeAccuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
          };

          if (!bestReadingRef.current || reading.accuracy < bestReadingRef.current.accuracy) {
            bestReadingRef.current = reading;
            setLocation(reading);
          }

          if (reading.accuracy <= 30) {
            finish(watchId);
          }
        },
        () => finish(watchId),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      // Fallback: after 4s return whatever we have
      setTimeout(() => finish(watchId), 4000);
    });
  }, []);

  return { location, loading, requestLocation };
}
