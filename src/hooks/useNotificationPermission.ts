import { useEffect, useState } from 'react';
import { requestNotificationPermissions, setNotificationHandler } from '../services/notificationService';

export function useNotificationPermission() {
  const [granted, setGranted] = useState<boolean | null>(null);

  useEffect(() => {
    setNotificationHandler();
    requestNotificationPermissions().then(setGranted);
  }, []);

  return granted;
}
