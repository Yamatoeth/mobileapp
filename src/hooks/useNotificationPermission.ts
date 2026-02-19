import { useEffect, useState } from 'react';
import { requestNotificationPermissions } from '../services/notificationService';

export function useNotificationPermission() {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    requestNotificationPermissions().then(setGranted);
  }, []);

  return granted;
}
