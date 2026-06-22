'use client';

import { useState } from 'react';
import Image from 'next/image';

// Full-bleed photo for the consultation pages. Falls back to a calm placeholder
// block until the real image is dropped into /public/images/.
export default function ConsultationPhoto({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <div aria-hidden className="absolute inset-0 bg-[#d9cdb8]" />;
  }
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="(max-width: 768px) 100vw, 45vw"
      className="object-cover"
      onError={() => setFailed(true)}
    />
  );
}
