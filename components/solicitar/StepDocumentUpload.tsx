'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/Button';
import styles from './solicitar.module.css';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export interface UploadedFileMeta {
  name: string;
  size: number;
  type: string;
}

export interface Step3FormData {
  afip_constancia?: UploadedFileMeta | null;
  bank_statements?: UploadedFileMeta | null;
  balance_sheet?: UploadedFileMeta | null;
  f931?: UploadedFileMeta | null;
}

export interface StepDocumentUploadProps {
  initialData?: Step3FormData;
  onBack: (data?: Step3FormData) => void;
  onContinue: (data: Step3FormData) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function StepDocumentUpload({
  initialData,
  onBack,
  onContinue,
}: StepDocumentUploadProps) {
  const [files, setFiles] = useState<Step3FormData>({
    afip_constancia: initialData?.afip_constancia ?? null,
    bank_statements: initialData?.bank_statements ?? null,
    balance_sheet: initialData?.balance_sheet ?? null,
    f931: initialData?.f931 ?? null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleFileSelection = (
    key: keyof Step3FormData,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selected = e.target.files?.[0];
    if (!selected) return;

    // Validate PDF
    const isPdf =
      selected.type === 'application/pdf' || selected.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setErrors((prev) => ({
        ...prev,
        [key]: 'Solo se permiten archivos en formato PDF.',
      }));
      e.target.value = '';
      return;
    }

    // Validate size (max 10MB)
    if (selected.size > MAX_FILE_SIZE_BYTES) {
      setErrors((prev) => ({
        ...prev,
        [key]: 'El archivo supera el tamaño máximo permitido de 10 MB.',
      }));
      e.target.value = '';
      return;
    }

    // Valid file
    setErrors((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });

    setFiles((prev) => ({
      ...prev,
      [key]: {
        name: selected.name,
        size: selected.size,
        type: selected.type,
      },
    }));
  };

  const handleRemoveFile = (key: keyof Step3FormData) => {
    setFiles((prev) => ({ ...prev, [key]: null }));
    if (errors[key]) {
      setErrors((prev) => {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      });
    }
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!files.afip_constancia) {
      newErrors.afip_constancia =
        'La Constancia de inscripción AFIP / ARCA es obligatoria para continuar.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validate()) {
      onContinue(files);
    }
  };

  return (
    <form onSubmit={handleSubmit} data-testid="step3-documents-form">
      <div className={styles.formCard}>
        <h2 className={styles.stepTitle}>Documentación de respaldo</h2>
        <p className={styles.stepDescription}>
          Adjuntá los documentos contables e impositivos en formato PDF (máximo 10 MB por archivo).
          Permitirán al equipo de Lencord calificar a tu empresa con la mejor tasa de mercado.
        </p>

        <div className={styles.uploadList}>
          {/* 1. Constancia AFIP / ARCA (Mandatory) */}
          <div
            className={`${styles.uploadCard} ${styles.uploadCardRequired}`}
            data-testid="upload-card-afip"
          >
            <div className={styles.uploadCardHeader}>
              <div>
                <h4 className={styles.uploadDocTitle}>
                  Constancia de inscripción AFIP / ARCA *
                </h4>
                <p className={styles.uploadDocDesc}>
                  Comprobante emitido con vigencia actualizada donde figure el estado tributario e impuestos activos.
                </p>
              </div>
              <span className={`${styles.uploadBadge} ${styles.uploadBadgeMandatory}`}>
                Obligatorio
              </span>
            </div>

            <div className={styles.fileInputWrapper}>
              {files.afip_constancia ? (
                <div className={styles.fileSelectedBadge} data-testid="badge-afip-file">
                  <span>📄 {files.afip_constancia.name} ({formatFileSize(files.afip_constancia.size)})</span>
                  <button
                    type="button"
                    className={styles.removeFileBtn}
                    onClick={() => handleRemoveFile('afip_constancia')}
                    aria-label="Eliminar archivo AFIP"
                    data-testid="remove-afip-file"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => handleFileSelection('afip_constancia', e)}
                  data-testid="input-file-afip"
                />
              )}
            </div>
            {errors.afip_constancia && (
              <span className={styles.errorMessage} role="alert" data-testid="error-afip">
                {errors.afip_constancia}
              </span>
            )}
          </div>

          {/* 2. Extractos bancarios (Recommended) */}
          <div className={styles.uploadCard} data-testid="upload-card-extractos">
            <div className={styles.uploadCardHeader}>
              <div>
                <h4 className={styles.uploadDocTitle}>
                  Extractos bancarios de los últimos 3 meses
                </h4>
                <p className={styles.uploadDocDesc}>
                  Resumen de movimientos de la cuenta corriente principal de la empresa.
                </p>
              </div>
              <span className={`${styles.uploadBadge} ${styles.uploadBadgeRecommended}`}>
                Recomendado
              </span>
            </div>

            <div className={styles.fileInputWrapper}>
              {files.bank_statements ? (
                <div className={styles.fileSelectedBadge} data-testid="badge-bank-file">
                  <span>📄 {files.bank_statements.name} ({formatFileSize(files.bank_statements.size)})</span>
                  <button
                    type="button"
                    className={styles.removeFileBtn}
                    onClick={() => handleRemoveFile('bank_statements')}
                    aria-label="Eliminar extractos bancarios"
                    data-testid="remove-bank-file"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => handleFileSelection('bank_statements', e)}
                  data-testid="input-file-bank"
                />
              )}
            </div>
            {errors.bank_statements && (
              <span className={styles.errorMessage} role="alert" data-testid="error-bank">
                {errors.bank_statements}
              </span>
            )}
          </div>

