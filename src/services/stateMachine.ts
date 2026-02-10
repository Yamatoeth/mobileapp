/**
 * State Machine Service
 * 
 * Manages life state transitions with validation rules, logging, and
 * automatic detection based on biometrics, calendar, and time context.
 * 
 * 6 Life States:
 * - sleeping: User is asleep (low BPM + HRV patterns, nighttime)
 * - exercising: User is working out (high BPM, movement)
 * - working: User is in focus/work mode (moderate biometrics, work hours)
 * - meeting: User is in a meeting (calendar event with attendees)
 * - leisure: User is relaxed/free time
 * - stressed: User shows stress signals (low HRV, elevated BPM)
 */

import { LifeState } from '../store/biometricStore';

// ============================================================================
// Types
// ============================================================================

export interface StateTransition {
  from: LifeState;
  to: LifeState;
  timestamp: Date;
  reason: string;
  confidence: number;
  biometrics?: {
    hrvMs: number;
    bpm: number;
    stressScore: number;
  };
  context?: {
    hasActiveEvent: boolean;
    isWorkHours: boolean;
    isNightTime: boolean;
  };
}

export interface TransitionLog {
  transitions: StateTransition[];
  maxLogSize: number;
}

export interface StateDetectionInput {
  hrvMs: number;
  bpm: number;
  stressScore: number;
  currentTime: Date;
  hasActiveCalendarEvent: boolean;
  activeEventHasAttendees: boolean;
  hasMovement: boolean;
  movementIntensity?: number; // 0-1
  manualOverride?: LifeState;
}

export interface StateDetectionResult {
  state: LifeState;
  confidence: number;
  reason: string;
  signals: string[];
}

// ============================================================================
// Valid State Transitions Matrix
// ============================================================================

/**
 * Defines which state transitions are allowed.
 * Key: current state, Value: array of valid next states
 * 
 * Transition rules:
 * - From sleeping: can wake up to any state
 * - To sleeping: only from leisure/working (not from exercising/meeting)
 * - Stressed: can be entered from any state, can exit to any state
 * - Meeting: entered from working/leisure, exits to working/leisure
 */
const VALID_TRANSITIONS: Record<LifeState, LifeState[]> = {
  sleeping: ['exercising', 'working', 'meeting', 'leisure', 'stressed'],
  exercising: ['working', 'leisure', 'stressed', 'meeting'],
  working: ['sleeping', 'exercising', 'meeting', 'leisure', 'stressed'],
  meeting: ['working', 'leisure', 'stressed', 'exercising'],
  leisure: ['sleeping', 'exercising', 'working', 'meeting', 'stressed'],
  stressed: ['sleeping', 'exercising', 'working', 'meeting', 'leisure'],
};

// ============================================================================
// Detection Thresholds
// ============================================================================

const THRESHOLDS = {
  // Sleep detection
  sleep: {
    maxBpm: 65,
    minHrv: 40,
    nightStartHour: 22, // 10 PM
    nightEndHour: 6,    // 6 AM
  },
  
  // Exercise detection
  exercise: {
    minBpm: 100,
    highBpm: 130,
    lowHrv: 35, // HRV typically drops during exercise
  },
  
  // Stress detection
  stress: {
    maxHrv: 30,
    minBpm: 85,
    stressScoreThreshold: 0.6,
  },
  
  // Working hours (for work state detection)
  work: {
    startHour: 9,
    endHour: 18,
  },
  
  // Confidence thresholds
  confidence: {
    high: 0.85,
    medium: 0.65,
    low: 0.4,
  },
};

// ============================================================================
// State Machine Service
// ============================================================================

class StateMachineService {
  private currentState: LifeState = 'leisure';
  private transitionLog: TransitionLog = {
    transitions: [],
    maxLogSize: 100,
  };
  private onTransitionCallbacks: ((transition: StateTransition) => void)[] = [];
  
