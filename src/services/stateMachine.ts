// Minimal stateMachine service stub to satisfy UI components after pivot.
export const stateMachineService = {
  getStateName: (s: string) => String(s).toUpperCase(),
  getStateIcon: (_s: string) => 'ellipse',
  getStateColor: (_s: string) => '#06b6d4',
  getStateEmoji: (_s: string) => '🔵',
};

export default stateMachineService;
