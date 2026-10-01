'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Notification } from '@/types';
import { useServices } from '@/context/ServiceProvider';
import { createServices } from '@/services/factory';
import { createSupabaseBrowserClient } from '@/services/supabase';
import styles from './layout/notificationBell.module.css';

export interface NotificationBellProps {
  userId?: string;
  supabaseClient?: SupabaseClient;
  initialNotifications?: Notification[];
  initialUnreadCount?: number;
  onNotificationClick?: (notification: Notification) => void;
  className?: string;
}

export function NotificationBell({
  userId,
  supabaseClient,
  initialNotifications,
  initialUnreadCount,
  onNotificationClick,
  className = '',
}: NotificationBellProps) {
  let servicesFromContext: ReturnType<typeof useServices> | null = null;
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    servicesFromContext = useServices({ fallback: true });
  } catch {
    servicesFromContext = null;
  }

  const [isOpen, setIsOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(userId);
  const [notifications, setNotifications] = useState<Notification[]>(
    initialNotifications ?? []
  );
  const [unreadCount, setUnreadCount] = useState<number>(
    initialUnreadCount ?? (initialNotifications ? initialNotifications.filter((n) => !n.read).length : 0)
  );
  const [activeToast, setActiveToast] = useState<Notification | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync with prop changes
  useEffect(() => {
    if (userId) setCurrentUserId(userId);
  }, [userId]);

  useEffect(() => {
    if (initialNotifications !== undefined) {
      setNotifications(initialNotifications);
      setUnreadCount(
        initialUnreadCount !== undefined
          ? initialUnreadCount
          : initialNotifications.filter((n) => !n.read).length
      );
    }
  }, [initialNotifications, initialUnreadCount]);

  // Resolve user session if userId is not provided
  useEffect(() => {
    if (userId || currentUserId || initialNotifications) return;

    let isMounted = true;
    async function resolveUser() {
      try {
        const client = supabaseClient || createSupabaseBrowserClient();
        const { data } = await client.auth.getSession();
        if (isMounted && data?.session?.user?.id) {
          setCurrentUserId(data.session.user.id);
        }
      } catch {
        // Ignored
      }
    }
    resolveUser();

    return () => {
      isMounted = false;
    };
  }, [userId, currentUserId, initialNotifications, supabaseClient]);

  // Load notifications from service or database
  const loadNotifications = useCallback(async () => {
    if (!currentUserId || initialNotifications) return;

    try {
      const resolvedServices =
        servicesFromContext ??
        (() => {
          try {
            return createServices();
          } catch {
            return createServices({ useMocks: true });
          }
        })();

      if (resolvedServices.notifications) {
        const list = await resolvedServices.notifications.getNotifications(currentUserId);
        setNotifications(list);
        setUnreadCount(list.filter((n) => !n.read).length);
      } else if (supabaseClient) {
        const { data } = await supabaseClient
          .from('notifications')
          .select('*')
          .eq('user_id', currentUserId)
          .order('created_at', { ascending: false });
        if (data) {
          setNotifications(data as Notification[]);
          setUnreadCount((data as Notification[]).filter((n) => !n.read).length);
        }
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  }, [currentUserId, initialNotifications, servicesFromContext, supabaseClient]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Real-time updates subscription
  useEffect(() => {
    if (!currentUserId) return;

    const resolvedServices =
      servicesFromContext ??
      (() => {
        try {
          return createServices();
        } catch {
          return createServices({ useMocks: true });
        }
      })();

    let unsubscribe: (() => void) | undefined;

    const handleNewNotification = (newNotif: Notification) => {
      setNotifications((prev) => {
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        return [newNotif, ...prev];
      });
      setUnreadCount((prev) => prev + 1);

      // Check high priority event for floating toast alert (Issue #71)
      const isHighPriority =
        newNotif.type === 'success' ||
        newNotif.type === 'warning' ||
        /inversi[oó]n|cobro|cuota|fonde|subasta|aprobado|retiro/i.test(
          `${newNotif.title} ${newNotif.message}`
        );

      if (isHighPriority) {
        setActiveToast(newNotif);
      }
    };

    if (supabaseClient && typeof supabaseClient.channel === 'function') {
      const channel = supabaseClient
        .channel('user-notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${currentUserId}`,
          },
          (payload: any) => {
            if (payload?.new) {
              handleNewNotification(payload.new as Notification);
            }
          }
        )
        .subscribe();

      unsubscribe = () => {
        if (typeof (channel as any)?.unsubscribe === 'function') {
          (channel as any).unsubscribe();
        }
        if (typeof supabaseClient.removeChannel === 'function') {
          supabaseClient.removeChannel(channel);
        }
      };
    } else if (resolvedServices.notifications?.subscribeToNotifications) {
      unsubscribe = resolvedServices.notifications.subscribeToNotifications(
        currentUserId,
        handleNewNotification
      );
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [currentUserId, servicesFromContext, supabaseClient]);

  // Auto-dismiss floating toast alert after 6 seconds (Issue #71)
  useEffect(() => {
    if (!activeToast) return;
    const timer = setTimeout(() => {
      setActiveToast(null);
    }, 6000);
    return () => clearTimeout(timer);
  }, [activeToast]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggle = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        setActiveToast(null);
      }
      return next;
    });
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Optimistically update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    if (initialNotifications) return;

    try {
      const resolvedServices =
        servicesFromContext ??
        (() => {
          try {
            return createServices();
          } catch {
            return createServices({ useMocks: true });
          }
        })();

      if (resolvedServices.notifications) {
        await resolvedServices.notifications.markAsRead(id);
      } else if (supabaseClient) {
        await supabaseClient.from('notifications').update({ read: true }).eq('id', id);
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);

    if (initialNotifications || !currentUserId) return;

    try {
      const resolvedServices =
        servicesFromContext ??
        (() => {
          try {
            return createServices();
          } catch {
            return createServices({ useMocks: true });
          }
        })();

      if (resolvedServices.notifications) {
        await resolvedServices.notifications.markAllAsRead(currentUserId);
      } else if (supabaseClient) {
        await supabaseClient
          .from('notifications')
          .update({ read: true })
          .eq('user_id', currentUserId)
          .eq('read', false);
      }
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  };

  const handleActionClick = (notif: Notification) => {
    if (!notif.read) {
      handleMarkAsRead(notif.id);
    }
    setIsOpen(false);
    if (onNotificationClick) {
      onNotificationClick(notif);
    }
  };

  const formatTimestamp = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div ref={containerRef} className={`${styles.container} ${className}`.trim()}>
      <button
        type="button"
        className={styles.bellButton}
        onClick={handleToggle}
        aria-label="Notificaciones"
        aria-expanded={isOpen}
        data-testid="notification-bell-button"
      >
        <svg
          className={styles.bellIcon}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>

        {/* Unread count badge - hidden when unreadCount is 0 */}
        {unreadCount > 0 && (
          <span className={styles.badge} data-testid="notification-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={styles.dropdown}
          role="region"
          aria-label="Panel de notificaciones"
          data-testid="notification-dropdown"
        >
          <div className={styles.dropdownHeader}>
            <h3 className={styles.dropdownTitle}>Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                type="button"
                className={styles.markAllBtn}
                onClick={handleMarkAllAsRead}
                data-testid="btn-mark-all-read"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className={styles.emptyState} data-testid="notification-empty">
              No tienes notificaciones pendientes
            </div>
          ) : (
            <ul className={styles.list} role="list">
              {notifications.map((notif) => (
                <li
                  key={notif.id}
                  className={`${styles.item} ${!notif.read ? styles.itemUnread : ''}`.trim()}
                  data-testid={`notification-item-${notif.id}`}
                >
                  <div className={styles.itemHeader}>
                    <h4
                      className={styles.itemTitle}
                      data-testid={`notification-title-${notif.id}`}
                    >
                      {notif.title}
                    </h4>
                    <span
                      className={styles.itemTime}
                      data-testid={`notification-time-${notif.id}`}
                    >
                      {formatTimestamp(notif.created_at)}
                    </span>
                  </div>

                  <p
                    className={styles.itemMessage}
                    data-testid={`notification-message-${notif.id}`}
                  >
                    {notif.message}
                  </p>

                  <div className={styles.itemFooter}>
                    {notif.action_url ? (
                      <Link
                        href={notif.action_url}
                        className={styles.itemLink}
                        onClick={() => handleActionClick(notif)}
                        data-testid={`notification-link-${notif.id}`}
                      >
                        Ver detalle →
                      </Link>
                    ) : (
                      <span />
                    )}

                    {!notif.read && (
                      <button
                        type="button"
                        className={styles.markReadBtn}
                        onClick={(e) => handleMarkAsRead(notif.id, e)}
                        data-testid={`btn-mark-read-${notif.id}`}
                      >
                        Marcar como leída
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Floating Toast Notification Alert (Issue #71) */}
      {activeToast && (
        <div
          className={styles.toastNotification}
          role="alert"
          aria-live="assertive"
          data-testid="notification-toast"
        >
          <div className={styles.toastContent}>
            <div className={styles.toastIcon} aria-hidden="true">
              {activeToast.type === 'success' ? '✓' : activeToast.type === 'warning' ? '⚠' : 'ℹ'}
            </div>
            <div className={styles.toastBody}>
              <strong className={styles.toastTitle} data-testid="toast-title">
                {activeToast.title}
              </strong>
              <p className={styles.toastMessage} data-testid="toast-message">
                {activeToast.message}
              </p>
            </div>
          </div>
          <button
            type="button"
            className={styles.toastCloseBtn}
            onClick={() => setActiveToast(null)}
            aria-label="Cerrar notificación"
            data-testid="toast-close-btn"
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
}
