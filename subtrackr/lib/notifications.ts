import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';

// How notifications look when app is in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList:   true,
    shouldPlaySound:  true,
    shouldSetBadge:   true,
  }),
});

/**
 * Registers for push notifications and returns the native FCM device token.
 * Returns null on web or if permission denied.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  if (!Device.isDevice) {
    console.log('Push notifications only work on a physical device');
    return null;
  }

  // Request permission
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission denied');
    return null;
  }

  //  Get native device token (FCM on Android, APNs on iOS) 
  // This is what Firebase Admin SDK expects  NOT the Expo push token
  try {
    const tokenData = await Notifications.getDevicePushTokenAsync();
    console.log('FCM token obtained:', tokenData.data.substring(0, 20) + '...');
    return tokenData.data;
  } catch (e) {
    console.error('Failed to get device push token:', e);
    return null;
  }
}

/**
 * Sets up a listener for notifications received while app is open.
 * Call this once in your root layout.
 */
export function setupNotificationListeners() {
  // Notification received while app is foregrounded
  const sub1 = Notifications.addNotificationReceivedListener(notification => {
    console.log('Notification received:', notification.request.content.title);
  });

  // User tapped on a notification
  const sub2 = Notifications.addNotificationResponseReceivedListener(response => {
    console.log('Notification tapped:', response.notification.request.content.title);
  });

  // Return cleanup function
  return () => {
    sub1.remove();
    sub2.remove();
  };
}