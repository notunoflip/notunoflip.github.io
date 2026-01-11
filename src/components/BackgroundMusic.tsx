import { useEffect, useRef, useState } from "react";

interface BackgroundMusicProps {
  playlist: string[]; // Array of MP3 URLs
  breakDuration?: number; // Seconds of silence between tracks (default: 5)
  volume?: number; // 0 to 1 (default: 0.3)
  enabled?: boolean; // Control from settings (default: true)
}

export const BackgroundMusic = ({
  playlist,
  breakDuration = 5,
  volume = 0.3,
  enabled = true,
}: BackgroundMusicProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isOnBreak, setIsOnBreak] = useState(false);
  const breakTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInteractedRef = useRef(false);

  // Initialize audio element
  useEffect(() => {
    const audio = new Audio();
    audio.volume = volume;
    audio.preload = "auto";
    audioRef.current = audio;

    // Attempt to play on first user interaction (browser requirement)
    const handleInteraction = () => {
      if (!hasInteractedRef.current && enabled) {
        hasInteractedRef.current = true;
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Silently fail if autoplay is blocked
          });
        }
      }
    };

    // Listen for any user interaction
    document.addEventListener("click", handleInteraction, { once: true });
    document.addEventListener("keydown", handleInteraction, { once: true });

    return () => {
      audio.pause();
      audio.src = "";
      document.removeEventListener("click", handleInteraction);
      document.removeEventListener("keydown", handleInteraction);
    };
  }, []);

  // Update volume when prop changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle enabled/disabled state
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (enabled && hasInteractedRef.current) {
      // Resume playing if we're not on break
      if (!isOnBreak) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Silently handle playback errors
          });
        }
      }
    } else {
      // Pause when disabled
      audio.pause();
    }
  }, [enabled, isOnBreak]);

  // Handle track ending
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleEnded = () => {
      setIsOnBreak(true);

      // Wait for break duration, then play next track
      breakTimeoutRef.current = setTimeout(() => {
        const nextIndex = (currentTrackIndex + 1) % playlist.length;
        setCurrentTrackIndex(nextIndex);
        setIsOnBreak(false);
      }, breakDuration * 1000);
    };

    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("ended", handleEnded);
      if (breakTimeoutRef.current) {
        clearTimeout(breakTimeoutRef.current);
      }
    };
  }, [currentTrackIndex, playlist.length, breakDuration]);

  // Load and play current track
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !enabled || isOnBreak || !hasInteractedRef.current) return;

    const currentTrack = playlist[currentTrackIndex];
    if (!currentTrack) return;

    audio.src = currentTrack;
    audio.load();

    const playPromise = audio.play();
    if (playPromise !== undefined) {
      playPromise.catch(() => {
        // Silently handle playback errors
      });
    }
  }, [currentTrackIndex, enabled, isOnBreak, playlist]);

  // Component renders nothing - music plays invisibly
  return null;
};