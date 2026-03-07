import React, { useState, useRef, useEffect, useCallback } from 'react';
import './VideoPlayer.css';

interface VideoPlayerProps {
  src?: string;
  fileName?: string;
}

const formatTime = (seconds: number): string => {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
};

const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, fileName }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [videoSrc, setVideoSrc] = useState<string | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);

  // Convert data URLs to blob URLs for reliable playback
  useEffect(() => {
    if (!src) return;
    if (src.startsWith('data:')) {
      try {
        const [header, b64] = src.split(',');
        const mime = header.match(/data:(.*?);/)?.[1] || 'video/mp4';
        const binary = atob(b64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        const blob = new Blob([bytes], { type: mime });
        const url = URL.createObjectURL(blob);
        setVideoSrc(url);
        return () => URL.revokeObjectURL(url);
      } catch {
        setVideoSrc(src);
      }
    } else {
      setVideoSrc(src);
    }
  }, [src]);
  const [error, setError] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-hide controls while playing
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (playing) {
      hideTimer.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  useEffect(() => {
    if (!playing) setShowControls(true);
    else resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [playing, resetHideTimer]);

  // Video events
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    if (v.buffered.length > 0) {
      setBuffered(v.buffered.end(v.buffered.length - 1));
    }
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
    setError(false);
  };

  const handleEnded = () => setPlaying(false);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v || !videoSrc) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, [videoSrc]);

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    setCurrentTime(v.currentTime);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) videoRef.current.volume = val;
    if (val > 0) setMuted(false);
  };

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    const next = !muted;
    setMuted(next);
    v.muted = next;
  };

  const changeRate = () => {
    const rates = [0.5, 1, 1.25, 1.5, 2];
    const idx = rates.indexOf(playbackRate);
    const next = rates[(idx + 1) % rates.length];
    setPlaybackRate(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  };

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const skip = (seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration || 0, v.currentTime + seconds));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: KeyboardEvent) => {
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); togglePlay(); break;
        case 'ArrowLeft': e.preventDefault(); skip(-5); break;
        case 'ArrowRight': e.preventDefault(); skip(5); break;
        case 'ArrowUp': e.preventDefault(); setVolume(v => { const n = Math.min(1, v + 0.1); if (videoRef.current) videoRef.current.volume = n; return n; }); break;
        case 'ArrowDown': e.preventDefault(); setVolume(v => { const n = Math.max(0, v - 0.1); if (videoRef.current) videoRef.current.volume = n; return n; }); break;
        case 'm': case 'M': e.preventDefault(); toggleMute(); break;
        case 'f': case 'F': e.preventDefault(); toggleFullscreen(); break;
      }
    };
    el.addEventListener('keydown', handler);
    return () => el.removeEventListener('keydown', handler);
  }, [togglePlay]);

  // Open file
  const handleOpenFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*,audio/*';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      if (videoSrc && videoSrc.startsWith('blob:')) URL.revokeObjectURL(videoSrc);
      const url = URL.createObjectURL(file);
      setVideoSrc(url);
      setError(false);
      setPlaying(false);
      setCurrentTime(0);
    };
    input.click();
  };

  // Cleanup blob URL
  useEffect(() => {
    return () => {
      if (videoSrc && videoSrc.startsWith('blob:')) URL.revokeObjectURL(videoSrc);
    };
  }, [videoSrc]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const displayName = fileName || (videoSrc ? 'Video' : 'Video Player');

  return (
    <div
      className={`video-player ${fullscreen ? 'vp-fullscreen' : ''}`}
      ref={containerRef}
      tabIndex={0}
      onMouseMove={resetHideTimer}
    >
      {videoSrc && !error ? (
        <div className="vp-video-area" onClick={togglePlay} onDoubleClick={toggleFullscreen}>
          <video
            ref={videoRef}
            src={videoSrc}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={handleEnded}
            onError={() => setError(true)}
            className="vp-video"
          />
          {/* Big play button overlay */}
          {!playing && (
            <div className="vp-big-play">
              <div className="vp-big-play-btn">▶</div>
            </div>
          )}
        </div>
      ) : error ? (
        <div className="vp-placeholder">
          <span className="vp-placeholder-icon">⚠️</span>
          <span>Video konnte nicht geladen werden</span>
          <span style={{ fontSize: '12px', color: '#888' }}>
            {fileName?.endsWith('.mov') ? 'Hinweis: .mov (QuickTime) wird nicht von allen Browsern unterstützt. Bitte .mp4 oder .webm verwenden.' : 'Format wird möglicherweise nicht unterstützt.'}
          </span>
          <button className="vp-open-btn" onClick={handleOpenFile}>Andere Datei öffnen</button>
        </div>
      ) : (
        <div className="vp-placeholder">
          <span className="vp-placeholder-icon">🎬</span>
          <span>Kein Video geladen</span>
          <button className="vp-open-btn" onClick={handleOpenFile}>Video öffnen</button>
        </div>
      )}

      {/* Controls bar */}
      <div className={`vp-controls ${showControls || !playing ? 'vp-controls--visible' : ''}`}>
        {/* Progress bar */}
        <div className="vp-progress" ref={progressRef} onClick={handleSeek}>
          <div className="vp-progress-buffered" style={{ width: `${bufferedPct}%` }} />
          <div className="vp-progress-fill" style={{ width: `${progress}%` }} />
          <div className="vp-progress-thumb" style={{ left: `${progress}%` }} />
        </div>

        <div className="vp-controls-row">
          {/* Left */}
          <div className="vp-controls-left">
            <button className="vp-btn" onClick={handleOpenFile} title="Video öffnen">📂</button>
            <button className="vp-btn" onClick={() => skip(-10)} title="10s zurück">⏪</button>
            <button className="vp-btn vp-play-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Abspielen'}>
              {playing ? '⏸' : '▶'}
            </button>
            <button className="vp-btn" onClick={() => skip(10)} title="10s vorspulen">⏩</button>
            <span className="vp-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          {/* Right */}
          <div className="vp-controls-right">
            <button className="vp-btn vp-rate-btn" onClick={changeRate} title="Geschwindigkeit">
              {playbackRate}x
            </button>
            <button className="vp-btn" onClick={toggleMute} title={muted ? 'Ton an' : 'Stumm'}>
              {muted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
            </button>
            <input
              type="range"
              className="vp-volume-slider"
              min="0"
              max="1"
              step="0.05"
              value={muted ? 0 : volume}
              onChange={handleVolumeChange}
              title={`Lautstärke: ${Math.round((muted ? 0 : volume) * 100)}%`}
            />
            <button className="vp-btn" onClick={toggleFullscreen} title="Vollbild">
              {fullscreen ? '⊡' : '⛶'}
            </button>
          </div>
        </div>
      </div>

      {/* Status bar (not in fullscreen) */}
      {!fullscreen && (
        <div className="vp-statusbar">
          <span>{displayName}</span>
          {duration > 0 && <span>{formatTime(duration)}</span>}
          {playbackRate !== 1 && <span>{playbackRate}x</span>}
        </div>
      )}
    </div>
  );
};

export default VideoPlayer;
