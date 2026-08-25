"use client";

import { useEffect, useState } from "react";
import { GRAIN_ALPHA, getGrainTileUrl } from "@/lib/editor/presets";

/**
 * The film-grain preview layer — one component so every preview surface
 * stays locked to GRAIN_ALPHA (the same value the export pass uses; a
 * drifted literal here would make saved files stop matching previews).
 * The tile is canvas-generated, so the URL resolves post-mount.
 */
export default function GrainOverlay() {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    setUrl(getGrainTileUrl());
  }, []);

  if (!url) return null;
  return (
    <div
      aria-hidden
      className="absolute inset-0 pointer-events-none"
      style={{
        backgroundImage: `url(${url})`,
        backgroundRepeat: "repeat",
        mixBlendMode: "overlay",
        opacity: GRAIN_ALPHA,
      }}
    />
  );
}
