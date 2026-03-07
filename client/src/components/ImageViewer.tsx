import React, { useState, useRef, useEffect, useCallback } from 'react';
import './ImageViewer.css';

interface ImageViewerProps {
  src?: string;       // data URL or image URL
  fileName?: string;
}

const ImageViewer: React.FC<ImageViewerProps> = ({ src, fileName }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [fitMode, setFitMode] = useState<'fit' | 'free'>('fit');
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 });
  const [imageSrc, setImageSrc] = useState<string | undefined>(src);
  const [error, setError] = useState(false);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImageSize({ w: img.naturalWidth, h: img.naturalHeight });
    setError(false);
  };

  const resetView = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
    setFitMode('fit');
  }, []);

  const zoomIn = () => {
    setZoom(z => Math.min(z * 1.25, 10));
    setFitMode('free');
  };

  const zoomOut = () => {
    setZoom(z => Math.max(z / 1.25, 0.1));
    setFitMode('free');
  };

  const zoomToFit = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setFitMode('fit');
  };

  const zoomTo100 = () => {
    setFitMode('free');
    if (!containerRef.current || imageSize.w === 0) return;
    const cw = containerRef.current.clientWidth;
    const ch = containerRef.current.clientHeight;
    // Calculate what zoom "fit" would give, then set to show 1:1
    const fitZoom = Math.min(cw / imageSize.w, ch / imageSize.h, 1);
    setZoom(1 / fitZoom);
    setOffset({ x: 0, y: 0 });
  };

  const rotateLeft = () => setRotation(r => (r - 90) % 360);
  const rotateRight = () => setRotation(r => (r + 90) % 360);

  // Mouse wheel zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      setZoom(z => Math.min(Math.max(z * delta, 0.1), 10));
      setFitMode('free');
    };
    el.addEventListener('wheel', handler, { passive: false });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  // Pan via drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
    setFitMode('free');
  };

  const handleMouseUp = () => setDragging(false);

  // Open file via dialog
  const handleOpenFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        setImageSrc(ev.target?.result as string);
        setError(false);
        resetView();
      };
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const displayName = fileName || 'Bildbetrachter';
  const zoomPercent = fitMode === 'fit' ? 'Einpassen' : `${Math.round(zoom * 100)}%`;

  return (
    <div className="image-viewer">
      {/* Toolbar */}
      <div className="iv-toolbar">
        <button className="iv-btn" onClick={handleOpenFile} title="Bild öffnen">📂 Öffnen</button>
        <div className="iv-separator" />
        <button className="iv-btn" onClick={zoomIn} title="Vergrößern">🔍+</button>
        <button className="iv-btn" onClick={zoomOut} title="Verkleinern">🔍−</button>
        <button className="iv-btn" onClick={zoomToFit} title="Einpassen">⊞ Einpassen</button>
        <button className="iv-btn" onClick={zoomTo100} title="100%">1:1</button>
        <div className="iv-separator" />
        <button className="iv-btn" onClick={rotateLeft} title="Links drehen">↺</button>
        <button className="iv-btn" onClick={rotateRight} title="Rechts drehen">↻</button>
        <div className="iv-separator" />
        <button className="iv-btn" onClick={resetView} title="Ansicht zurücksetzen">⟳</button>
      </div>

      {/* Image area */}
      <div
        className="iv-canvas"
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {imageSrc && !error ? (
          <img
            src={imageSrc}
            alt={displayName}
            className="iv-image"
            draggable={false}
            onLoad={handleImageLoad}
            onError={() => setError(true)}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${fitMode === 'fit' ? 1 : zoom}) rotate(${rotation}deg)`,
              maxWidth: fitMode === 'fit' ? '100%' : 'none',
              maxHeight: fitMode === 'fit' ? '100%' : 'none',
              cursor: dragging ? 'grabbing' : 'grab',
            }}
          />
        ) : error ? (
          <div className="iv-placeholder">
            <span className="iv-placeholder-icon">⚠️</span>
            <span>Bild konnte nicht geladen werden</span>
          </div>
        ) : (
          <div className="iv-placeholder">
            <span className="iv-placeholder-icon">🖼️</span>
            <span>Kein Bild geladen</span>
            <button className="iv-btn iv-open-btn" onClick={handleOpenFile}>Bild öffnen</button>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="iv-statusbar">
        <span className="iv-status-item">{displayName}</span>
        {imageSize.w > 0 && (
          <span className="iv-status-item">{imageSize.w} × {imageSize.h} px</span>
        )}
        <span className="iv-status-item">{zoomPercent}</span>
        {rotation !== 0 && <span className="iv-status-item">Rotation: {rotation}°</span>}
      </div>
    </div>
  );
};

export default ImageViewer;
