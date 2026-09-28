/**
 * Live Supabase Notification Service Implementation.
 * Conforms to NotificationServiceInterface and integrates with Supabase database and Realtime.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  CreateNotificationInput,
  Notification,
  NotificationServiceInterface,
} from '@/types';
import { createSupabaseServerClient, createSupabaseBrowserClient } from './client';
import { mapSupabaseError } from './errors';
import type { SupabaseClientProvider } from './SupabaseLoanService';

export class SupabaseNotificationService implements NotificationServiceInterface {
  private clientProvider?: SupabaseClientProvider;

  constructor(client?: SupabaseClientProvider) {
    this.clientProvider = client;
  }

  private async getClient(): Promise<SupabaseClient> {
    if (!this.clientProvider) {
      if (typeof window !== 'undefined') {
        return createSupabaseBrowserClient();
      }
      return createSupabaseServerClient();
    }
    if (typeof this.clientProvider === 'function') {
      return await this.clientProvider();
    }
    return this.clientProvider;
  }

  async getNotifications(userId: string): Promise<Notification[]> {
    const client = await this.getClient();
    const { data, error } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      throw mapSupabaseError(error);
    }

    return (data ?? []) as Notification[];
  }

  async getUnreadCount(userId: string): Promise<number> {
    const client = await this.getClient();
    const { count, error } = await client
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      throw mapSupabaseError(error);
    }

    return count ?? 0;
  }

  async createNotification(input: CreateNotificationInput): Promise<Notification> {
    const client = await this.getClient();
    const { data, error } = await client
      .from('notifications')
      .insert({
        user_id: input.user_id,
        title: input.title,
        message: input.message,
        type: input.type ?? 'info',
        read: false,
        action_url: input.action_url ?? null,
      })
      .select()
      .single();

    if (error) {
      throw mapSupabaseError(error);
    }

    return data as Notification;
  }

  async markAsRead(notificationId: string): Promise<Notification> {
    const client = await this.getClient();
    const { data, error } = await client
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId)
      .select()
      .single();

    if (error) {
      throw mapSupabaseError(error);
    }

    return data as Notification;
  }

  async markAllAsRead(userId: string): Promise<void> {
    const client = await this.getClient();
    const { error } = await client
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      throw mapSupabaseError(error);
    }
  }

  subscribeToNotifications(
    userId: string,
    callback: (notification: Notification) => void
  ): () => void {
    let activeChannel: ReturnType<SupabaseClient['channel']> | null = null;

    this.getClient().then((client) => {
      activeChannel = client
        .channel(`public:notifications:user_${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            if (payload.new) {
              callback(payload.new as Notification);
            }
          }
        )
        .subscribe();
    });

    return () => {
      if (activeChannel) {
        this.getClient().then((client) => {
          client.removeChannel(activeChannel!);
        });
      }
    };
  }
}
