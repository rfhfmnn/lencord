/**
 * In-memory Mock Notification Service implementation for Lencord.
 * Conforms to NotificationServiceInterface.
 */

import type {
  CreateNotificationInput,
  Notification,
  NotificationServiceInterface,
} from '@/types';
import { MockStateStore, defaultMockStateStore } from './mockState';

export class MockNotificationService implements NotificationServiceInterface {
  private store: MockStateStore;
  private subscribers: Map<string, Set<(notification: Notification) => void>> = new Map();

  constructor(store: MockStateStore = defaultMockStateStore) {
    this.store = store;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    return this.store.notifications
      .filter((n) => n.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.store.notifications.filter((n) => n.user_id === userId && !n.read).length;
  }

  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const newNotif: Notification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      user_id: input.user_id,
      title: input.title,
      message: input.message,
      type: input.type ?? 'info',
      read: false,
      action_url: input.action_url ?? null,
      created_at: new Date().toISOString(),
    };

    this.store.notifications.unshift(newNotif);

    const userSubs = this.subscribers.get(input.user_id);
    if (userSubs) {
      userSubs.forEach((cb) => {
        try {
          cb(newNotif);
        } catch (err) {
          console.error('Error executing notification subscriber callback:', err);
        }
      });
    }

    return newNotif;
  }

  async markAsRead(notificationId: string): Promise<Notification> {
    const notif = this.store.notifications.find((n) => n.id === notificationId);
    if (!notif) {
      return {
        id: notificationId,
        user_id: '',
        title: '',
        message: '',
        type: 'info',
        read: true,
        action_url: null,
        created_at: new Date().toISOString(),
      };
    }
    notif.read = true;
    return notif;
  }

  async markAllAsRead(userId: string): Promise<void> {
    this.store.notifications.forEach((n) => {
      if (n.user_id === userId) {
        n.read = true;
      }
    });
  }

  subscribeToNotifications(
    userId: string,
    callback: (notification: Notification) => void
  ): () => void {
    if (!this.subscribers.has(userId)) {
      this.subscribers.set(userId, new Set());
    }
    this.subscribers.get(userId)!.add(callback);

    return () => {
      const subs = this.subscribers.get(userId);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(userId);
        }
      }
    };
  }
}
