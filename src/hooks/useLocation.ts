/**
 * useLocation Hook
 * 
 * Provides reactive access to device location with:
 * - Permission management
 * - Current location tracking
 * - Named location detection (home, office, gym)
 * - Location change events
 */

import { useCallback, useEffect, useState, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import {
  locationService,
  LocationInfo,
  LocationType,
  SavedLocation,
  LocationChangeEvent,
} from '../services/locationService';

// ============================================================================
// Types
// ============================================================================

export type LocationPermissionStatus = 
  | 'undetermined' 
  | 'granted' 
  | 'denied' 
  | 'checking';

export interface UseLocationOptions {
  /** Auto-watch location changes */
  autoWatch?: boolean;
  /** Update interval in ms for polling (if not watching) */
  pollIntervalMs?: number;
  /** Refresh location on app focus */
  refreshOnFocus?: boolean;
  /** Auto-request permissions on mount */
  autoRequestPermissions?: boolean;
  /** Include address in location data */
  includeAddress?: boolean;
}

export interface UseLocationReturn {
  // Permission state
  permissionStatus: LocationPermissionStatus;
  hasPermission: boolean;
  hasBackgroundPermission: boolean;
  requestPermission: () => Promise<boolean>;
  requestBackgroundPermission: () => Promise<boolean>;
  
  // Location data
  location: LocationInfo | null;
  locationType: LocationType;
  isMoving: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Watching state
  isWatching: boolean;
  startWatching: () => Promise<boolean>;
  stopWatching: () => void;
  
  // Location names
  locationName: string | null;
  savedLocations: SavedLocation[];
  
  // Actions
  refresh: () => Promise<void>;
  saveCurrentLocation: (name: string, type: LocationType) => Promise<SavedLocation | null>;
  removeSavedLocation: (id: string) => boolean;
  
  // Last location change event
  lastChangeEvent: LocationChangeEvent | null;
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useLocation(options: UseLocationOptions = {}): UseLocationReturn {
  const {
    autoWatch = false,
    pollIntervalMs = 0,
    refreshOnFocus = true,
    autoRequestPermissions = false,
    includeAddress = false,
  } = options;

  // Permission state
  const [permissionStatus, setPermissionStatus] = useState<LocationPermissionStatus>('checking');
  const [hasBackgroundPermission, setHasBackgroundPermission] = useState(false);
  
  // Location state
  const [location, setLocation] = useState<LocationInfo | null>(null);
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isWatching, setIsWatching] = useState(false);
  const [lastChangeEvent, setLastChangeEvent] = useState<LocationChangeEvent | null>(null);

  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --------------------------------------------------------------------------
  // Permission handling
  // --------------------------------------------------------------------------

  const checkPermissions = useCallback(async () => {
    setPermissionStatus('checking');
    try {
      const permissions = await locationService.checkPermissions();
      setPermissionStatus(permissions.foreground ? 'granted' : 'undetermined');
      setHasBackgroundPermission(permissions.background);
      return permissions.foreground;
    } catch (err) {
      console.error('[useLocation] Permission check failed:', err);
      setPermissionStatus('undetermined');
      return false;
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await locationService.requestForegroundPermission();
      setPermissionStatus(granted ? 'granted' : 'denied');
      
      if (granted) {
        await refreshLocation();
      }
      
      return granted;
    } catch (err) {
      console.error('[useLocation] Permission request failed:', err);
      setPermissionStatus('denied');
      setError('Failed to request location permission');
      return false;
    }
  }, []);

  const requestBackgroundPermission = useCallback(async (): Promise<boolean> => {
    try {
      const granted = await locationService.requestBackgroundPermission();
      setHasBackgroundPermission(granted);
      return granted;
    } catch (err) {
      console.error('[useLocation] Background permission request failed:', err);
      return false;
    }
  }, []);

  // --------------------------------------------------------------------------
  // Location fetching
  // --------------------------------------------------------------------------

  const refreshLocation = useCallback(async () => {
    if (permissionStatus !== 'granted') {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const loc = includeAddress
        ? await locationService.getCurrentLocationWithAddress()
        : await locationService.getCurrentLocation();
      
      if (loc) {
        setLocation(loc);
      }
      
      // Also refresh saved locations
      setSavedLocations(locationService.getSavedLocations());
    } catch (err) {
      console.error('[useLocation] Location fetch failed:', err);
      setError('Failed to get current location');
    } finally {
      setIsLoading(false);
    }
  }, [permissionStatus, includeAddress]);

  // --------------------------------------------------------------------------
  // Watching
  // --------------------------------------------------------------------------

  const startWatching = useCallback(async (): Promise<boolean> => {
    if (permissionStatus !== 'granted') {
      const granted = await requestPermission();
      if (!granted) return false;
    }

    const success = await locationService.startWatching();
    setIsWatching(success);
    return success;
  }, [permissionStatus, requestPermission]);

  const stopWatching = useCallback(() => {
    locationService.stopWatching();
    setIsWatching(false);
  }, []);

  // --------------------------------------------------------------------------
  // Saved locations
  // --------------------------------------------------------------------------

  const saveCurrentLocation = useCallback(
    async (name: string, type: LocationType): Promise<SavedLocation | null> => {
      const saved = await locationService.saveCurrentLocationAs(name, type);
      if (saved) {
        setSavedLocations(locationService.getSavedLocations());
      }
      return saved;
    },
    []
  );

  const removeSavedLocation = useCallback((id: string): boolean => {
    const removed = locationService.removeSavedLocation(id);
    if (removed) {
      setSavedLocations(locationService.getSavedLocations());
    }
    return removed;
  }, []);

  // --------------------------------------------------------------------------
  // Effects
  // --------------------------------------------------------------------------

  // Initial permission check and location fetch
  useEffect(() => {
    const init = async () => {
      const hasPermission = await checkPermissions();
      
      if (!hasPermission && autoRequestPermissions) {
        await requestPermission();
      } else if (hasPermission) {
        await refreshLocation();
      } else {
        setIsLoading(false);
      }
    };

    init();
  }, [checkPermissions, requestPermission, autoRequestPermissions]);

  // Fetch location when permission changes to granted
  useEffect(() => {
    if (permissionStatus === 'granted') {
      refreshLocation();
    }
  }, [permissionStatus, refreshLocation]);

  // Auto-watch
  useEffect(() => {
    if (autoWatch && permissionStatus === 'granted') {
      startWatching();
      
      return () => {
        stopWatching();
      };
    }
  }, [autoWatch, permissionStatus, startWatching, stopWatching]);

  // Polling interval
  useEffect(() => {
    if (pollIntervalMs > 0 && permissionStatus === 'granted' && !isWatching) {
      pollIntervalRef.current = setInterval(() => {
        refreshLocation();
      }, pollIntervalMs);

      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };
    }
  }, [pollIntervalMs, permissionStatus, isWatching, refreshLocation]);

  // Refresh on app focus
  useEffect(() => {
    if (!refreshOnFocus || permissionStatus !== 'granted') {
      return;
    }

    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        refreshLocation();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [refreshOnFocus, permissionStatus, refreshLocation]);

  // Location change listener
  useEffect(() => {
    const unsubscribe = locationService.onLocationChange((event) => {
      setLocation(event.current);
      setLastChangeEvent(event);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // --------------------------------------------------------------------------
  // Derived values
  // --------------------------------------------------------------------------

  // Find matching saved location name
  let locationName: string | null = null;
  if (location) {
    for (const saved of savedLocations) {
      const distance = locationService.calculateDistance(
        location.coordinates,
        saved.coordinates
      );
      if (distance <= saved.radius) {
        locationName = saved.name;
        break;
      }
    }
  }

  return {
    // Permission state
    permissionStatus,
    hasPermission: permissionStatus === 'granted',
    hasBackgroundPermission,
    requestPermission,
    requestBackgroundPermission,

    // Location data
    location,
    locationType: location?.locationType ?? 'unknown',
    isMoving: location?.isMoving ?? false,
    isLoading,
    error,

    // Watching state
    isWatching,
    startWatching,
    stopWatching,

    // Location names
    locationName,
    savedLocations,

    // Actions
    refresh: refreshLocation,
    saveCurrentLocation,
    removeSavedLocation,

    // Last change event
    lastChangeEvent,
  };
}

export default useLocation;
