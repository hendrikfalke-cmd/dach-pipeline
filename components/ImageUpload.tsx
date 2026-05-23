'use client';

import { useRef, useState } from 'react';

interface ImageUploadProps {
  onImageSelected: (file: File) => void;
  label?: string;
  accept?: string;
}

export default function ImageUpload({ onImageSelected, label = 'Upload Image', accept = 'image/*' }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    onImageSelected(file);
  };

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
        capture="environment"
      />
      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-border">
          <img src={preview} alt="Preview" className="w-full max-h-64 object-contain bg-bg-elevated" />
          <button
            onClick={() => {
              setPreview(null);
              if (inputRef.current) inputRef.current.value = '';
            }}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 flex items-center justify-center"
          >
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          className="w-full py-8 border-2 border-dashed border-border-light rounded-xl flex flex-col items-center gap-2 hover:border-accent/50 transition-colors"
        >
          <svg className="w-8 h-8 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
          </svg>
          <span className="text-sm text-text-muted">{label}</span>
        </button>
      )}
    </div>
  );
}
