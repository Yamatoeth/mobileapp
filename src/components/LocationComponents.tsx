/**
 * Location UI Components
 * 
 * - LocationPermissionCard: Request/display permission status
 * - CurrentLocation: Display current location with type indicator
 * - SavedLocationsList: Manage saved locations (home, office, gym)
 * - LocationBadge: Compact location type indicator
 */

import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  LocationType,
  LocationInfo,
  SavedLocation,
} from '../services/locationService';
import { LocationPermissionStatus } from '../hooks/useLocation';

// ============================================================================
// Location Permission Card
// ============================================================================

export interface LocationPermissionCardProps {
  status: LocationPermissionStatus;
  onRequestPermission: () => void;
  onOpenSettings?: () => void;
  compact?: boolean;
}

export const LocationPermissionCard: React.FC<LocationPermissionCardProps> = ({
  status,
  onRequestPermission,
  onOpenSettings,
  compact = false,
}) => {
  if (status === 'granted') {
    return null;
  }

  if (status === 'checking') {
    return (
      <View style={[styles.permissionCard, compact && styles.permissionCardCompact]}>
        <ActivityIndicator color="#22c55e" />
        <Text style={styles.permissionText}>Checking location access...</Text>
      </View>
    );
  }

  const isDenied = status === 'denied';

  return (
    <View style={[styles.permissionCard, compact && styles.permissionCardCompact]}>
      <View style={styles.permissionHeader}>
        <Ionicons
          name="location-outline"
          size={compact ? 24 : 32}
          color="#22c55e"
        />
        {!compact && (
          <Text style={styles.permissionTitle}>Location Access</Text>
        )}
      </View>

      <Text style={[styles.permissionDescription, compact && styles.permissionDescriptionCompact]}>
        {isDenied
          ? 'Location access was denied. Enable it in Settings for context-aware assistance.'
          : 'J.A.R.V.I.S. can detect your location to provide context like "at home" or "at office".'}
      </Text>

      <TouchableOpacity
        style={[styles.permissionButton, isDenied && styles.permissionButtonSecondary]}
        onPress={isDenied ? onOpenSettings : onRequestPermission}
        activeOpacity={0.7}
      >
        <Text style={[styles.permissionButtonText, isDenied && styles.permissionButtonTextSecondary]}>
          {isDenied ? 'Open Settings' : 'Enable Location Access'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// ============================================================================
// Current Location Display
// ============================================================================

export interface CurrentLocationProps {
  location: LocationInfo | null;
  locationName: string | null;
  isLoading?: boolean;
  onRefresh?: () => void;
  showCoordinates?: boolean;
}

export const CurrentLocation: React.FC<CurrentLocationProps> = ({
  location,
  locationName,
  isLoading = false,
  onRefresh,
  showCoordinates = false,
}) => {
  const getLocationTypeInfo = (type: LocationType) => {
    const info: Record<LocationType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
      home: { icon: 'home', color: '#22c55e' },
      office: { icon: 'briefcase', color: '#3b82f6' },
      gym: { icon: 'fitness', color: '#f59e0b' },
      unknown: { icon: 'location', color: '#64748b' },
    };
    return info[type];
  };

  if (isLoading) {
    return (
      <View style={styles.currentLocationCard}>
        <ActivityIndicator color="#22c55e" />
        <Text style={styles.loadingText}>Getting location...</Text>
      </View>
    );
  }

  if (!location) {
    return (
      <View style={styles.currentLocationCard}>
        <Ionicons name="location-outline" size={24} color="#94a3b8" />
        <Text style={styles.noLocationText}>Location unavailable</Text>
        {onRefresh && (
          <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
            <Ionicons name="refresh" size={20} color="#3b82f6" />
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const typeInfo = getLocationTypeInfo(location.locationType);

  return (
    <View style={styles.currentLocationCard}>
      <View style={[styles.locationIcon, { backgroundColor: `${typeInfo.color}15` }]}>
        <Ionicons name={typeInfo.icon} size={24} color={typeInfo.color} />
      </View>

      <View style={styles.locationInfo}>
        <Text style={styles.locationName}>
          {locationName ?? location.address?.name ?? 'Current Location'}
        </Text>
        
        {location.address && (
          <Text style={styles.locationAddress} numberOfLines={1}>
            {[location.address.street, location.address.city]
              .filter(Boolean)
              .join(', ')}
          </Text>
        )}

        <View style={styles.locationMeta}>
          {location.isMoving && (
            <View style={styles.movingIndicator}>
              <Ionicons name="walk" size={12} color="#f59e0b" />
              <Text style={styles.movingText}>Moving</Text>
            </View>
          )}
          
          {showCoordinates && (
            <Text style={styles.coordinates}>
              {location.coordinates.latitude.toFixed(4)}, {location.coordinates.longitude.toFixed(4)}
            </Text>
          )}
        </View>
      </View>

      {onRefresh && (
        <TouchableOpacity onPress={onRefresh} style={styles.refreshButton}>
          <Ionicons name="refresh" size={20} color="#3b82f6" />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ============================================================================
// Location Badge (Compact)
// ============================================================================

export interface LocationBadgeProps {
  locationType: LocationType;
  locationName?: string | null;
  isMoving?: boolean;
  compact?: boolean;
  onPress?: () => void;
}

export const LocationBadge: React.FC<LocationBadgeProps> = ({
  locationType,
  locationName,
  isMoving = false,
  compact = false,
  onPress,
}) => {
  const getTypeInfo = (type: LocationType) => {
    const info: Record<LocationType, { icon: keyof typeof Ionicons.glyphMap; color: string; label: string }> = {
      home: { icon: 'home', color: '#22c55e', label: 'Home' },
      office: { icon: 'briefcase', color: '#3b82f6', label: 'Office' },
      gym: { icon: 'fitness', color: '#f59e0b', label: 'Gym' },
      unknown: { icon: 'location', color: '#64748b', label: 'Away' },
    };
    return info[type];
  };

  const typeInfo = getTypeInfo(locationType);
  const displayName = locationName ?? typeInfo.label;

  const content = (
    <View style={[
      styles.badge,
      { backgroundColor: `${typeInfo.color}15`, borderColor: typeInfo.color },
      compact && styles.badgeCompact,
    ]}>
      <Ionicons
        name={isMoving ? 'walk' : typeInfo.icon}
        size={compact ? 14 : 16}
        color={typeInfo.color}
      />
      {!compact && (
        <Text style={[styles.badgeText, { color: typeInfo.color }]}>
          {isMoving ? 'Moving' : displayName}
        </Text>
      )}
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.7} onPress={onPress}>
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

// ============================================================================
// Saved Locations List
// ============================================================================

export interface SavedLocationsListProps {
  locations: SavedLocation[];
  currentLocationType?: LocationType;
  onRemove?: (id: string) => void;
  onSelect?: (location: SavedLocation) => void;
}

export const SavedLocationsList: React.FC<SavedLocationsListProps> = ({
  locations,
  currentLocationType,
  onRemove,
  onSelect,
}) => {
  const getTypeInfo = (type: LocationType) => {
    const info: Record<LocationType, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
      home: { icon: 'home', color: '#22c55e' },
      office: { icon: 'briefcase', color: '#3b82f6' },
      gym: { icon: 'fitness', color: '#f59e0b' },
      unknown: { icon: 'location', color: '#64748b' },
    };
    return info[type];
  };

  const handleRemove = (location: SavedLocation) => {
    if (!onRemove) return;
    
    Alert.alert(
      'Remove Location',
      `Remove "${location.name}" from saved locations?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => onRemove(location.id) },
      ]
    );
  };

  if (locations.length === 0) {
    return (
      <View style={styles.emptyLocations}>
        <Ionicons name="bookmark-outline" size={32} color="#94a3b8" />
        <Text style={styles.emptyText}>No saved locations</Text>
        <Text style={styles.emptySubtext}>
          Save your home, office, or gym for context-aware assistance
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.savedLocationsList}>
      {locations.map((location) => {
        const typeInfo = getTypeInfo(location.type);
        const isCurrent = location.type === currentLocationType;

        return (
          <TouchableOpacity
            key={location.id}
            style={[styles.savedLocationItem, isCurrent && styles.savedLocationItemActive]}
            onPress={() => onSelect?.(location)}
            activeOpacity={0.7}
          >
            <View style={[styles.savedLocationIcon, { backgroundColor: `${typeInfo.color}15` }]}>
              <Ionicons name={typeInfo.icon} size={20} color={typeInfo.color} />
            </View>

            <View style={styles.savedLocationInfo}>
              <Text style={styles.savedLocationName}>{location.name}</Text>
              <Text style={styles.savedLocationType}>
                {location.type.charAt(0).toUpperCase() + location.type.slice(1)}
              </Text>
            </View>

            {isCurrent && (
              <View style={styles.currentIndicator}>
                <Text style={styles.currentIndicatorText}>Here</Text>
              </View>
            )}

            {onRemove && (
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => handleRemove(location)}
              >
                <Ionicons name="close-circle" size={20} color="#94a3b8" />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ============================================================================
// Add Location Form (Simple)
// ============================================================================

export interface AddLocationFormProps {
  onSave: (name: string, type: LocationType) => Promise<void>;
  isLoading?: boolean;
}

export const AddLocationForm: React.FC<AddLocationFormProps> = ({
  onSave,
  isLoading = false,
}) => {
  const [name, setName] = React.useState('');
  const [selectedType, setSelectedType] = React.useState<LocationType>('home');

  const locationTypes: { type: LocationType; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { type: 'home', label: 'Home', icon: 'home' },
    { type: 'office', label: 'Office', icon: 'briefcase' },
    { type: 'gym', label: 'Gym', icon: 'fitness' },
  ];

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a name for this location');
      return;
    }

    await onSave(name.trim(), selectedType);
    setName('');
  };

  return (
    <View style={styles.addLocationForm}>
      <Text style={styles.formTitle}>Save Current Location</Text>

      <TextInput
        style={styles.nameInput}
        value={name}
        onChangeText={setName}
        placeholder="Location name (e.g., My Home)"
        placeholderTextColor="#94a3b8"
      />

      <View style={styles.typeSelector}>
        {locationTypes.map(({ type, label, icon }) => (
          <TouchableOpacity
            key={type}
            style={[
              styles.typeOption,
              selectedType === type && styles.typeOptionSelected,
            ]}
            onPress={() => setSelectedType(type)}
          >
            <Ionicons
              name={icon}
              size={20}
              color={selectedType === type ? '#3b82f6' : '#64748b'}
            />
            <Text
              style={[
                styles.typeLabel,
                selectedType === type && styles.typeLabelSelected,
              ]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isLoading}
      >
        {isLoading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>Save Location</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  // Permission Card
  permissionCard: {
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    padding: 20,
    borderWidth: 1,
    borderColor: '#bbf7d0',
    alignItems: 'center',
    margin: 16,
  },
  permissionCardCompact: {
    flexDirection: 'row',
    padding: 12,
    gap: 12,
  },
  permissionHeader: {
    alignItems: 'center',
    marginBottom: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#166534',
    marginTop: 8,
  },
  permissionText: {
    fontSize: 14,
    color: '#166534',
  },
  permissionDescription: {
    fontSize: 14,
    color: '#15803d',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  permissionDescriptionCompact: {
    flex: 1,
    textAlign: 'left',
    marginBottom: 0,
  },
  permissionButton: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  permissionButtonSecondary: {
    backgroundColor: '#f0fdf4',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  permissionButtonTextSecondary: {
    color: '#15803d',
  },

  // Current Location
  currentLocationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  loadingText: {
    fontSize: 14,
    color: '#64748b',
  },
  noLocationText: {
    fontSize: 14,
    color: '#94a3b8',
    flex: 1,
  },
  locationIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  locationAddress: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  locationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 12,
  },
  movingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  movingText: {
    fontSize: 12,
    color: '#f59e0b',
    fontWeight: '500',
  },
  coordinates: {
    fontSize: 11,
    color: '#94a3b8',
    fontFamily: 'monospace',
  },
  refreshButton: {
    padding: 8,
  },

  // Badge
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
  },
  badgeCompact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Saved Locations
  savedLocationsList: {
    gap: 8,
  },
  savedLocationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
    gap: 12,
  },
  savedLocationItemActive: {
    borderColor: '#22c55e',
    backgroundColor: '#f0fdf4',
  },
  savedLocationIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  savedLocationInfo: {
    flex: 1,
  },
  savedLocationName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1e293b',
  },
  savedLocationType: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  currentIndicator: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  currentIndicatorText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#22c55e',
  },
  removeButton: {
    padding: 4,
  },
  emptyLocations: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 13,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
  },

  // Add Location Form
  addLocationForm: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1e293b',
    marginBottom: 16,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  typeOption: {
    flex: 1,
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#f8fafc',
  },
  typeOptionSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  typeLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  typeLabelSelected: {
    color: '#3b82f6',
    fontWeight: '500',
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});

export default {
  LocationPermissionCard,
  CurrentLocation,
  LocationBadge,
  SavedLocationsList,
  AddLocationForm,
};