  constructor() {
    console.log('[StateMachine] Initialized with state:', this.currentState);
  }
  
  // --------------------------------------------------------------------------
  // Public API
  // --------------------------------------------------------------------------
  
  /**
   * Get current life state
   */
  getCurrentState(): LifeState {
    return this.currentState;
  }
  
  /**
   * Attempt to transition to a new state.
   * Returns true if transition was successful, false if invalid.
   */
  transition(
    newState: LifeState,
    reason: string,
    confidence: number = 0.5,
    biometrics?: StateTransition['biometrics'],
    context?: StateTransition['context']
  ): boolean {
    const oldState = this.currentState;
    
    // Same state - no transition needed
    if (oldState === newState) {
      return true;
    }
    
    // Validate transition
    if (!this.isValidTransition(oldState, newState)) {
      console.warn(
        `[StateMachine] Invalid transition: ${oldState} → ${newState} (reason: ${reason})`
      );
      return false;
    }
    
    // Create transition record
    const transition: StateTransition = {
      from: oldState,
      to: newState,
      timestamp: new Date(),
      reason,
      confidence,
      biometrics,
      context,
    };
    
    // Execute transition
    this.currentState = newState;
    this.logTransition(transition);
    
    console.log(
      `[StateMachine] Transition: ${oldState} → ${newState} ` +
      `(confidence: ${(confidence * 100).toFixed(0)}%, reason: ${reason})`
    );
    
    // Notify listeners
    this.notifyTransition(transition);
    
    return true;
  }
  
  /**
   * Force set state (bypasses validation, for testing/debugging)
   */
  forceState(state: LifeState, reason: string = 'Manual override'): void {
    const transition: StateTransition = {
      from: this.currentState,
      to: state,
      timestamp: new Date(),
      reason: `[FORCED] ${reason}`,
      confidence: 1.0,
    };
    
    this.currentState = state;
    this.logTransition(transition);
    this.notifyTransition(transition);
    
    console.log(`[StateMachine] Force set state to: ${state}`);
  }
  
  /**
   * Check if a transition is valid
   */
  isValidTransition(from: LifeState, to: LifeState): boolean {
    return VALID_TRANSITIONS[from]?.includes(to) ?? false;
  }
  
  /**
   * Get all valid next states from current state
   */
  getValidNextStates(): LifeState[] {
    return VALID_TRANSITIONS[this.currentState] ?? [];
  }
  
