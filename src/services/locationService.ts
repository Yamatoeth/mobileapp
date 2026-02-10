/**
 * Location Service
 * 
 * Provides location awareness for J.A.R.V.I.S. including:
 * - Permission management
 * - Current location tracking
 * - Named location detection (home, office, gym)
 * - Location change detection
 */

import * as Location from 'expo-location';

// ============================================================================
// Types
// ============================================================================

export type LocationType = 'home' | 'office' | 'gym' | 'unknown';

export interface Coordinates {
  latitude: number;
  longitude: number;
  altitude?: number;
  accuracy?: number;
}

export interface LocationInfo {
  coordinates: Coordinates;
  timestamp: Date;
  locationType: LocationType;
  address?: AddressInfo;
  isMoving: boolean;
  speed?: number; // meters per second
}

export interface AddressInfo {
  street?: string;
  city?: string;
  region?: string;
  country?: string;
  postalCode?: string;
  name?: string; // Place name if available
}

export interface SavedLocation {
  id: string;
  name: string;
  type: LocationType;
  coordinates: Coordinates;
  radius: number; // meters
}

export interface LocationChangeEvent {
  previous: LocationInfo | null;
  current: LocationInfo;
  distanceMeters: number;
  locationType: LocationType;
}

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LOCATION_OPTIONS: Location.LocationOptions = {
  accuracy: Location.Accuracy.Balanced,
  distanceInterval: 100, // meters
  timeInterval: 30000, // 30 seconds
};

const GEOFENCE_RADIUS_DEFAULT = 100; // meters

// Movement detection threshold
const MOVEMENT_SPEED_THRESHOLD = 0.5; // m/s (walking pace)

// ============================================================================
// Location Service
// ============================================================================

class LocationService {
  private hasPermission: boolean = false;
  private hasBackgroundPermission: boolean = false;
  private currentLocation: LocationInfo | null = null;
  private savedLocations: SavedLocation[] = [];
  private locationSubscription: Location.LocationSubscription | null = null;
  private onLocationChangeCallbacks: ((event: LocationChangeEvent) => void)[] = [];

  constructor() {
    console.log('[LocationService] Initialized');
  }

  // --------------------------------------------------------------------------
  // Permissions
  // --------------------------------------------------------------------------

  /**
   * Request foreground location permission
   */
  async requestForegroundPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      this.hasPermission = status === 'granted';
      
      if (this.hasPermission) {
        console.log('[LocationService] Foreground permission granted');
      } else {
        console.log('[LocationService] Foreground permission denied');
      }
      
