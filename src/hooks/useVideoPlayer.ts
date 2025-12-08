import { useState, useEffect, useCallback, useRef } from "react";
import type { Video } from "@/types/music";

interface UseVideoPlayerReturn {
  currentVideo: Video | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isFullscreen: boolean;
  isLoading: boolean;
  playbackRate: number;
  playVideo: (video: Video) => void;
  pauseVideo: () => void;
  resumeVideo: () => void;
  togglePlayPause: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  toggleFullscreen: () => void;
  setPlaybackRate: (rate: number) => void;
  nextVideo: () => void;
  previousVideo: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
}

export function useVideoPlayer(videos: Video[] = []): UseVideoPlayerReturn {
  const [currentVideo, setCurrentVideo] = useState<Video | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const isElectron = !!window.electronAPI;

  // Get video source URL
  const getVideoSource = (video: Video): string => {
    if (!video.filePath) {
      return "";
    }
    
    // Check if it's already a URL (web video)
    if (video.filePath.startsWith('http://') || video.filePath.startsWith('https://') || video.filePath.startsWith('blob:')) {
      return video.filePath;
    }
    
    // Check if already using local-video protocol
    if (video.filePath.startsWith('local-video://')) {
      return video.filePath;
    }
    
    if (!isElectron) {
      return "";
    }
    
    // Local file path - convert to local-video:// URL for Electron
    // Normalize path (replace backslashes with forward slashes)
    const normalizedPath = video.filePath.replace(/\\/g, '/');
    const encodedPath = encodeURIComponent(normalizedPath);
    
    return `local-video://${encodedPath}`;
  };

  // Define playVideo before using it in useEffect
  const playVideo = useCallback((video: Video) => {
    setCurrentVideo(video);
    setIsPlaying(true);
    setIsLoading(true);
    // The useEffect will handle loading and playing the video
  }, []);

  // Update current time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleLoadedMetadata = async () => {
      setDuration(video.duration);
      setIsLoading(false);
      
      // Update video metadata in storage if available
      if (currentVideo && isElectron && window.electronAPI) {
        const width = video.videoWidth;
        const height = video.videoHeight;
        const duration = video.duration;
        
        // Only update if we have new metadata
        if (width > 0 && height > 0 && duration > 0) {
          try {
            await window.electronAPI.updateVideoMetadata?.(currentVideo.id, {
              width,
              height,
              duration: Math.round(duration),
            });
          } catch (error) {
            console.error('Failed to update video metadata:', error);
          }
        }
      }
    };

    const handleLoadedData = () => {
      setIsLoading(false);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
    };

    const handlePlay = () => {
      setIsPlaying(true);
    };

    const handlePause = () => {
      setIsPlaying(false);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      // Auto-play next video if available
      if (currentVideo && videos.length > 0) {
        const currentIndex = videos.findIndex(v => v.id === currentVideo.id);
        if (currentIndex >= 0 && currentIndex < videos.length - 1) {
          playVideo(videos[currentIndex + 1]);
        }
      }
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("loadedmetadata", handleLoadedMetadata);
    video.addEventListener("loadeddata", handleLoadedData);
    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("ended", handleEnded);
    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("loadedmetadata", handleLoadedMetadata);
      video.removeEventListener("loadeddata", handleLoadedData);
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("ended", handleEnded);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [currentVideo, videos, playVideo]);

  // Update video source when currentVideo changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !currentVideo) return;

    setIsLoading(true);
    setCurrentTime(0);
    setDuration(0);
    const source = getVideoSource(currentVideo);
    
    if (!source) {
      console.warn('No video source available for:', currentVideo);
      setIsLoading(false);
      return;
    }
    
    console.log('Loading video source:', source);
    video.src = source;
    video.load();
    
    // Auto-play after video is ready to play
    const handleCanPlay = () => {
      console.log('Video can play, isPlaying:', isPlaying);
      if (isPlaying) {
        video.play().catch((err) => {
          // Ignore AbortError - it's normal when video is paused/removed
          if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
            console.error('Error playing video:', err);
          } else {
            console.log('Play interrupted (normal):', err.name);
          }
        });
      }
    };
    
    const handleLoadedMetadata = () => {
      console.log('Video metadata loaded');
      setIsLoading(false);
    };
    
    const handleError = (e: Event) => {
      console.error('Video error:', e);
      setIsLoading(false);
      const videoEl = e.target as HTMLVideoElement;
      if (videoEl.error) {
        console.error('Video error details:', {
          code: videoEl.error.code,
          message: videoEl.error.message,
        });
      }
    };
    
    // Try to play when video can play
    if (video.readyState >= 3) {
      // Video already has enough data
      handleCanPlay();
    } else {
      video.addEventListener('canplay', handleCanPlay, { once: true });
    }
    
    video.addEventListener('loadedmetadata', handleLoadedMetadata, { once: true });
    video.addEventListener('error', handleError);
    
    return () => {
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('error', handleError);
    };
  }, [currentVideo, isElectron, isPlaying]);

  // Update volume
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.volume = volume / 100;
  }, [volume]);

  // Update muted state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = isMuted;
  }, [isMuted]);

  // Update playback rate
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate]);

  const pauseVideo = useCallback(() => {
    videoRef.current?.pause();
  }, []);

  const resumeVideo = useCallback(() => {
    videoRef.current?.play().catch((err) => {
      // Ignore AbortError - it's normal when video is paused/removed
      if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
        console.error('Error playing video:', err);
      }
    });
  }, []);

  const togglePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch((err) => {
        // Ignore AbortError - it's normal when video is paused/removed
        if (err.name !== 'AbortError' && err.name !== 'NotAllowedError') {
          console.error('Error playing video:', err);
        }
      });
    }
  }, [isPlaying]);

  const seek = useCallback((time: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  const setVolume = useCallback((vol: number) => {
    setVolumeState(Math.max(0, Math.min(100, vol)));
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!document.fullscreenElement) {
      video.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  }, []);

  const setPlaybackRate = useCallback((rate: number) => {
    setPlaybackRateState(Math.max(0.25, Math.min(2, rate)));
  }, []);

  const nextVideo = useCallback(() => {
    if (!currentVideo || videos.length === 0) return;
    const currentIndex = videos.findIndex(v => v.id === currentVideo.id);
    if (currentIndex >= 0 && currentIndex < videos.length - 1) {
      playVideo(videos[currentIndex + 1]);
    }
  }, [currentVideo, videos, playVideo]);

  const previousVideo = useCallback(() => {
    if (!currentVideo || videos.length === 0) return;
    const currentIndex = videos.findIndex(v => v.id === currentVideo.id);
    if (currentIndex > 0) {
      playVideo(videos[currentIndex - 1]);
    } else if (currentTime > 3) {
      seek(0);
    }
  }, [currentVideo, videos, currentTime, playVideo, seek]);

  return {
    currentVideo,
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isFullscreen,
    isLoading,
    playbackRate,
    playVideo,
    pauseVideo,
    resumeVideo,
    togglePlayPause,
    seek,
    setVolume,
    toggleMute,
    toggleFullscreen,
    setPlaybackRate,
    nextVideo,
    previousVideo,
    videoRef,
  };
}