  /**
   * Detect appropriate state from input signals
   */
  detectState(input: StateDetectionInput): StateDetectionResult {
    const signals: string[] = [];
    let state: LifeState = this.currentState;
    let confidence = THRESHOLDS.confidence.low;
    let reason = 'No state change detected';
    
    // Manual override takes precedence
    if (input.manualOverride) {
      return {
        state: input.manualOverride,
        confidence: 1.0,
        reason: 'Manual override',
        signals: ['USER_OVERRIDE'],
      };
    }
    
    const hour = input.currentTime.getHours();
    const isNightTime = hour >= THRESHOLDS.sleep.nightStartHour || 
                        hour < THRESHOLDS.sleep.nightEndHour;
    const isWorkHours = hour >= THRESHOLDS.work.startHour && 
                        hour < THRESHOLDS.work.endHour;
    
    // Priority 1: Meeting detection (calendar-based, highest confidence)
    if (input.hasActiveCalendarEvent && input.activeEventHasAttendees) {
      signals.push('ACTIVE_CALENDAR_EVENT', 'HAS_ATTENDEES');
      state = 'meeting';
      confidence = THRESHOLDS.confidence.high;
      reason = 'In calendar event with attendees';
    }
    // Priority 2: Exercise detection (biometric + movement)
    else if (
      input.bpm >= THRESHOLDS.exercise.minBpm ||
      (input.hasMovement && input.bpm >= THRESHOLDS.exercise.minBpm - 20)
    ) {
      signals.push('HIGH_BPM');
      if (input.hasMovement) signals.push('MOVEMENT_DETECTED');
      
      if (input.bpm >= THRESHOLDS.exercise.highBpm) {
        confidence = THRESHOLDS.confidence.high;
      } else if (input.hasMovement) {
        confidence = THRESHOLDS.confidence.medium;
      } else {
        confidence = THRESHOLDS.confidence.low;
      }
      
      state = 'exercising';
      reason = `Exercise detected (BPM: ${input.bpm})`;
    }
    // Priority 3: Stress detection
    else if (
      input.hrvMs < THRESHOLDS.stress.maxHrv &&
      input.bpm >= THRESHOLDS.stress.minBpm &&
      input.stressScore >= THRESHOLDS.stress.stressScoreThreshold
    ) {
      signals.push('LOW_HRV', 'ELEVATED_BPM', 'HIGH_STRESS_SCORE');
      state = 'stressed';
      confidence = THRESHOLDS.confidence.medium + 
                   (input.stressScore - THRESHOLDS.stress.stressScoreThreshold) * 0.3;
      reason = `Stress signals (HRV: ${input.hrvMs}ms, BPM: ${input.bpm}, Stress: ${(input.stressScore * 100).toFixed(0)}%)`;
    }
    // Priority 4: Sleep detection
    else if (
      isNightTime &&
      input.bpm <= THRESHOLDS.sleep.maxBpm &&
      input.hrvMs >= THRESHOLDS.sleep.minHrv &&
      !input.hasMovement
    ) {
      signals.push('NIGHT_TIME', 'LOW_BPM', 'GOOD_HRV', 'NO_MOVEMENT');
      state = 'sleeping';
      confidence = THRESHOLDS.confidence.high;
      reason = 'Sleep patterns detected';
    }
    // Priority 5: Work detection (work hours + moderate biometrics)
    else if (isWorkHours && !input.hasActiveCalendarEvent) {
      signals.push('WORK_HOURS');
      state = 'working';
      confidence = THRESHOLDS.confidence.medium;
      reason = 'During work hours';
    }
    // Default: Leisure
    else {
      signals.push('DEFAULT_STATE');
      state = 'leisure';
      confidence = THRESHOLDS.confidence.low;
      reason = 'No specific activity detected';
    }
    
    return { state, confidence, reason, signals };
  }
  
  /**
   * Auto-detect and transition to appropriate state
   */
  autoTransition(input: StateDetectionInput): StateDetectionResult {
    const result = this.detectState(input);
    
    // Only transition if confidence is high enough and state is different
    if (result.state !== this.currentState && result.confidence >= THRESHOLDS.confidence.medium) {
      this.transition(
        result.state,
        result.reason,
        result.confidence,
        {
          hrvMs: input.hrvMs,
          bpm: input.bpm,
          stressScore: input.stressScore,
        },
        {
          hasActiveEvent: input.hasActiveCalendarEvent,
          isWorkHours: input.currentTime.getHours() >= THRESHOLDS.work.startHour &&
                       input.currentTime.getHours() < THRESHOLDS.work.endHour,
          isNightTime: input.currentTime.getHours() >= THRESHOLDS.sleep.nightStartHour ||
                       input.currentTime.getHours() < THRESHOLDS.sleep.nightEndHour,
        }
      );
    }
    
    return result;
  }
  
