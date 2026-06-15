import { useCallback, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { pushNotifications } from '@/api/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

type PushConfig = {
  publicKey: string | null;
  enabled: boolean;
  persistentKeys: boolean;
  checkIntervalMinutes: number;
};

type PushSupport = {
  supported: boolean;
  reason?: string;
};

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function getPushSupport(): PushSupport {
  if (!('serviceWorker' in navigator)) {
    return { supported: false, reason: 'Deze browser ondersteunt geen service workers.' };
  }
  if (!('PushManager' in window)) {
    return { supported: false, reason: 'Deze browser ondersteunt geen pushmeldingen.' };
  }
  if (!('Notification' in window)) {
    return { supported: false, reason: 'Deze browser ondersteunt geen notificaties.' };
  }
  if (!window.isSecureContext) {
    return { supported: false, reason: 'Pushmeldingen werken alleen via HTTPS of localhost.' };
  }
  return { supported: true };
}

export function usePushNotifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification === 'undefined' ? 'default' : Notification.permission
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const support = useMemo(getPushSupport, []);

  const { data: config, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['push-config'],
    queryFn: async () => {
      const response = await pushNotifications.getConfig();
      return response.data as PushConfig;
    },
    enabled: !!user,
  });

  const refreshSubscriptionState = useCallback(async () => {
    if (!support.supported) return;
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    setIsSubscribed(!!subscription);
    setPermission(Notification.permission);
  }, [support.supported]);

  useEffect(() => {
    refreshSubscriptionState().catch(() => {
      setIsSubscribed(false);
    });
  }, [refreshSubscriptionState, user?.id]);

  const enablePush = useMutation({
    mutationFn: async () => {
      if (!support.supported) throw new Error(support.reason);
      if (!config?.publicKey) throw new Error('Pushmeldingen zijn nog niet geconfigureerd op de server.');

      const requestedPermission = await Notification.requestPermission();
      setPermission(requestedPermission);
      if (requestedPermission !== 'granted') {
        throw new Error('Notificatierechten zijn niet toegekend.');
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        });
      }

      await pushNotifications.subscribe(subscription.toJSON());
      setIsSubscribed(true);
    },
    onSuccess: () => {
      toast({
        title: 'Pushmeldingen ingeschakeld',
        description: 'Je krijgt een melding wanneer een verzonden factuur over de betalingstermijn is.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Pushmeldingen niet ingeschakeld',
        description: error instanceof Error ? error.message : 'Controleer je browserinstellingen.',
        variant: 'destructive',
      });
    },
  });

  const disablePush = useMutation({
    mutationFn: async () => {
      if (!support.supported) return;
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      const endpoint = subscription?.endpoint;

      if (subscription) {
        await subscription.unsubscribe();
      }
      if (endpoint) {
        await pushNotifications.unsubscribe(endpoint);
      }
      setIsSubscribed(false);
      setPermission(Notification.permission);
    },
    onSuccess: () => {
      toast({
        title: 'Pushmeldingen uitgeschakeld',
      });
    },
  });

  const sendTest = useMutation({
    mutationFn: async () => {
      await pushNotifications.sendTest();
    },
    onSuccess: () => {
      toast({
        title: 'Testmelding verstuurd',
        description: 'Als je browser push toestaat, verschijnt de melding zo meteen.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Testmelding mislukt',
        description: error instanceof Error ? error.message : 'Probeer pushmeldingen opnieuw in te schakelen.',
        variant: 'destructive',
      });
    },
  });

  return {
    config,
    isLoadingConfig,
    support,
    permission,
    isSubscribed,
    enablePush: enablePush.mutate,
    disablePush: disablePush.mutate,
    sendTest: sendTest.mutate,
    isEnabling: enablePush.isPending,
    isDisabling: disablePush.isPending,
    isSendingTest: sendTest.isPending,
  };
}
