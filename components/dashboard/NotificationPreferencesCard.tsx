'use client';

import React, { useState, useEffect } from 'react';
import type { NotificationPreferences } from '@/types';
import { Button } from '@/components/ui/Button';
import styles from './dashboard.module.css';

export interface NotificationPreferencesCardProps {
  userId?: string;
  initialPreferences?: Partial<NotificationPreferences>;
  onSave?: (preferences: NotificationPreferences) => void;
  className?: string;
}

export const DEFAULT_PREFERENCES: NotificationPreferences = {
  email: true,
  sms: true,
  whatsapp: true,
};

export function NotificationPreferencesCard({
  userId,
  initialPreferences,
  onSave,
  className = '',
}: NotificationPreferencesCardProps) {
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    email: initialPreferences?.email ?? true,
    sms: initialPreferences?.sms ?? true,
    whatsapp: initialPreferences?.whatsapp ?? true,
  });

  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (initialPreferences) {
      setPreferences({
        email: initialPreferences.email ?? true,
        sms: initialPreferences.sms ?? true,
        whatsapp: initialPreferences.whatsapp ?? true,
      });
    }
  }, [initialPreferences]);

  const handleToggle = (channel: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [channel]: !prev[channel],
    }));
    setSaveSuccess(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      if (onSave) {
        onSave(preferences);
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Error saving notification preferences:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      className={`${styles.borrowerHeroCard} ${className}`}
      data-testid="notification-preferences-card"
      style={{ marginTop: '2rem' }}
    >
      <div className={styles.sectionHeader} style={{ marginBottom: '1.25rem' }}>
        <h3 className={styles.sectionTitle} style={{ fontSize: '1.125rem' }}>
          Canales y preferencias de notificación
        </h3>
        <p className={styles.sectionDescription}>
          Configurá de forma independiente los canales por los que deseas recibir alertas
          operativas, avisos de fondeo y recordatorios de pago.
        </p>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        {/* Email Toggle */}
        <label
          htmlFor="pref-email-toggle"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '1rem',
            background: preferences.email ? '#f8fafc' : '#ffffff',
            border: `1px solid ${preferences.email ? '#cbd5e1' : '#e2e8f0'}`,
            borderRadius: '0.5rem',
            cursor: 'pointer',
          }}
          data-testid="pref-email-container"
        >
          <input
            id="pref-email-toggle"
            type="checkbox"
            checked={preferences.email}
            onChange={() => handleToggle('email')}
            data-testid="pref-email-checkbox"
            style={{ width: '1.125rem', height: '1.125rem', marginTop: '0.2rem', cursor: 'pointer' }}
          />
          <div>
            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9375rem' }}>
              Correo electrónico
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.25rem' }}>
              Comprobantes de transferencias, resúmenes mensuales y avisos institucionales.
            </div>
          </div>
        </label>

        {/* SMS Toggle */}
        <label
          htmlFor="pref-sms-toggle"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '1rem',
            background: preferences.sms ? '#f8fafc' : '#ffffff',
            border: `1px solid ${preferences.sms ? '#cbd5e1' : '#e2e8f0'}`,
            borderRadius: '0.5rem',
            cursor: 'pointer',
          }}
          data-testid="pref-sms-container"
        >
          <input
            id="pref-sms-toggle"
            type="checkbox"
            checked={preferences.sms}
            onChange={() => handleToggle('sms')}
            data-testid="pref-sms-checkbox"
            style={{ width: '1.125rem', height: '1.125rem', marginTop: '0.2rem', cursor: 'pointer' }}
          />
          <div>
            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9375rem' }}>
              Alertas urgentes por SMS
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.25rem' }}>
              Códigos OTP de seguridad 2FA, aviso de subasta 100% fondeada y avisos de mora.
            </div>
          </div>
        </label>

        {/* WhatsApp Toggle */}
        <label
          htmlFor="pref-whatsapp-toggle"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '0.75rem',
            padding: '1rem',
            background: preferences.whatsapp ? '#f8fafc' : '#ffffff',
            border: `1px solid ${preferences.whatsapp ? '#cbd5e1' : '#e2e8f0'}`,
            borderRadius: '0.5rem',
            cursor: 'pointer',
          }}
          data-testid="pref-whatsapp-container"
        >
          <input
            id="pref-whatsapp-toggle"
            type="checkbox"
            checked={preferences.whatsapp}
            onChange={() => handleToggle('whatsapp')}
            data-testid="pref-whatsapp-checkbox"
            style={{ width: '1.125rem', height: '1.125rem', marginTop: '0.2rem', cursor: 'pointer' }}
          />
          <div>
            <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9375rem' }}>
              Mensajes por WhatsApp
            </div>
            <div style={{ fontSize: '0.8125rem', color: '#64748b', marginTop: '0.25rem' }}>
              Notificaciones enriquecidas de firma de contrato y vencimiento de cuotas.
            </div>
          </div>
        </label>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Button
          variant="primary"
          size="sm"
          onClick={handleSave}
          disabled={isSaving}
          data-testid="btn-save-notification-preferences"
        >
          {isSaving ? 'Guardando...' : 'Guardar preferencias'}
        </Button>

        {saveSuccess && (
          <span
            style={{ fontSize: '0.875rem', color: '#047857', fontWeight: 500 }}
            data-testid="pref-save-success-msg"
          >
            ✓ Preferencias de notificación guardadas exitosamente
          </span>
        )}
      </div>
    </div>
  );
}
