import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { Notification } from '@/types';
import { NotificationBell } from '@/components/NotificationBell';
import { ServiceProvider } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { MockStateStore } from '@/services/mock/mockState';

describe('NotificationBell Component (Issue #46)', () => {
  const sampleNotifications: Notification[] = [
    {
      id: 'notif-1',
      user_id: 'user-123',
      title: 'Préstamo aprobado',
      message: 'Tu solicitud de crédito ha sido aprobada y publicada en el marketplace.',
      type: 'success',
      read: false,
      action_url: '/dashboard/pyme',
      created_at: '2026-09-20T10:00:00.000Z',
    },
    {
      id: 'notif-2',
      user_id: 'user-123',
      title: 'Subasta completada al 100%',
      message: '¡Tu proyecto alcanzó el fondeo total! Firma tu pagaré digital para proceder al desembolso.',
      type: 'warning',
      read: false,
      action_url: '/dashboard/pyme',
      created_at: '2026-09-21T14:30:00.000Z',
    },
    {
      id: 'notif-3',
      user_id: 'user-123',
      title: 'Inversión confirmada',
      message: 'Has comprometido $2.000.000 en una subasta con éxito.',
      type: 'info',
      read: true,
      action_url: '/dashboard/inversor',
      created_at: '2026-09-19T09:15:00.000Z',
    },
  ];

  it('renders unread count badge when there are unread notifications', () => {
    render(
      <NotificationBell
        userId="user-123"
        initialNotifications={sampleNotifications}
      />
    );

    // 2 unread notifications (notif-1 and notif-2)
    const badge = screen.getByTestId('notification-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('2');
  });

  it('hides unread count badge when there are zero unread notifications', () => {
    const allReadNotifications = sampleNotifications.map((n) => ({ ...n, read: true }));

    render(
      <NotificationBell
        userId="user-123"
        initialNotifications={allReadNotifications}
      />
    );

    // Badge must not be in the document
    expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
  });

  it('opens dropdown when clicking the bell and displays notification list with title, message, time, and action URL', () => {
    render(
      <NotificationBell
        userId="user-123"
        initialNotifications={sampleNotifications}
      />
    );

    // Dropdown should be initially closed
    expect(screen.queryByTestId('notification-dropdown')).not.toBeInTheDocument();

    // Click bell button
    const bellBtn = screen.getByTestId('notification-bell-button');
    fireEvent.click(bellBtn);

    // Dropdown is open
    const dropdown = screen.getByTestId('notification-dropdown');
    expect(dropdown).toBeInTheDocument();

    // Details for notif-1
    expect(screen.getByTestId('notification-title-notif-1')).toHaveTextContent('Préstamo aprobado');
    expect(screen.getByTestId('notification-message-notif-1')).toHaveTextContent(
      'Tu solicitud de crédito ha sido aprobada y publicada en el marketplace.'
    );
    expect(screen.getByTestId('notification-time-notif-1')).toBeInTheDocument();
    expect(screen.getByTestId('notification-link-notif-1')).toHaveAttribute('href', '/dashboard/pyme');

    // Details for notif-2
    expect(screen.getByTestId('notification-title-notif-2')).toHaveTextContent('Subasta completada al 100%');
  });

  it('renders empty state "No tienes notificaciones pendientes" when notification list is empty', () => {
    render(
      <NotificationBell
        userId="user-123"
        initialNotifications={[]}
      />
    );

    // Open dropdown
    const bellBtn = screen.getByTestId('notification-bell-button');
    fireEvent.click(bellBtn);

    const empty = screen.getByTestId('notification-empty');
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveTextContent('No tienes notificaciones pendientes');
  });

  it('marks an individual notification as read and decrements unread count', async () => {
    render(
      <NotificationBell
        userId="user-123"
        initialNotifications={sampleNotifications}
      />
    );

    expect(screen.getByTestId('notification-badge')).toHaveTextContent('2');

    // Open dropdown
    fireEvent.click(screen.getByTestId('notification-bell-button'));

    // Mark notif-1 as read
    const markReadBtn = screen.getByTestId('btn-mark-read-notif-1');
    fireEvent.click(markReadBtn);

    // Badge updates to 1
    await waitFor(() => {
      expect(screen.getByTestId('notification-badge')).toHaveTextContent('1');
    });

    // Mark read button for notif-1 disappears because it is now read
    expect(screen.queryByTestId('btn-mark-read-notif-1')).not.toBeInTheDocument();
  });

  it('marks all notifications as read when clicking "Marcar todas como leídas"', async () => {
    render(
      <NotificationBell
        userId="user-123"
        initialNotifications={sampleNotifications}
      />
    );

    expect(screen.getByTestId('notification-badge')).toHaveTextContent('2');

    // Open dropdown
    fireEvent.click(screen.getByTestId('notification-bell-button'));

    // Click "Marcar todas como leídas"
    const markAllBtn = screen.getByTestId('btn-mark-all-read');
    fireEvent.click(markAllBtn);

    // Badge should disappear
    await waitFor(() => {
      expect(screen.queryByTestId('notification-badge')).not.toBeInTheDocument();
    });
  });

  it('marks notification as read and calls callback when action link is clicked', async () => {
    const onClickMock = vi.fn();

    render(
      <NotificationBell
        userId="user-123"
        initialNotifications={sampleNotifications}
        onNotificationClick={onClickMock}
      />
    );

    // Open dropdown
    fireEvent.click(screen.getByTestId('notification-bell-button'));

    // Click action link of notif-1
    const actionLink = screen.getByTestId('notification-link-notif-1');
    fireEvent.click(actionLink);

    expect(onClickMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'notif-1', title: 'Préstamo aprobado' })
    );

    // Unread count decreases from 2 to 1
    await waitFor(() => {
      expect(screen.getByTestId('notification-badge')).toHaveTextContent('1');
    });
  });

  it('integrates with MockNotificationService and receives real-time updates', async () => {
    const store = new MockStateStore();
    store.notifications = [
      {
        id: 'mock-n-1',
        user_id: 'user-realtime',
        title: 'Solicitud enviada',
        message: 'Tu solicitud de crédito está en revisión.',
        type: 'info',
        read: false,
        action_url: '/dashboard/pyme',
        created_at: new Date().toISOString(),
      },
    ];

    const services = createServices({ store, useMocks: true });

    render(
      <ServiceProvider services={services}>
        <NotificationBell userId="user-realtime" />
      </ServiceProvider>
    );

    // Should load initial notification
    await waitFor(() => {
      expect(screen.getByTestId('notification-badge')).toHaveTextContent('1');
    });

    // Simulate real-time notification push
    await React.act(async () => {
      await services.notifications?.createNotification({
        user_id: 'user-realtime',
        title: 'Préstamo aprobado',
        message: 'Tu préstamo fue aprobado por el comité.',
        type: 'success',
        action_url: '/dashboard/pyme',
      });
    });

    // Unread count should increment to 2 in real time without page reload
    await waitFor(() => {
      expect(screen.getByTestId('notification-badge')).toHaveTextContent('2');
    });

    // Open dropdown to verify both notifications are visible
    fireEvent.click(screen.getByTestId('notification-bell-button'));
    expect(screen.getByText('Préstamo aprobado')).toBeInTheDocument();
    expect(screen.getByText('Solicitud enviada')).toBeInTheDocument();
  });
});