      return this.hasPermission;
    } catch (error) {
      console.error('[LocationService] Foreground permission error:', error);
      return false;
    }
  }

  /**
   * Request background location permission (for continuous tracking)
   */
  async requestBackgroundPermission(): Promise<boolean> {
    try {
      const { status } = await Location.requestBackgroundPermissionsAsync();
      this.hasBackgroundPermission = status === 'granted';
      
      if (this.hasBackgroundPermission) {
        console.log('[LocationService] Background permission granted');
      } else {
        console.log('[LocationService] Background permission denied');
      }
      
      return this.hasBackgroundPermission;
    } catch (error) {
      console.error('[LocationService] Background permission error:', error);
      return false;
    }
  }

  /**
   * Check current permission status
   */
  async checkPermissions(): Promise<{
    foreground: boolean;
    background: boolean;
  }> {
    try {
      const foreground = await Location.getForegroundPermissionsAsync();
      const background = await Location.getBackgroundPermissionsAsync();
      
      this.hasPermission = foreground.status === 'granted';
      this.hasBackgroundPermission = background.status === 'granted';
      
      return {
        foreground: this.hasPermission,
        background: this.hasBackgroundPermission,
      };
    } catch (error) {
      console.error('[LocationService] Permission check error:', error);
      return { foreground: false, background: false };
    }
  }

  /**
   * Get permission status
   */
  getPermissionStatus(): { foreground: boolean; background: boolean } {
    return {
      foreground: this.hasPermission,
      background: this.hasBackgroundPermission,
    };
  }

  // --------------------------------------------------------------------------
  // Location Fetching
  // --------------------------------------------------------------------------

  /**
   * Get current location (one-time fetch)
   */
  async getCurrentLocation(): Promise<LocationInfo | null> {
    if (!this.hasPermission) {
      const granted = await this.requestForegroundPermission();
      if (!granted) {
        console.warn('[LocationService] No permission for location');
        return null;
      }
    }

    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coordinates: Coordinates = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude ?? undefined,
        accuracy: location.coords.accuracy ?? undefined,
      };

      // Detect location type from saved locations
      const locationType = this.detectLocationType(coordinates);
      
      // Determine if moving
      const speed = location.coords.speed ?? 0;
      const isMoving = speed > MOVEMENT_SPEED_THRESHOLD;

      const locationInfo: LocationInfo = {
        coordinates,
        timestamp: new Date(location.timestamp),
        locationType,
        isMoving,
        speed: speed > 0 ? speed : undefined,
      };

      this.currentLocation = locationInfo;
      return locationInfo;
    } catch (error) {
      console.error('[LocationService] Get current location error:', error);
      return null;
    }
  }

  /**
   * Get current location with address (reverse geocoding)
   */
  async getCurrentLocationWithAddress(): Promise<LocationInfo | null> {
    const location = await this.getCurrentLocation();
    
    if (!location) return null;

    try {
      const addresses = await Location.reverseGeocodeAsync(location.coordinates);
      
      if (addresses.length > 0) {
        const addr = addresses[0];
        location.address = {
          street: addr.street ?? undefined,
          city: addr.city ?? undefined,
          region: addr.region ?? undefined,
          country: addr.country ?? undefined,
          postalCode: addr.postalCode ?? undefined,
          name: addr.name ?? undefined,
        };
      }
    } catch (error) {
      console.error('[LocationService] Reverse geocode error:', error);
    }

    return location;
  }

  /**
   * Get last known location (cached)
   */
  getLastKnownLocation(): LocationInfo | null {
    return this.currentLocation;
  }

  // --------------------------------------------------------------------------
  // Location Watching
  // --------------------------------------------------------------------------

  /**
   * Start watching location changes
   */
  async startWatching(
    options: Partial<Location.LocationOptions> = {}
  ): Promise<boolean> {
    if (!this.hasPermission) {
      const granted = await this.requestForegroundPermission();
      if (!granted) return false;
    }

    // Stop any existing subscription
    await this.stopWatching();

    try {
      const watchOptions = { ...DEFAULT_LOCATION_OPTIONS, ...options };
      
      this.locationSubscription = await Location.watchPositionAsync(
        watchOptions,
        (location) => {
          this.handleLocationUpdate(location);
        }
      );

      console.log('[LocationService] Started watching location');
      return true;
    } catch (error) {
      console.error('[LocationService] Start watching error:', error);
      return false;
    }
  }

  /**
   * Stop watching location changes
   */
  async stopWatching(): Promise<void> {
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
      console.log('[LocationService] Stopped watching location');
    }
  }

  /**
   * Check if currently watching
   */
  isWatching(): boolean {
    return this.locationSubscription !== null;
  }

  /**
   * Handle location update from watch
   */
  private handleLocationUpdate(location: Location.LocationObject): void {
    const previousLocation = this.currentLocation;

    const coordinates: Coordinates = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude ?? undefined,
      accuracy: location.coords.accuracy ?? undefined,
    };

    const locationType = this.detectLocationType(coordinates);
    const speed = location.coords.speed ?? 0;
    const isMoving = speed > MOVEMENT_SPEED_THRESHOLD;

    const newLocation: LocationInfo = {
      coordinates,
      timestamp: new Date(location.timestamp),
      locationType,
      isMoving,
      speed: speed > 0 ? speed : undefined,
    };

    this.currentLocation = newLocation;

    // Calculate distance from previous location
    let distanceMeters = 0;
    if (previousLocation) {
      distanceMeters = this.calculateDistance(
        previousLocation.coordinates,
        newLocation.coordinates
      );
    }

    // Notify listeners
    const event: LocationChangeEvent = {
      previous: previousLocation,
      current: newLocation,
      distanceMeters,
      locationType,
    };

    this.notifyLocationChange(event);
  }

  // --------------------------------------------------------------------------
  // Saved Locations (Geofencing)
  // --------------------------------------------------------------------------

  /**
   * Add a saved location
   */
  addSavedLocation(
    name: string,
    type: LocationType,
    coordinates: Coordinates,
    radius: number = GEOFENCE_RADIUS_DEFAULT
  ): SavedLocation {
    const location: SavedLocation = {
      id: `loc_${Date.now()}`,
      name,
      type,
      coordinates,
      radius,
    };

    this.savedLocations.push(location);
    console.log(`[LocationService] Added saved location: ${name} (${type})`);
    
    return location;
  }

  /**
   * Remove a saved location
   */
  removeSavedLocation(id: string): boolean {
    const index = this.savedLocations.findIndex(loc => loc.id === id);
    if (index > -1) {
      const removed = this.savedLocations.splice(index, 1)[0];
      console.log(`[LocationService] Removed saved location: ${removed.name}`);
      return true;
    }
    return false;
  }

  /**
   * Get all saved locations
   */
  getSavedLocations(): SavedLocation[] {
    return [...this.savedLocations];
  }

  /**
   * Save current location as a named place
   */
  async saveCurrentLocationAs(
    name: string,
    type: LocationType
  ): Promise<SavedLocation | null> {
    const current = await this.getCurrentLocation();
    if (!current) return null;

    return this.addSavedLocation(name, type, current.coordinates);
  }

  /**
   * Detect location type from saved locations
   */
  private detectLocationType(coordinates: Coordinates): LocationType {
    for (const saved of this.savedLocations) {
      const distance = this.calculateDistance(coordinates, saved.coordinates);
      if (distance <= saved.radius) {
        return saved.type;
      }
    }
    return 'unknown';
  }

  // --------------------------------------------------------------------------
  // Location Change Callbacks
  // --------------------------------------------------------------------------

  /**
   * Register callback for location changes
   */
  onLocationChange(callback: (event: LocationChangeEvent) => void): () => void {
    this.onLocationChangeCallbacks.push(callback);
    
    return () => {
      const index = this.onLocationChangeCallbacks.indexOf(callback);
      if (index > -1) {
        this.onLocationChangeCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of location change
   */
  private notifyLocationChange(event: LocationChangeEvent): void {
    this.onLocationChangeCallbacks.forEach(callback => {
      try {
        callback(event);
      } catch (error) {
        console.error('[LocationService] Callback error:', error);
      }
    });
  }

  // --------------------------------------------------------------------------
  // Context for AI/LLM
  // --------------------------------------------------------------------------

  /**
   * Get location context for AI/state machine
   */
  async getContextForAI(): Promise<{
    locationType: LocationType;
    locationName: string | null;
    isMoving: boolean;
    speed: number | null;
    address: string | null;
    coordinates: { lat: number; lng: number } | null;
    lastUpdate: string | null;
  }> {
    const location = this.currentLocation ?? await this.getCurrentLocation();

    if (!location) {
      return {
        locationType: 'unknown',
        locationName: null,
        isMoving: false,
        speed: null,
        address: null,
        coordinates: null,
        lastUpdate: null,
      };
    }

    // Find matching saved location for name
    let locationName: string | null = null;
    for (const saved of this.savedLocations) {
      const distance = this.calculateDistance(
        location.coordinates,
        saved.coordinates
      );
      if (distance <= saved.radius) {
        locationName = saved.name;
        break;
      }
    }

    // Format address
    let addressStr: string | null = null;
    if (location.address) {
      const parts = [
        location.address.name,
        location.address.street,
        location.address.city,
      ].filter(Boolean);
      addressStr = parts.join(', ');
    }

    return {
      locationType: location.locationType,
      locationName,
      isMoving: location.isMoving,
      speed: location.speed ?? null,
      address: addressStr,
      coordinates: {
        lat: location.coordinates.latitude,
        lng: location.coordinates.longitude,
      },
      lastUpdate: location.timestamp.toISOString(),
    };
  }

  // --------------------------------------------------------------------------
  // Utilities
  // --------------------------------------------------------------------------

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Check if location services are enabled on device
   */
  async isLocationServicesEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch (error) {
      console.error('[LocationService] Services check error:', error);
      return false;
    }
  }

  /**
   * Get location type display info
   */
  getLocationTypeInfo(type: LocationType): {
    name: string;
    icon: string;
    color: string;
  } {
    const info: Record<LocationType, { name: string; icon: string; color: string }> = {
      home: { name: 'Home', icon: 'home', color: '#22c55e' },
      office: { name: 'Office', icon: 'briefcase', color: '#3b82f6' },
      gym: { name: 'Gym', icon: 'fitness', color: '#f59e0b' },
      unknown: { name: 'Unknown', icon: 'location', color: '#64748b' },
    };
    return info[type];
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const locationService = new LocationService();

export default locationService;
