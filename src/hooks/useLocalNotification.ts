import { useCallback } from 'react';
import { scheduleLocalNotification, cancelNotification } from '../services/notificationService';

export function useLocalNotification() {
  const schedule = useCallback((title: string, body: string, data?: any, trigger?: any) => {
    return scheduleLocalNotification({ title, body, data, trigger });
  }, []);

  const cancel = useCallback((id: string) => {
    return cancelNotification(id);
  }, []);

  return { schedule, cancel };
}
