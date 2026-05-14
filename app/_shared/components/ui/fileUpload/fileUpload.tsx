'use client';

import React, { useCallback, useRef, useState } from 'react';
import styles from './fileUpload.module.scss';

interface FileWithPreview extends File {
  preview?: string;
  id: string;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const generateId = () => Math.random().toString(36).substring(2, 9);

interface FileUploadProps {
  onFilesChange?: (files: File[]) => void;
  onFileRemove?: (file: FileWithPreview) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  maxSize?: number; // in bytes
  disabled?: boolean;
  label?: string;
  helperText?: string;
  error?: string;
  className?: string;
}

export const FileUpload = ({
  onFilesChange,
  onFileRemove,
  accept,
  multiple = false,
  maxFiles = 10,
  maxSize = 5 * 1024 * 1024, // 5MB default
  disabled = false,
  label = 'Upload files',
  helperText,
  error,
  className = '',
}: FileUploadProps) => {
  const [files, setFiles] = useState<FileWithPreview[]>([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const createFileWithPreview = useCallback((file: File): FileWithPreview => {
    const fileWithPreview = Object.assign(file, {
      id: generateId(),
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
    });
    return fileWithPreview;
  }, []);

  const validateFiles = useCallback(
    (newFiles: File[]): { valid: FileWithPreview[]; error: string | null } => {
      if (!multiple && files.length + newFiles.length > 1) {
        return { valid: [], error: 'Only one file is allowed' };
      }

      if (multiple && files.length + newFiles.length > maxFiles) {
        return { valid: [], error: `Maximum ${maxFiles} files allowed` };
      }

      const oversizedFiles = newFiles.filter((file) => file.size > maxSize);
      if (oversizedFiles.length > 0) {
        return {
          valid: [],
          error: `File size must be less than ${formatFileSize(maxSize)}`,
        };
      }

      return { valid: newFiles.map(createFileWithPreview), error: null };
    },
    [files, multiple, maxFiles, maxSize, createFileWithPreview]
  );

  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles || disabled) return;

      const fileArray = Array.from(newFiles);
      const { valid, error: validationError } = validateFiles(fileArray);

      if (validationError) {
        setUploadError(validationError);
        return;
      }

      setUploadError(null);
      const updatedFiles = multiple ? [...files, ...valid] : valid;
      setFiles(updatedFiles);
      onFilesChange?.(updatedFiles);
    },
    [files, multiple, validateFiles, disabled, onFilesChange]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClick = () => {
    if (!disabled) {
      inputRef.current?.click();
    }
  };

  const removeFile = (fileToRemove: FileWithPreview) => {
    const updatedFiles = files.filter((f) => f.id !== fileToRemove.id);
    setFiles(updatedFiles);
    onFilesChange?.(updatedFiles);
    onFileRemove?.(fileToRemove);

    if (fileToRemove.preview) {
      URL.revokeObjectURL(fileToRemove.preview);
    }
  };

  const displayError = error || uploadError;

  return (
    <div className={`${styles['file-upload']} ${className}`}>
      {label && <span className={styles['file-upload-label']}>{label}</span>}

      <div
        className={[
          styles['file-upload-dropzone'],
          isDragOver && styles['file-upload-dropzone--dragover'],
          displayError && styles['file-upload-dropzone--error'],
          disabled && styles['file-upload-dropzone--disabled'],
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          disabled={disabled}
          className={styles['file-upload-input']}
          onChange={(e) => handleFiles(e.target.files)}
        />

        <div className={styles['file-upload-content']}>
          <svg
            className={styles['file-upload-icon']}
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M21 15V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V15M17 8L12 3M12 3L7 8M12 3V15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <p className={styles['file-upload-text']}>
            <span className={styles['file-upload-text-bold']}>Click to upload</span> or drag and drop
          </p>
          <p className={styles['file-upload-hint']}>
            {accept ? accept.replace(/\./g, '').toUpperCase() : 'Any file'} up to {formatFileSize(maxSize)}
            {!multiple && ' (single file)'}
          </p>
        </div>
      </div>

      {(helperText || displayError) && (
        <span className={displayError ? styles['file-upload-error'] : styles['file-upload-helper']}>
          {displayError || helperText}
        </span>
      )}

      {files.length > 0 && (
        <ul className={styles['file-upload-list']}>
          {files.map((file) => (
            <li key={file.id} className={styles['file-upload-item']}>
              {file.preview ? (
                <img src={file.preview} alt={file.name} className={styles['file-upload-thumb']} />
              ) : (
                <div className={styles['file-upload-thumb-placeholder']}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M13 2H6C5.46957 2 4.96086 2.21071 4.58579 2.58579C4.21071 2.96086 4 3.46957 4 4V20C4 20.5304 4.21071 21.0391 4.58579 21.4142C4.96086 21.7893 5.46957 22 6 22H18C18.5304 22 19.0391 21.7893 19.4142 21.4142C19.7893 21.0391 20 20.5304 20 20V9L13 2Z"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path d="M13 2V9H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
              )}
              <div className={styles['file-upload-info']}>
                <span className={styles['file-upload-name']}>{file.name}</span>
                <span className={styles['file-upload-size']}>{formatFileSize(file.size)}</span>
              </div>
              <button
                type="button"
                className={styles['file-upload-remove']}
                onClick={() => removeFile(file)}
                disabled={disabled}
                aria-label={`Remove ${file.name}`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M6 6L18 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
