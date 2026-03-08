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

/**
 * High-precision geolocation hook.
 * Uses watchPosition to continuously refine the position,
 * picks the reading with the best accuracy within a time window,
 * and includes satellite data (altitude, heading, speed).
 */
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

      // Use watchPosition to get multiple readings and pick the most accurate
      const watchId = navigator.geolocation.watchPosition(
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

          // Keep the most accurate reading
          if (!bestReadingRef.current || reading.accuracy < bestReadingRef.current.accuracy) {
            bestReadingRef.current = reading;
            setLocation(reading);
          }

          // If we got a very accurate reading (<15m), resolve immediately
          if (reading.accuracy <= 15) {
            navigator.geolocation.clearWatch(watchId);
            setLoading(false);
            resolve(bestReadingRef.current);
          }
        },
        () => {
          navigator.geolocation.clearWatch(watchId);
          setLoading(false);
          resolve(bestReadingRef.current);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0, // Force fresh reading, no cache
        }
      );

      // After 8 seconds, stop watching and return best reading so far
      setTimeout(() => {
        navigator.geolocation.clearWatch(watchId);
        if (loading) {
          setLoading(false);
          resolve(bestReadingRef.current);
        }
      }, 8000);
    });
  }, []);

  return { location, loading, requestLocation };
}