          {/* 3. Balance del último ejercicio (Optional) */}
          <div className={styles.uploadCard} data-testid="upload-card-balance">
            <div className={styles.uploadCardHeader}>
              <div>
                <h4 className={styles.uploadDocTitle}>Balance del último ejercicio contable</h4>
                <p className={styles.uploadDocDesc}>
                  Estados contables auditados y certificados por Consejo Profesional de Ciencias Económicas.
                </p>
              </div>
              <span className={`${styles.uploadBadge} ${styles.uploadBadgeOptional}`}>
                Opcional
              </span>
            </div>

            <div className={styles.fileInputWrapper}>
              {files.balance_sheet ? (
                <div className={styles.fileSelectedBadge} data-testid="badge-balance-file">
                  <span>📄 {files.balance_sheet.name} ({formatFileSize(files.balance_sheet.size)})</span>
                  <button
                    type="button"
                    className={styles.removeFileBtn}
                    onClick={() => handleRemoveFile('balance_sheet')}
                    aria-label="Eliminar balance"
                    data-testid="remove-balance-file"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => handleFileSelection('balance_sheet', e)}
                  data-testid="input-file-balance"
                />
              )}
            </div>
            {errors.balance_sheet && (
              <span className={styles.errorMessage} role="alert" data-testid="error-balance">
                {errors.balance_sheet}
              </span>
            )}
          </div>

          {/* 4. Formulario 931 (Optional) */}
          <div className={styles.uploadCard} data-testid="upload-card-f931">
            <div className={styles.uploadCardHeader}>
              <div>
                <h4 className={styles.uploadDocTitle}>Formulario 931 (Nómina Salarial AFIP)</h4>
                <p className={styles.uploadDocDesc}>
                  Declaración jurada nominativa de aportes y contribuciones de la seguridad social.
                </p>
              </div>
              <span className={`${styles.uploadBadge} ${styles.uploadBadgeOptional}`}>
                Opcional
              </span>
            </div>

            <div className={styles.fileInputWrapper}>
              {files.f931 ? (
                <div className={styles.fileSelectedBadge} data-testid="badge-f931-file">
                  <span>📄 {files.f931.name} ({formatFileSize(files.f931.size)})</span>
                  <button
                    type="button"
                    className={styles.removeFileBtn}
                    onClick={() => handleRemoveFile('f931')}
                    aria-label="Eliminar formulario 931"
                    data-testid="remove-f931-file"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <input
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={(e) => handleFileSelection('f931', e)}
                  data-testid="input-file-f931"
                />
              )}
            </div>
            {errors.f931 && (
              <span className={styles.errorMessage} role="alert" data-testid="error-f931">
                {errors.f931}
              </span>
            )}
          </div>
        </div>

        <div className={styles.buttonRow}>
          <Button
            type="button"
            variant="bordered"
            size="lg"
            onClick={() => onBack(files)}
            data-testid="step3-back-button"
          >
            ← Volver al paso 2
          </Button>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            data-testid="step3-continue-button"
          >
            Continuar al paso 4 →
          </Button>
        </div>
      </div>
    </form>
  );
}