  /**
   * Register callback for state transitions
   */
  onTransition(callback: (transition: StateTransition) => void): () => void {
    this.onTransitionCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.onTransitionCallbacks.indexOf(callback);
      if (index > -1) {
        this.onTransitionCallbacks.splice(index, 1);
      }
    };
  }
  
  /**
   * Get transition history
   */
  getTransitionLog(): StateTransition[] {
    return [...this.transitionLog.transitions];
  }
  
  /**
   * Get last N transitions
   */
  getRecentTransitions(count: number = 5): StateTransition[] {
    return this.transitionLog.transitions.slice(-count);
  }
  
  /**
   * Get time spent in each state (from log)
   */
  getStateTimeDistribution(): Record<LifeState, number> {
    const distribution: Record<LifeState, number> = {
      sleeping: 0,
      exercising: 0,
      working: 0,
      meeting: 0,
      leisure: 0,
      stressed: 0,
    };
    
    const transitions = this.transitionLog.transitions;
    
    for (let i = 0; i < transitions.length - 1; i++) {
      const current = transitions[i];
      const next = transitions[i + 1];
      const duration = next.timestamp.getTime() - current.timestamp.getTime();
      distribution[current.to] += duration;
    }
    
    // Add time in current state since last transition
    if (transitions.length > 0) {
      const lastTransition = transitions[transitions.length - 1];
      const timeSinceLastTransition = Date.now() - lastTransition.timestamp.getTime();
      distribution[lastTransition.to] += timeSinceLastTransition;
    }
    
    return distribution;
  }
  
  /**
   * Clear transition log
   */
  clearLog(): void {
    this.transitionLog.transitions = [];
    console.log('[StateMachine] Transition log cleared');
  }
  
  /**
   * Reset to initial state
   */
  reset(): void {
    this.currentState = 'leisure';
    this.transitionLog.transitions = [];
    console.log('[StateMachine] Reset to initial state');
  }
  
  // --------------------------------------------------------------------------
  // State Display Helpers
  // --------------------------------------------------------------------------
  
  /**
   * Get human-readable state name
   */
  getStateName(state: LifeState = this.currentState): string {
    const names: Record<LifeState, string> = {
      sleeping: 'Sleeping',
      exercising: 'Exercising',
      working: 'Working',
      meeting: 'In Meeting',
      leisure: 'Leisure',
      stressed: 'Stressed',
    };
    return names[state];
  }
  
  /**
   * Get state icon (Ionicons name)
   */
  getStateIcon(state: LifeState = this.currentState): string {
    const icons: Record<LifeState, string> = {
      sleeping: 'moon',
      exercising: 'fitness',
      working: 'briefcase',
      meeting: 'people',
      leisure: 'cafe',
      stressed: 'alert-circle',
    };
    return icons[state];
  }
  
  /**
   * Get state color (for UI indicators)
   */
  getStateColor(state: LifeState = this.currentState): string {
    const colors: Record<LifeState, string> = {
      sleeping: '#6366f1',  // indigo
      exercising: '#22c55e', // green
      working: '#3b82f6',   // blue
      meeting: '#f59e0b',   // amber
      leisure: '#8b5cf6',   // purple
      stressed: '#ef4444',  // red
    };
    return colors[state];
  }
  
  /**
   * Get state emoji
   */
  getStateEmoji(state: LifeState = this.currentState): string {
    const emojis: Record<LifeState, string> = {
      sleeping: '😴',
      exercising: '🏃',
      working: '💼',
      meeting: '👥',
      leisure: '☕',
      stressed: '😰',
    };
    return emojis[state];
  }
  
  // --------------------------------------------------------------------------
  // Private Methods
  // --------------------------------------------------------------------------
  
  private logTransition(transition: StateTransition): void {
    this.transitionLog.transitions.push(transition);
    
    // Trim log if it exceeds max size
    if (this.transitionLog.transitions.length > this.transitionLog.maxLogSize) {
      this.transitionLog.transitions = this.transitionLog.transitions.slice(
        -this.transitionLog.maxLogSize
      );
    }
  }
  
  private notifyTransition(transition: StateTransition): void {
    this.onTransitionCallbacks.forEach((callback) => {
      try {
        callback(transition);
      } catch (error) {
        console.error('[StateMachine] Transition callback error:', error);
      }
    });
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const stateMachineService = new StateMachineService();

// Export thresholds for testing/configuration
export { THRESHOLDS, VALID_TRANSITIONS };

export default stateMachineService;
