import { useState } from 'react';

export function useStateMachine() {
  // Minimal hook: report basic meeting state used by components
  const [isInMeeting] = useState(false);
  return { isInMeeting };
}

export default useStateMachine;
