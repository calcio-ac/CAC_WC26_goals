import { useCallback, useEffect, useRef, useState } from "react";

// Minimal typing for the bits of the YT IFrame API we use.
interface YTPlayer {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getDuration(): number;
  getPlayerState(): number;
  setPlaybackRate(rate: number): void;
  loadVideoById(id: string): void;
  destroy(): void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (el: HTMLElement | string, opts: unknown) => YTPlayer;
      PlayerState: { PLAYING: number; PAUSED: number; ENDED: number };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    window.onYouTubeIframeAPIReady = () => resolve();
    document.head.appendChild(tag);
  });
  return apiPromise;
}

const STEP = 1 / 25; // ~one frame at 25fps for frame-by-frame nudging

export function useYouTube(containerId: string, videoId: string | null) {
  const playerRef = useRef<YTPlayer | null>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Build / rebuild the player when the video id changes.
  useEffect(() => {
    if (!videoId) return;
    let disposed = false;
    loadApi().then(() => {
      if (disposed || !window.YT) return;
      if (playerRef.current) {
        playerRef.current.loadVideoById(videoId);
        return;
      }
      playerRef.current = new window.YT.Player(containerId, {
        videoId,
        playerVars: { modestbranding: 1, rel: 0, controls: 1 },
        events: {
          onReady: () => {
            if (disposed) return;
            setReady(true);
            setDuration(playerRef.current?.getDuration() ?? 0);
          },
          onStateChange: (e: { data: number }) => {
            const PS = window.YT?.PlayerState;
            if (PS) setPlaying(e.data === PS.PLAYING);
          },
        },
      });
    });
    return () => {
      disposed = true;
    };
  }, [containerId, videoId]);

  // Poll current time while mounted.
  useEffect(() => {
    const t = setInterval(() => {
      const p = playerRef.current;
      if (p && ready) {
        setTime(p.getCurrentTime());
        const d = p.getDuration();
        if (d && d !== duration) setDuration(d);
      }
    }, 100);
    return () => clearInterval(t);
  }, [ready, duration]);

  const play = useCallback(() => playerRef.current?.playVideo(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo(), []);
  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    playing ? p.pauseVideo() : p.playVideo();
  }, [playing]);
  const seekTo = useCallback((s: number) => {
    playerRef.current?.seekTo(Math.max(0, s), true);
  }, []);
  const nudge = useCallback((deltaSeconds: number) => {
    const p = playerRef.current;
    if (!p) return;
    p.pauseVideo();
    p.seekTo(Math.max(0, p.getCurrentTime() + deltaSeconds), true);
  }, []);
  const frameStep = useCallback((dir: 1 | -1) => nudge(dir * STEP), [nudge]);
  const setRate = useCallback((r: number) => playerRef.current?.setPlaybackRate(r), []);

  return {
    ready,
    playing,
    time,
    duration,
    play,
    pause,
    togglePlay,
    seekTo,
    nudge,
    frameStep,
    setRate,
    getTime: () => playerRef.current?.getCurrentTime() ?? time,
  };
}
