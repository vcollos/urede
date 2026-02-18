import { useMemo, useState } from 'react';

interface PreviewImageProps {
  url: string;
  alt: string;
  size: number;
  rounded: boolean;
  label: string;
}

export function PreviewImage({ url, alt, size, rounded, label }: PreviewImageProps) {
  const [failed, setFailed] = useState(false);

  const style = useMemo(() => ({
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: rounded ? '50%' : '8px',
  }), [rounded, size]);

  if (!url || failed) {
    return (
      <div className="preview-image-fallback" style={style} aria-label={`${label} placeholder`}>
        {label}
      </div>
    );
  }

  return (
    <img
      src={url}
      alt={alt}
      style={style}
      className="preview-image"
      onError={() => setFailed(true)}
    />
  );
}
