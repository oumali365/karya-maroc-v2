import React, { useEffect, useState } from 'react';
import { CarFront } from 'lucide-react';
import { getModelFallbackImage, resolveCatalogImage } from '../data/starterData';

interface CarImageProps {
  src?: string | null;
  brand?: string;
  model?: string;
  alt: string;
  className?: string;
}

export const CarImage: React.FC<CarImageProps> = ({
  src,
  brand = '',
  model = '',
  alt,
  className = '',
}) => {
  const initialSrc = resolveCatalogImage(brand, model, src);
  const modelFallback = getModelFallbackImage(brand, model);

  const [currentSrc, setCurrentSrc] = useState<string>(initialSrc);
  const [loaded, setLoaded] = useState(false);
  const [failedCompletely, setFailedCompletely] = useState(false);

  useEffect(() => {
    setCurrentSrc(resolveCatalogImage(brand, model, src));
    setLoaded(false);
    setFailedCompletely(false);
  }, [src, brand, model]);

  const handleError = () => {
    if (currentSrc !== modelFallback) {
      setLoaded(false);
      setCurrentSrc(modelFallback);
    } else {
      setFailedCompletely(true);
    }
  };

  if (failedCompletely || !currentSrc) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-[#EEF3F7] to-[#E2E8F0] text-[var(--karya-primary)]/75 px-3 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <CarFront className="w-8 h-8 text-[var(--karya-action)]/80" aria-hidden="true" />
        <span className="text-[11px] font-bold truncate max-w-full">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      referrerPolicy="no-referrer"
      decoding="async"
      onLoad={() => setLoaded(true)}
      onError={handleError}
      className={`${className} transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-90'}`}
    />
  );
};
