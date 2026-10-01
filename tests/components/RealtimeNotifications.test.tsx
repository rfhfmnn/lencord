import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Header } from '@/components/layout/Header';
import { NotificationBell } from '@/components/NotificationBell';
import type { Notification } from '@/types';

describe('Realtime Notifications (Supabase Realtime) and Header Alerts (Issue #71)', () => {
  let mockChannel: any;
  let mockSupabase: any;
  let eventCallback: ((payload: { new: Notification }) => void) | null = null;

  beforeEach(() => {
    eventCallback = null;
    mockChannel = {
      on: vi.fn((_event, _filter, callback) => {
        eventCallback = callback;
        return mockChannel;
      }),
      subscribe: vi.fn(() => mockChannel),
      unsubscribe: vi.fn(),
    };

    mockSupabase = {
      channel: vi.fn((_name: string) => mockChannel),
      removeChannel: vi.fn(),
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn().mockResolvedValue({ data: [] }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('subscribes to user-notifications realtime channel with correct filter', () => {
    render(
      <NotificationBell
        userId="user-realtime-1"
        supabaseClient={mockSupabase}
        initialNotifications={[]}
      />
    );

    expect(mockSupabase.channel).toHaveBeenCalledWith('user-notifications');
    expect(mockChannel.on).toHaveBeenCalledWith(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: 'user_id=eq.user-realtime-1',
      },
      expect.any(Function)
    );
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it('increments unread count, displays item in dropdown and shows floating toast on realtime event', async () => {
    render(
      <NotificationBell
        userId="user-realtime-1"
        supabaseClient={mockSupabase}
        initialNotifications={[]}
      />
    );

    // Initial state: no badge
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
    expect(screen.queryByTestId('notification-toast')).not.toBeInTheDocument();

    // Simulate incoming Realtime event
    const newNotif: Notification = {
      id: 'notif-rt-101',
      user_id: 'user-realtime-1',
      title: 'Cobro de cuota acreditado',
      message: 'Recibiste $150.000 por la cuota 1 de Metalúrgica Quilmes.',
      type: 'success',
      read: false,
      action_url: '/dashboard/inversor',
      created_at: new Date().toISOString(),
    };

    act(() => {
      eventCallback?.({ new: newNotif });
    });

    // Badge should show 1 unread
    const badge = screen.getByTestId('notification-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('1');

    // Floating Toast Notification should appear
    const toast = screen.getByTestId('notification-toast');
    expect(toast).toBeInTheDocument();
    expect(screen.getByTestId('toast-title')).toHaveTextContent('Cobro de cuota acreditado');
    expect(screen.getByTestId('toast-message')).toHaveTextContent(
      'Recibiste $150.000 por la cuota 1 de Metalúrgica Quilmes.'
    );

    // Open dropdown and check notification is displayed at top
    fireEvent.click(screen.getByTestId('notification-bell-button'));
    expect(screen.getByTestId('notification-title-notif-rt-101')).toHaveTextContent('Cobro de cuota acreditado');
    expect(screen.getByTestId('notification-item-notif-rt-101')).toHaveClass(/itemUnread/);
  });

  it('dismisses toast notification when close button is clicked', () => {
    render(
      <NotificationBell
        userId="user-realtime-1"
        supabaseClient={mockSupabase}
        initialNotifications={[]}
      />
    );

    act(() => {
      eventCallback?.({
        new: {
          id: 'notif-rt-102',
          user_id: 'user-realtime-1',
          title: 'Inversión confirmada',
          message: 'Tu inversión por $500.000 ha sido registrada.',
          type: 'success',
          read: false,
          created_at: new Date().toISOString(),
        },
      });
    });

    expect(screen.getByTestId('notification-toast')).toBeInTheDocument();

    // Click close button
    fireEvent.click(screen.getByTestId('toast-close-btn'));

    expect(screen.queryByTestId('notification-toast')).not.toBeInTheDocument();
  });

  it('automatically hides toast after 6 seconds timer', () => {
    vi.useFakeTimers();

    render(
      <NotificationBell
        userId="user-realtime-1"
        supabaseClient={mockSupabase}
        initialNotifications={[]}
      />
    );

    act(() => {
      eventCallback?.({
        new: {
          id: 'notif-rt-103',
          user_id: 'user-realtime-1',
          title: 'Préstamo fondeado al 100%',
          message: 'Los fondos han sido transferidos a tu cuenta.',
          type: 'success',
          read: false,
          created_at: new Date().toISOString(),
        },
      });
    });

    expect(screen.getByTestId('notification-toast')).toBeInTheDocument();

    // Advance 5.9 seconds -> still visible
    act(() => {
      vi.advanceTimersByTime(5900);
    });
    expect(screen.getByTestId('notification-toast')).toBeInTheDocument();

    // Advance past 6 seconds -> hidden
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId('notification-toast')).not.toBeInTheDocument();
  });

  it('cleans up channel and unsubscribes on unmount', () => {
    const { unmount } = render(
      <NotificationBell
        userId="user-realtime-1"
        supabaseClient={mockSupabase}
        initialNotifications={[]}
      />
    );

    unmount();

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });

  it('integrates seamlessly in Header component for authenticated session', () => {
    render(
      <Header
        supabaseClient={mockSupabase}
        user={{
          id: 'user-header-rt',
          name: 'Inversor Demo',
          role: 'investor',
        }}
      />
    );

    expect(mockSupabase.channel).toHaveBeenCalledWith('user-notifications');
    expect(screen.getByTestId('notification-bell-button')).toBeInTheDocument();

    // Trigger Realtime notification while Header is mounted
    act(() => {
      eventCallback?.({
        new: {
          id: 'notif-header-1',
          user_id: 'user-header-rt',
          title: 'Cobro de cuota acreditado',
          message: 'Tu cobro fue depositado en custodia.',
          type: 'success',
          read: false,
          created_at: new Date().toISOString(),
        },
      });
    });

    expect(screen.getByTestId('notification-badge')).toHaveTextContent('1');
    expect(screen.getByTestId('notification-toast')).toBeInTheDocument();
  });
});
