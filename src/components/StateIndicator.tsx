/**
 * StateIndicator Component
 * 
 * Visual indicator showing the current life state.
 * Supports multiple display modes: badge, chip, full card.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LifeState } from '../store/biometricStore';
import { stateMachineService } from '../services/stateMachine';

// ============================================================================
// Types
// ============================================================================

export type StateIndicatorVariant = 'badge' | 'chip' | 'card' | 'minimal';

export interface StateIndicatorProps {
  /** Current life state */
  state: LifeState;
  /** Display variant */
  variant?: StateIndicatorVariant;
  /** Show the state name text */
  showLabel?: boolean;
  /** Show emoji instead of icon */
  useEmoji?: boolean;
  /** Animate on state change */
  animated?: boolean;
  /** Custom style */
  style?: ViewStyle;
  /** Called when indicator is pressed */
  onPress?: () => void;
  /** Show pulse animation for stressed state */
  pulseOnStress?: boolean;
}

// ============================================================================
// State Indicator Component
// ============================================================================

export const StateIndicator: React.FC<StateIndicatorProps> = ({
  state,
  variant = 'chip',
  showLabel = true,
  useEmoji = false,
  animated = true,
  style,
  onPress,
  pulseOnStress = true,
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const prevStateRef = useRef(state);
  
  // Get state display info
  const stateName = stateMachineService.getStateName(state);
  const stateIcon = stateMachineService.getStateIcon(state);
  const stateColor = stateMachineService.getStateColor(state);
  const stateEmoji = stateMachineService.getStateEmoji(state);
  
  // Animate on state change
  useEffect(() => {
    if (animated && prevStateRef.current !== state) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.2,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
      
      prevStateRef.current = state;
    }
  }, [state, animated, scaleAnim]);
  
  // Pulse animation for stressed state
  useEffect(() => {
    if (pulseOnStress && state === 'stressed') {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      
      return () => pulse.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [state, pulseOnStress, pulseAnim]);
  
  // Combined animation transform
  const animatedStyle = {
    transform: [
      { scale: Animated.multiply(scaleAnim, pulseAnim) },
    ],
  };
  
  // Render icon or emoji
  const renderIcon = () => {
    if (useEmoji) {
      return (
        <Text style={[styles.emoji, variant === 'minimal' && styles.emojiMinimal]}>
          {stateEmoji}
        </Text>
      );
    }
    
    const iconSize = variant === 'card' ? 28 : variant === 'minimal' ? 16 : 18;
    
    return (
      <Ionicons
        name={stateIcon as keyof typeof Ionicons.glyphMap}
        size={iconSize}
        color={variant === 'badge' ? '#fff' : stateColor}
      />
    );
  };
  
  // Render based on variant
  const renderContent = () => {
    switch (variant) {
      case 'minimal':
        return (
          <View style={[styles.minimal, style]}>
            {renderIcon()}
          </View>
        );
        
      case 'badge':
        return (
          <View
            style={[
              styles.badge,
              { backgroundColor: stateColor },
              style,
            ]}
          >
            {renderIcon()}
            {showLabel && (
              <Text style={styles.badgeText}>{stateName}</Text>
            )}
          </View>
        );
        
      case 'chip':
        return (
          <View
            style={[
              styles.chip,
              {
                backgroundColor: `${stateColor}15`,
                borderColor: stateColor,
              },
              style,
            ]}
          >
            {renderIcon()}
            {showLabel && (
              <Text style={[styles.chipText, { color: stateColor }]}>
                {stateName}
              </Text>
            )}
          </View>
        );
        
      case 'card':
        return (
          <View
            style={[
              styles.card,
              {
                backgroundColor: `${stateColor}10`,
                borderColor: stateColor,
              },
              style,
            ]}
          >
            <View style={styles.cardHeader}>
              {renderIcon()}
              <Text style={[styles.cardTitle, { color: stateColor }]}>
                {stateName}
              </Text>
            </View>
            <Text style={styles.cardSubtitle}>
              Current State
            </Text>
          </View>
        );
    }
  };
  
  const content = (
    <Animated.View style={animatedStyle}>
      {renderContent()}
    </Animated.View>
  );
  
  if (onPress) {
    return (
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={onPress}
      >
        {content}
      </TouchableOpacity>
    );
  }
  
  return content;
};

// ============================================================================
// State Selector Component
// ============================================================================

export interface StateSelectorProps {
  currentState: LifeState;
  validStates: LifeState[];
  onSelectState: (state: LifeState) => void;
  style?: ViewStyle;
}

export const StateSelector: React.FC<StateSelectorProps> = ({
  currentState,
  validStates,
  onSelectState,
  style,
}) => {
  const allStates: LifeState[] = [
    'sleeping',
    'exercising',
    'working',
    'meeting',
    'leisure',
    'stressed',
  ];
  
  return (
    <View style={[styles.selectorContainer, style]}>
      {allStates.map((state) => {
        const isSelected = state === currentState;
        const isValid = validStates.includes(state);
        const color = stateMachineService.getStateColor(state);
        const icon = stateMachineService.getStateIcon(state);
        const name = stateMachineService.getStateName(state);
        
        return (
          <TouchableOpacity
            key={state}
            style={[
              styles.selectorItem,
              isSelected && { backgroundColor: `${color}20`, borderColor: color },
              !isValid && !isSelected && styles.selectorItemDisabled,
            ]}
            onPress={() => isValid && onSelectState(state)}
            disabled={!isValid && !isSelected}
            activeOpacity={0.7}
          >
            <Ionicons
              name={icon as keyof typeof Ionicons.glyphMap}
              size={24}
              color={isSelected ? color : isValid ? '#666' : '#ccc'}
            />
            <Text
              style={[
                styles.selectorText,
                isSelected && { color, fontWeight: '600' },
                !isValid && !isSelected && styles.selectorTextDisabled,
              ]}
            >
              {name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ============================================================================
// State History Component
// ============================================================================

export interface StateHistoryProps {
  transitions: Array<{
    from: LifeState;
    to: LifeState;
    timestamp: Date;
    reason: string;
    confidence: number;
  }>;
  maxItems?: number;
  style?: ViewStyle;
}

export const StateHistory: React.FC<StateHistoryProps> = ({
  transitions,
  maxItems = 5,
  style,
}) => {
  const displayTransitions = transitions.slice(-maxItems).reverse();
  
  if (displayTransitions.length === 0) {
    return (
      <View style={[styles.historyContainer, style]}>
        <Text style={styles.historyEmpty}>No state transitions yet</Text>
      </View>
    );
  }
  
  return (
    <View style={[styles.historyContainer, style]}>
      <Text style={styles.historyTitle}>Recent Transitions</Text>
      {displayTransitions.map((t, index) => (
        <View key={index} style={styles.historyItem}>
          <View style={styles.historyIcons}>
            <StateIndicator state={t.from} variant="minimal" showLabel={false} />
            <Ionicons name="arrow-forward" size={12} color="#999" />
            <StateIndicator state={t.to} variant="minimal" showLabel={false} />
          </View>
          <View style={styles.historyInfo}>
            <Text style={styles.historyReason} numberOfLines={1}>
              {t.reason}
            </Text>
            <Text style={styles.historyTime}>
              {formatTimeAgo(t.timestamp)} · {Math.round(t.confidence * 100)}% confident
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
};

// ============================================================================
// Helpers
// ============================================================================

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  // Minimal variant
  minimal: {
    padding: 4,
  },
  
  // Badge variant
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  
  // Chip variant
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  
  // Card variant
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#888',
    marginLeft: 38,
  },
  
  // Emoji
  emoji: {
    fontSize: 18,
  },
  emojiMinimal: {
    fontSize: 14,
  },
  
  // Selector
  selectorContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  selectorItem: {
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    backgroundColor: '#fafafa',
    minWidth: 80,
  },
  selectorItemDisabled: {
    opacity: 0.4,
  },
  selectorText: {
    fontSize: 12,
    marginTop: 4,
    color: '#666',
  },
  selectorTextDisabled: {
    color: '#ccc',
  },
  
  // History
  historyContainer: {
    padding: 16,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  historyEmpty: {
    color: '#999',
    fontSize: 14,
    textAlign: 'center',
  },
  historyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  historyIcons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyInfo: {
    flex: 1,
  },
  historyReason: {
    fontSize: 13,
    color: '#333',
  },
  historyTime: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
});

export default StateIndicator;
