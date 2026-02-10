/**
 * State Machine Service Tests
 * 
 * Tests for:
 * - State transition validation
 * - State detection from biometrics
 * - Calendar-based meeting detection
 * - Transition logging
 */

import {
  stateMachineService,
  VALID_TRANSITIONS,
  THRESHOLDS,
  StateDetectionInput,
} from '../../services/stateMachine';
import { LifeState } from '../../store/biometricStore';

describe('StateMachineService', () => {
  beforeEach(() => {
    // Reset state machine before each test
    stateMachineService.reset();
  });

  // =========================================================================
  // State Transition Tests
  // =========================================================================

  describe('State Transitions', () => {
    it('should start in leisure state', () => {
      expect(stateMachineService.getCurrentState()).toBe('leisure');
    });

    it('should allow valid transitions', () => {
      // leisure -> working is valid
      const success = stateMachineService.transition('working', 'Work started');
      expect(success).toBe(true);
      expect(stateMachineService.getCurrentState()).toBe('working');
    });

    it('should prevent invalid transitions', () => {
      // First go to exercising
      stateMachineService.forceState('exercising');
      
      // exercising -> sleeping is NOT in the valid transitions list
      const success = stateMachineService.transition('sleeping', 'Should fail');
      expect(success).toBe(false);
      expect(stateMachineService.getCurrentState()).toBe('exercising');
    });

    it('should allow same-state transition (no-op)', () => {
      const success = stateMachineService.transition('leisure', 'Same state');
      expect(success).toBe(true);
      expect(stateMachineService.getCurrentState()).toBe('leisure');
    });

    it('should allow force state to bypass validation', () => {
      stateMachineService.forceState('exercising');
      expect(stateMachineService.getCurrentState()).toBe('exercising');
      
      // Force invalid transition
      stateMachineService.forceState('sleeping');
      expect(stateMachineService.getCurrentState()).toBe('sleeping');
    });

    it('should track transition history', () => {
      stateMachineService.transition('working', 'Morning start');
      stateMachineService.transition('meeting', 'Standup');
      stateMachineService.transition('working', 'Back to work');
      
      const history = stateMachineService.getTransitionLog();
      expect(history.length).toBe(3);
      expect(history[0].from).toBe('leisure');
      expect(history[0].to).toBe('working');
      expect(history[2].to).toBe('working');
    });
  });

  // =========================================================================
  // Valid Transitions Matrix Tests
  // =========================================================================

  describe('Valid Transitions Matrix', () => {
    const allStates: LifeState[] = [
      'sleeping',
      'exercising',
      'working',
      'meeting',
      'leisure',
      'stressed',
    ];

    it('should define transitions for all states', () => {
      allStates.forEach((state) => {
        expect(VALID_TRANSITIONS[state]).toBeDefined();
        expect(Array.isArray(VALID_TRANSITIONS[state])).toBe(true);
      });
    });

    it('should allow stressed state to transition to any state', () => {
      const stressedTransitions = VALID_TRANSITIONS['stressed'];
      // stressed can go to any other state
      expect(stressedTransitions).toContain('sleeping');
      expect(stressedTransitions).toContain('exercising');
      expect(stressedTransitions).toContain('working');
      expect(stressedTransitions).toContain('meeting');
      expect(stressedTransitions).toContain('leisure');
    });

    it('should allow any state to transition to stressed', () => {
      allStates.forEach((state) => {
        if (state !== 'stressed') {
          expect(VALID_TRANSITIONS[state]).toContain('stressed');
        }
      });
    });

    it('should not allow exercising to go directly to sleeping', () => {
      // Exercise should transition to cooldown/leisure first
      expect(VALID_TRANSITIONS['exercising']).not.toContain('sleeping');
    });

    it('should not allow meeting to go directly to sleeping', () => {
      // Can't fall asleep in a meeting
      expect(VALID_TRANSITIONS['meeting']).not.toContain('sleeping');
    });
  });

  // =========================================================================
  // State Detection Tests
  // =========================================================================

  describe('State Detection', () => {
    const baseInput: StateDetectionInput = {
      hrvMs: 50,
      bpm: 70,
      stressScore: 0.3,
      currentTime: new Date('2024-01-15T10:00:00'),
      hasActiveCalendarEvent: false,
      activeEventHasAttendees: false,
      hasMovement: false,
      movementIntensity: 0,
    };

    it('should detect meeting state from calendar events with attendees', () => {
      const input: StateDetectionInput = {
        ...baseInput,
        hasActiveCalendarEvent: true,
        activeEventHasAttendees: true,
      };
      
      const result = stateMachineService.detectState(input);
      expect(result.state).toBe('meeting');
      expect(result.confidence).toBeGreaterThanOrEqual(THRESHOLDS.confidence.high);
      expect(result.signals).toContain('ACTIVE_CALENDAR_EVENT');
      expect(result.signals).toContain('HAS_ATTENDEES');
    });

    it('should detect exercise state from high BPM', () => {
      const input: StateDetectionInput = {
        ...baseInput,
        bpm: 140,
        hasMovement: true,
      };
      
      const result = stateMachineService.detectState(input);
      expect(result.state).toBe('exercising');
      expect(result.signals).toContain('HIGH_BPM');
    });

    it('should detect stressed state from low HRV + elevated BPM', () => {
      const input: StateDetectionInput = {
        ...baseInput,
        hrvMs: 25,
        bpm: 90,
        stressScore: 0.7,
      };
      
      const result = stateMachineService.detectState(input);
      expect(result.state).toBe('stressed');
      expect(result.signals).toContain('LOW_HRV');
      expect(result.signals).toContain('HIGH_STRESS_SCORE');
    });

    it('should detect sleeping state at night with low BPM', () => {
      const input: StateDetectionInput = {
        ...baseInput,
        currentTime: new Date('2024-01-15T23:30:00'), // 11:30 PM
        bpm: 58,
        hrvMs: 55,
        hasMovement: false,
      };
      
      const result = stateMachineService.detectState(input);
      expect(result.state).toBe('sleeping');
      expect(result.signals).toContain('NIGHT_TIME');
      expect(result.signals).toContain('LOW_BPM');
    });

    it('should detect working state during work hours', () => {
      const input: StateDetectionInput = {
        ...baseInput,
        currentTime: new Date('2024-01-15T14:00:00'), // 2 PM
      };
      
      const result = stateMachineService.detectState(input);
      expect(result.state).toBe('working');
      expect(result.signals).toContain('WORK_HOURS');
    });

    it('should default to leisure when no specific activity detected', () => {
      const input: StateDetectionInput = {
        ...baseInput,
        currentTime: new Date('2024-01-15T20:00:00'), // 8 PM (evening)
      };
      
      const result = stateMachineService.detectState(input);
      expect(result.state).toBe('leisure');
    });

    it('should respect manual override', () => {
      const input: StateDetectionInput = {
        ...baseInput,
        bpm: 140, // Would normally detect as exercising
        manualOverride: 'working',
      };
      
      const result = stateMachineService.detectState(input);
      expect(result.state).toBe('working');
      expect(result.confidence).toBe(1.0);
      expect(result.signals).toContain('USER_OVERRIDE');
    });

    it('should prioritize meeting over exercise detection', () => {
      const input: StateDetectionInput = {
        ...baseInput,
        bpm: 110, // Elevated, but in meeting
        hasActiveCalendarEvent: true,
        activeEventHasAttendees: true,
      };
      
      const result = stateMachineService.detectState(input);
      expect(result.state).toBe('meeting');
    });
  });

  // =========================================================================
  // Transition Callback Tests
  // =========================================================================

  describe('Transition Callbacks', () => {
    it('should notify callbacks on transition', () => {
      const callback = jest.fn();
      const unsubscribe = stateMachineService.onTransition(callback);
      
      stateMachineService.transition('working', 'Test');
      
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'leisure',
          to: 'working',
          reason: 'Test',
        })
      );
      
      unsubscribe();
    });

    it('should not notify after unsubscribe', () => {
      const callback = jest.fn();
      const unsubscribe = stateMachineService.onTransition(callback);
      
      unsubscribe();
      stateMachineService.transition('working', 'Test');
      
      expect(callback).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // Display Helper Tests
  // =========================================================================

  describe('Display Helpers', () => {
    it('should return correct state names', () => {
      expect(stateMachineService.getStateName('working')).toBe('Working');
      expect(stateMachineService.getStateName('meeting')).toBe('In Meeting');
      expect(stateMachineService.getStateName('stressed')).toBe('Stressed');
    });

    it('should return valid icon names', () => {
      const allStates: LifeState[] = [
        'sleeping',
        'exercising',
        'working',
        'meeting',
        'leisure',
        'stressed',
      ];
      
      allStates.forEach((state) => {
        const icon = stateMachineService.getStateIcon(state);
        expect(typeof icon).toBe('string');
        expect(icon.length).toBeGreaterThan(0);
      });
    });

    it('should return valid hex colors', () => {
      const allStates: LifeState[] = [
        'sleeping',
        'exercising',
        'working',
        'meeting',
        'leisure',
        'stressed',
      ];
      
      allStates.forEach((state) => {
        const color = stateMachineService.getStateColor(state);
        expect(color).toMatch(/^#[0-9a-fA-F]{6}$/);
      });
    });

    it('should return emojis for all states', () => {
      const allStates: LifeState[] = [
        'sleeping',
        'exercising',
        'working',
        'meeting',
        'leisure',
        'stressed',
      ];
      
      allStates.forEach((state) => {
        const emoji = stateMachineService.getStateEmoji(state);
        expect(emoji.length).toBeGreaterThan(0);
      });
    });
  });

  // =========================================================================
  // State Time Distribution Tests
  // =========================================================================

  describe('State Time Distribution', () => {
    it('should track time spent in each state', async () => {
      // Make some transitions with small delays
      stateMachineService.transition('working', 'Start work');
      
      // Wait a bit
      await new Promise((r) => setTimeout(r, 50));
      
      stateMachineService.transition('meeting', 'Daily standup');
      
      await new Promise((r) => setTimeout(r, 50));
      
      const distribution = stateMachineService.getStateTimeDistribution();
      
      // Should have some time in working and meeting
      expect(distribution['working']).toBeGreaterThan(0);
      expect(distribution['meeting']).toBeGreaterThan(0);
    });
  });
});
