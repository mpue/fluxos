import React, { useState, useEffect, useRef, useCallback } from 'react';
import './PieMenu.css';

export interface PieMenuItem {
  id: string;
  icon: string;
  label: string;
  onClick: () => void;
}

interface Props {
  x: number;
  y: number;
  items: PieMenuItem[];
  onClose: () => void;
  accentColor?: string;
}

const PIE_RADIUS = 120;
const ITEM_SIZE = 52;
const CENTER_SIZE = 48;

const PieMenu: React.FC<Props> = ({ x, y, items, onClose, accentColor = '#0078d4' }) => {
  const [open, setOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Trigger entrance animation
    requestAnimationFrame(() => setOpen(true));
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setTimeout(onClose, 200);
  }, [onClose]);

  // Close on outside click or Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handleClick);
    };
  }, [handleClose]);

  // Clamp position so the pie stays on screen
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = PIE_RADIUS + ITEM_SIZE / 2 + 8;
  const cx = Math.max(margin, Math.min(vw - margin, x));
  const cy = Math.max(margin, Math.min(vh - margin, y));

  const angleStep = (2 * Math.PI) / items.length;
  const startAngle = -Math.PI / 2; // top

  return (
    <div className="pie-menu-overlay" ref={containerRef}>
      <div
        className={`pie-menu ${open ? 'pie-menu--open' : ''}`}
        style={{ left: cx, top: cy }}
      >
        {/* Segments / background ring */}
        <svg
          className="pie-menu-ring"
          width={PIE_RADIUS * 2 + ITEM_SIZE}
          height={PIE_RADIUS * 2 + ITEM_SIZE}
          style={{
            position: 'absolute',
            left: -(PIE_RADIUS + ITEM_SIZE / 2),
            top: -(PIE_RADIUS + ITEM_SIZE / 2),
            pointerEvents: 'none',
          }}
        >
          {items.map((item, i) => {
            const a1 = startAngle + i * angleStep;
            const a2 = a1 + angleStep;
            const innerR = CENTER_SIZE / 2 + 10;
            const outerR = PIE_RADIUS + ITEM_SIZE / 2 - 2;
            const cX = PIE_RADIUS + ITEM_SIZE / 2;
            const cY = PIE_RADIUS + ITEM_SIZE / 2;
            const largeArc = angleStep > Math.PI ? 1 : 0;

            const x1o = cX + outerR * Math.cos(a1);
            const y1o = cY + outerR * Math.sin(a1);
            const x2o = cX + outerR * Math.cos(a2);
            const y2o = cY + outerR * Math.sin(a2);
            const x1i = cX + innerR * Math.cos(a2);
            const y1i = cY + innerR * Math.sin(a2);
            const x2i = cX + innerR * Math.cos(a1);
            const y2i = cY + innerR * Math.sin(a1);

            const d = [
              `M ${x1o} ${y1o}`,
              `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o}`,
              `L ${x1i} ${y1i}`,
              `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i}`,
              'Z',
            ].join(' ');

            return (
              <path
                key={item.id}
                d={d}
                className={`pie-segment ${hoveredId === item.id ? 'pie-segment--hover' : ''}`}
                style={{
                  fill: hoveredId === item.id ? `${accentColor}25` : 'rgba(255,255,255,0.06)',
                  stroke: hoveredId === item.id ? accentColor : 'rgba(255,255,255,0.12)',
                  strokeWidth: 1,
                  pointerEvents: 'all',
                  cursor: 'pointer',
                  transition: 'fill 0.15s, stroke 0.15s',
                }}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={(e) => { e.stopPropagation(); item.onClick(); handleClose(); }}
              />
            );
          })}
        </svg>

        {/* Items */}
        {items.map((item, i) => {
          const angle = startAngle + i * angleStep;
          const ix = Math.cos(angle) * PIE_RADIUS;
          const iy = Math.sin(angle) * PIE_RADIUS;
          const isHovered = hoveredId === item.id;

          return (
            <div
              key={item.id}
              className={`pie-menu-item ${isHovered ? 'pie-menu-item--hover' : ''}`}
              style={{
                transform: open
                  ? `translate(${ix}px, ${iy}px) scale(1)`
                  : `translate(0px, 0px) scale(0.3)`,
                '--accent': accentColor,
                borderColor: isHovered ? accentColor : 'rgba(255,255,255,0.2)',
                boxShadow: isHovered
                  ? `0 0 18px ${accentColor}50, 0 4px 15px rgba(0,0,0,0.3)`
                  : '0 4px 12px rgba(0,0,0,0.25)',
              } as React.CSSProperties}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
              onClick={(e) => { e.stopPropagation(); item.onClick(); handleClose(); }}
            >
              <span className="pie-menu-item-icon">{item.icon}</span>
            </div>
          );
        })}

        {/* Center dot */}
        <div
          className={`pie-menu-center ${open ? 'pie-menu-center--open' : ''}`}
          style={{ borderColor: `${accentColor}60` }}
          onClick={(e) => { e.stopPropagation(); handleClose(); }}
        >
          <span className="pie-menu-center-icon">✕</span>
        </div>

        {/* Tooltip label */}
        {hoveredId && (
          <div className="pie-menu-tooltip">
            {items.find(i => i.id === hoveredId)?.label}
          </div>
        )}
      </div>
    </div>
  );
};

export default PieMenu;
