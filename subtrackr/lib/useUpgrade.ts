import { useState } from 'react';
import { Platform, Linking } from 'react-native';
import { paymentsApi } from './api';

export function useUpgrade() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const startUpgrade = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await paymentsApi.createCheckoutSession();
      const url = res.data.url;

      if (!url) throw new Error('No checkout URL returned');

      // Open Stripe checkout in browser
      if (Platform.OS === 'web') {
        window.location.href = url;
      } else {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
        } else {
          throw new Error('Cannot open payment page');
        }
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'Payment unavailable';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return { startUpgrade, loading, error };
}