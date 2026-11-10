/**
 * Browser Push Notification Utility (Web Notification API & Service Worker)
 */

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getBrowserNotificationPermission(): NotificationPermission {
  if (!isBrowserNotificationSupported()) return 'denied';
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission> {
  if (!isBrowserNotificationSupported()) return 'denied';
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch {
    return Notification.permission;
  }
}

export interface PushNotificationOptions {
  body?: string;
  icon?: string;
  tag?: string;
  url?: string;
  sound?: boolean;
}

/**
 * Triggers a browser push notification with sound feedback & click action
 */
export async function showBrowserNotification(
  title: string,
  options: PushNotificationOptions = {}
): Promise<boolean> {
  if (!isBrowserNotificationSupported()) return false;

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await requestBrowserNotificationPermission();
  }

  if (permission !== 'granted') return false;

  const defaultIcon = '/icons/icon-192x192.png';
  const notificationOptions: NotificationOptions & { vibrate?: number[] } = {
    body: options.body || '',
    icon: options.icon || defaultIcon,
    badge: '/favicon.png',
    tag: options.tag || 'trendpulse-notification',
    data: {
      url: options.url,
      timestamp: Date.now(),
    },
    // Vibration pattern for mobile devices (200ms vibrate, 100ms pause, 200ms vibrate)
    vibrate: [200, 100, 200],
  };

  try {
    // Prefer service worker registration showNotification if available (works on mobile PWA)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && registration.showNotification) {
          await registration.showNotification(title, notificationOptions);
          playNotificationBeep(options.sound !== false);
          return true;
        }
      } catch {
        // Fallback to standard Notification
      }
    }

    // Fallback: standard Window Notification
    const notification = new Notification(title, notificationOptions);
    if (options.url) {
      notification.onclick = (e) => {
        e.preventDefault();
        window.focus();
        window.open(options.url, '_blank');
      };
    }

    playNotificationBeep(options.sound !== false);
    return true;
  } catch (err) {
    console.warn('Could not display browser notification:', err);
    return false;
  }
}

/**
 * Simple gentle audio notification tone using Web Audio API
 */
function playNotificationBeep(enabled = true) {
  if (!enabled || typeof window === 'undefined') return;
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5

    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch {
    // Ignore audio autoplay restrictions
  }
}
