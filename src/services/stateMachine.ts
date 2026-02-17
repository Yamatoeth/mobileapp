// Minimal stateMachine service stub to satisfy UI components after pivot.
export const stateMachineService = {
  getStateName: (s: string) => String(s).toUpperCase(),
  getStateIcon: (s: string) => 'ellipse',
  getStateColor: (s: string) => '#06b6d4',
  getStateEmoji: (s: string) => '🔵',
};

export default stateMachineService;
