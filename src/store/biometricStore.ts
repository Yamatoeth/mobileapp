// Minimal biometric store types retained for compatibility during pivot.
export type LifeState =
  | 'sleeping'
  | 'exercising'
  | 'working'
  | 'meeting'
  | 'leisure'
  | 'stressed';

// Placeholder exports for compatibility
export const useBiometricStore = () => ({ state: 'working' as LifeState });
