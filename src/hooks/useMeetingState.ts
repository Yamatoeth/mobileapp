import { useStateMachine } from './useStateMachine';

export function useMeetingState() {
  const { isInMeeting } = useStateMachine();
  return isInMeeting;
}
