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

export type LocationError = "unavailable" | "denied" | "timeout" | "iframe" | null;

/**
 * High-precision geolocation hook with robust error handling.
 * Uses a fast initial read + watchPosition refinement.
 */
export function useLocation() {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LocationError>(null);
  const bestReadingRef = useRef<LocationData | null>(null);

  const requestLocation = useCallback((): Promise<LocationData | null> => {
    return new Promise(async (resolve) => {
      setError(null);

      // Check if in iframe (preview restriction)
      const isIframe = window.self !== window.top;

      if (!navigator.geolocation) {
        console.warn("[GPS] Geolocation API not available");
        setError("unavailable");
        resolve(null);
        return;
      }

      // Pre-check permission if API is available
      try {
        const perm = await navigator.permissions?.query({ name: "geolocation" });
        if (perm?.state === "denied") {
          console.warn("[GPS] Permission denied by user");
          setError("denied");
          resolve(null);
          return;
        }
        console.log("[GPS] Permission state:", perm?.state);
      } catch (e) {
        console.log("[GPS] Permissions API not available, proceeding anyway");
      }

      setLoading(true);
      bestReadingRef.current = null;
      let resolved = false;

      const toReading = (pos: GeolocationPosition): LocationData => ({
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        altitude: pos.coords.altitude,
        altitudeAccuracy: pos.coords.altitudeAccuracy,
        heading: pos.coords.heading,
        speed: pos.coords.speed,
      });

      const done = () => {
        if (resolved) return;
        resolved = true;
        setLoading(false);
        if (bestReadingRef.current) {
          setLocation(bestReadingRef.current);
          console.log("[GPS] Final reading:", bestReadingRef.current.accuracy.toFixed(0) + "m accuracy");
        } else {
          console.warn("[GPS] No reading obtained");
          setError(isIframe ? "iframe" : "timeout");
        }
        resolve(bestReadingRef.current);
      };

      const handleError = (err: GeolocationPositionError) => {
        console.warn("[GPS] Error:", err.code, err.message);
        if (err.code === 1) setError("denied");
        else if (err.code === 3) setError("timeout");
        else setError("unavailable");
      };

      // Strategy 1: Fast cached reading (responds in <1s usually)
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const reading = toReading(pos);
          console.log("[GPS] Fast reading:", reading.accuracy.toFixed(0) + "m");
          bestReadingRef.current = reading;
          setLocation(reading);
          if (reading.accuracy <= 50) {
            resolved = true;
            setLoading(false);
            resolve(reading);
          }
        },
        (err) => {
          console.warn("[GPS] Fast reading failed:", err.message);
          handleError(err);
        },
        { enableHighAccuracy: false, timeout: 3000, maximumAge: 60000 }
      );

      // Strategy 2: High-accuracy watch (refines over time)
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (resolved) return;
          const reading = toReading(pos);
          console.log("[GPS] Watch reading:", reading.accuracy.toFixed(0) + "m");

          if (!bestReadingRef.current || reading.accuracy < bestReadingRef.current.accuracy) {
            bestReadingRef.current = reading;
            setLocation(reading);
          }

          if (reading.accuracy <= 30) {
            navigator.geolocation.clearWatch(watchId);
            done();
          }
        },
        (err) => {
          console.warn("[GPS] Watch error:", err.message);
          handleError(err);
          navigator.geolocation.clearWatch(watchId);
          done();
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      );

      // Fallback: after 4s return best reading
      setTimeout(() => {
        navigator.geolocation.clearWatch(watchId);
        done();
      }, 4000);
    });
  }, []);

  return { location, loading, error, requestLocation };
}