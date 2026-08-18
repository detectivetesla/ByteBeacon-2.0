import React, { useState, useRef } from 'react';
import { FormField } from '../Input/Input.js';
import { UploadCloud, FileSpreadsheet, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface FileValidationSummary {
  fileName: string;
  fileSizeMb: string;
  totalRows?: number;
  validRows?: number;
  invalidRows?: number;
  duplicateRows?: number;
}

export interface FileUploadProps {
  label?: string;
  hint?: string;
  error?: string;
  accept?: string;
  maxSizeBytes?: number;
  onFileSelected?: (file: File) => void;
  onFileRemoved?: () => void;
  summary?: FileValidationSummary | null;
  disabled?: boolean;
  required?: boolean;
  style?: React.CSSProperties;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  label = 'Upload Excel or CSV',
  hint = 'Supported formats: .xlsx, .xls, .csv (Max 10MB)',
  error,
  accept = '.csv, .xlsx, .xls, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel',
  maxSizeBytes = 10 * 1024 * 1024,
  onFileSelected,
  onFileRemoved,
  summary,
  disabled = false,
  required,
  style,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateAndProcess = (file: File) => {
    setLocalError(null);
    if (file.size > maxSizeBytes) {
      setLocalError(`File size exceeds ${(maxSizeBytes / (1024 * 1024)).toFixed(0)}MB limit.`);
      return;
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      setLocalError('Invalid file type. Please upload a .csv, .xlsx, or .xls spreadsheet.');
      return;
    }

    setSelectedFile(file);
    onFileSelected?.(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (disabled) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndProcess(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      validateAndProcess(e.target.files[0]);
    }
  };

  const handleRemove = () => {
    setSelectedFile(null);
    setLocalError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    onFileRemoved?.();
  };

  const activeError = error || localError;

  return (
    <FormField label={label} error={activeError || undefined} hint={!selectedFile ? hint : undefined} required={required} style={style}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {!selectedFile ? (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
          style={{
            width: '100%',
            padding: 'var(--space-6) var(--space-4)',
            borderRadius: 'var(--radius-xl)',
            backgroundColor: isDragOver
              ? 'rgba(0, 102, 255, 0.08)'
              : 'var(--color-bg-surface-elevated)',
            border: isDragOver
              ? '2px dashed var(--color-primary)'
              : activeError
              ? '2px dashed var(--color-danger)'
              : '2px dashed var(--color-border-strong)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 150ms ease',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: 'rgba(0, 102, 255, 0.12)',
              color: 'var(--color-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <UploadCloud size={20} />
          </div>

          <div>
            <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
              Drop your spreadsheet here, or <span style={{ color: 'var(--color-primary)' }}>browse files</span>
            </strong>
            <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
              Supports .xlsx, .xls, and .csv formats
            </span>
          </div>
        </div>
      ) : (
        <div
          style={{
            padding: 'var(--space-4)',
            borderRadius: 'var(--radius-lg)',
            backgroundColor: 'var(--color-bg-surface)',
            border: '1px solid var(--color-border-default)',
            boxShadow: 'var(--shadow-tactile-sm)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '34px',
                  height: '34px',
                  borderRadius: 'var(--radius-sm)',
                  backgroundColor: 'rgba(16, 185, 129, 0.12)',
                  color: 'var(--color-success)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FileSpreadsheet size={18} />
              </div>
              <div>
                <strong style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-primary)', display: 'block' }}>
                  {selectedFile.name}
                </strong>
                <span style={{ fontSize: 'var(--font-size-3xs)', color: 'var(--color-text-muted)' }}>
                  {(selectedFile.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleRemove}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 8px',
                borderRadius: 'var(--radius-xs)',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                color: 'var(--color-danger)',
                fontSize: 'var(--font-size-3xs)',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Trash2 size={12} />
              <span>Remove</span>
            </button>
          </div>

          {summary && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))',
                gap: '6px',
                padding: '8px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--color-bg-surface-elevated)',
                border: '1px solid var(--color-border-default)',
              }}
            >
              {summary.totalRows !== undefined && (
                <div>
                  <span style={{ fontSize: '9px', color: 'var(--color-text-muted)', textTransform: 'uppercase' }}>Total Rows</span>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-text-primary)' }}>
                    {summary.totalRows}
                  </div>
                </div>
              )}
              {summary.validRows !== undefined && (
                <div>
                  <span style={{ fontSize: '9px', color: 'var(--color-success)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <CheckCircle2 size={9} /> Valid
                  </span>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-success)' }}>
                    {summary.validRows}
                  </div>
                </div>
              )}
              {summary.invalidRows !== undefined && (
                <div>
                  <span style={{ fontSize: '9px', color: 'var(--color-danger)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '2px' }}>
                    <AlertTriangle size={9} /> Invalid
                  </span>
                  <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 800, color: 'var(--color-danger)' }}>
                    {summary.invalidRows}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </FormField>
  );
};
