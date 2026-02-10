/**
 * useStateMachine Hook
 * 
 * Provides reactive access to the state machine service,
 * automatic state detection based on biometrics, and
 * calendar integration for meeting detection.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useBiometricStore, LifeState } from '../store/biometricStore';
import {
  stateMachineService,
  StateTransition,
  StateDetectionInput,
  StateDetectionResult,
} from '../services/stateMachine';
import { calendarService } from '../services/calendarService';

// ============================================================================
// Types
// ============================================================================

export interface UseStateMachineOptions {
  /** Enable automatic state detection from biometrics */
  autoDetect?: boolean;
  /** Detection interval in milliseconds (default: 30000 = 30s) */
  detectionIntervalMs?: number;
  /** Enable calendar integration for meeting detection */
  useCalendar?: boolean;
}

export interface UseStateMachineReturn {
  // Current state
  currentState: LifeState;
  previousState: LifeState | null;
  
  // State info
  stateName: string;
  stateIcon: string;
  stateColor: string;
  stateEmoji: string;
  
  // Detection
  lastDetection: StateDetectionResult | null;
  isDetecting: boolean;
  
  // Actions
  transition: (newState: LifeState, reason?: string) => boolean;
  forceState: (state: LifeState) => void;
  detectNow: () => Promise<StateDetectionResult>;
  
  // History
  recentTransitions: StateTransition[];
  stateDistribution: Record<LifeState, number>;
  
  // Calendar
  isInMeeting: boolean;
  meetingTitle: string | null;
  
  // Valid transitions
  validNextStates: LifeState[];
}

// ============================================================================
// Hook Implementation
// ============================================================================

export function useStateMachine(
  options: UseStateMachineOptions = {}
): UseStateMachineReturn {
  const {
    autoDetect = true,
    detectionIntervalMs = 30000,
    useCalendar: calendarEnabled = true,
  } = options;
  
  // State from biometric store
  const { 
    hrvMs, 
    bpm, 
    stressScore, 
    currentState: storeState,
    previousState: storePreviousState,
    setLifeState: setStoreLifeState 
  } = useBiometricStore();
  
  // Local state
  const [currentState, setCurrentState] = useState<LifeState>(
    stateMachineService.getCurrentState()
  );
  const [previousState, setPreviousState] = useState<LifeState | null>(null);
  const [lastDetection, setLastDetection] = useState<StateDetectionResult | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [recentTransitions, setRecentTransitions] = useState<StateTransition[]>([]);
  const [isInMeeting, setIsInMeeting] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState<string | null>(null);
  
  const detectionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // --------------------------------------------------------------------------
  // Transition callback
  // --------------------------------------------------------------------------
  
  useEffect(() => {
    const unsubscribe = stateMachineService.onTransition((transition) => {
      setCurrentState(transition.to);
      setPreviousState(transition.from);
      setRecentTransitions(stateMachineService.getRecentTransitions(5));
      
      // Sync with biometric store
      setStoreLifeState(transition.to);
    });
    
    return () => {
      unsubscribe();
    };
  }, [setStoreLifeState]);
  
  // --------------------------------------------------------------------------
  // Calendar sync
  // --------------------------------------------------------------------------
  
  const checkCalendar = useCallback(async () => {
    if (!calendarEnabled) return { hasActiveEvent: false, hasAttendees: false };
    
    try {
      const meetingInfo = await calendarService.getMeetingDetection();
      setIsInMeeting(meetingInfo.hasActiveEvent && meetingInfo.hasAttendees);
      setMeetingTitle(meetingInfo.eventTitle ?? null);
      return {
        hasActiveEvent: meetingInfo.hasActiveEvent,
        hasAttendees: meetingInfo.hasAttendees,
      };
    } catch (error) {
      console.error('[useStateMachine] Calendar check error:', error);
      return { hasActiveEvent: false, hasAttendees: false };
    }
  }, [calendarEnabled]);
  
  // --------------------------------------------------------------------------
  // State detection
  // --------------------------------------------------------------------------
  
  const detectNow = useCallback(async (): Promise<StateDetectionResult> => {
    setIsDetecting(true);
    
    try {
      // Get calendar context
      const calendarContext = await checkCalendar();
      
      // Build detection input
      const input: StateDetectionInput = {
        hrvMs,
        bpm,
        stressScore,
        currentTime: new Date(),
        hasActiveCalendarEvent: calendarContext.hasActiveEvent,
        activeEventHasAttendees: calendarContext.hasAttendees,
        hasMovement: false, // TODO: Integrate with motion sensors
        movementIntensity: 0,
      };
      
      // Run detection and potentially transition
      const result = stateMachineService.autoTransition(input);
      setLastDetection(result);
      
      return result;
    } finally {
      setIsDetecting(false);
    }
  }, [hrvMs, bpm, stressScore, checkCalendar]);
  
  // --------------------------------------------------------------------------
  // Auto-detection interval
  // --------------------------------------------------------------------------
  
  useEffect(() => {
    if (!autoDetect) {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      return;
    }
    
    // Initial detection
    detectNow();
    
    // Set up interval
    detectionIntervalRef.current = setInterval(() => {
      detectNow();
    }, detectionIntervalMs);
    
    return () => {
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
    };
  }, [autoDetect, detectionIntervalMs, detectNow]);
  
  // --------------------------------------------------------------------------
  // Actions
  // --------------------------------------------------------------------------
  
  const transition = useCallback(
    (newState: LifeState, reason: string = 'Manual transition'): boolean => {
      return stateMachineService.transition(newState, reason);
    },
    []
  );
  
  const forceState = useCallback((state: LifeState): void => {
    stateMachineService.forceState(state);
  }, []);
  
  // --------------------------------------------------------------------------
  // Derived values
  // --------------------------------------------------------------------------
  
  const stateName = stateMachineService.getStateName(currentState);
  const stateIcon = stateMachineService.getStateIcon(currentState);
  const stateColor = stateMachineService.getStateColor(currentState);
  const stateEmoji = stateMachineService.getStateEmoji(currentState);
  const validNextStates = stateMachineService.getValidNextStates();
  const stateDistribution = stateMachineService.getStateTimeDistribution();
  
  return {
    // Current state
    currentState,
    previousState,
    
    // State info
    stateName,
    stateIcon,
    stateColor,
    stateEmoji,
    
    // Detection
    lastDetection,
    isDetecting,
    
    // Actions
    transition,
    forceState,
    detectNow,
    
    // History
    recentTransitions,
    stateDistribution,
    
    // Calendar
    isInMeeting,
    meetingTitle,
    
    // Valid transitions
    validNextStates,
  };
}

export default useStateMachine;
