import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, RotateCcw } from 'lucide-react';

interface AudioPlayerProps {
  src: string;
  filename?: string;
}

export const AudioPlayer: React.FC<AudioPlayerProps> = ({ src, filename }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  const audioRef = useRef<HTMLAudioElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      setDuration(audio.duration || 0);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime || 0);
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => setIsPlaying(true)).catch(console.error);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percentage * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    if (isMuted) {
      audioRef.current.muted = false;
      setIsMuted(false);
    } else {
      audioRef.current.muted = true;
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      if (val === 0) {
        setIsMuted(true);
        audioRef.current.muted = true;
      } else if (isMuted) {
        setIsMuted(false);
        audioRef.current.muted = false;
      }
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Visual pseudo-waveform bars
  const totalBars = 32;
  const bars = Array.from({ length: totalBars }).map((_, i) => {
    // Generate deterministic pleasing heights
    const seed = (i * 17) % 23;
    const height = Math.max(20, (Math.sin(i * 0.4) * 0.5 + 0.5) * 80 + seed);
    return Math.min(95, height);
  });

  return (
    <div className="w-full max-w-md my-1.5 p-3 rounded-xl bg-[#141519] border border-[#26282E] shadow-lg flex flex-col gap-2 select-none">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Top row: filename & playback rate */}
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="truncate font-medium max-w-[220px]">
          {filename || 'Mensagem de áudio'}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cyclePlaybackRate}
            className="px-1.5 py-0.5 rounded bg-[#1C1E24] hover:bg-[#26282E] text-slate-300 font-mono text-[10px] border border-[#2E313A] transition"
            title="Velocidade de reprodução"
          >
            {playbackRate}x
          </button>
        </div>
      </div>

      {/* Main player controls & waveform */}
      <div className="flex items-center gap-3">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={togglePlay}
          className="w-10 h-10 rounded-xl bg-[#F27D26] hover:bg-[#FF9345] active:scale-95 text-white flex items-center justify-center shrink-0 transition shadow-md shadow-[#F27D26]/20 cursor-pointer"
          title={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
        >
          {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-0.5" />}
        </button>

        {/* Waveform / Progress bar */}
        <div className="flex-1 flex flex-col gap-1.5">
          <div
            ref={progressBarRef}
            onClick={handleSeek}
            className="h-8 flex items-center gap-[2px] cursor-pointer group py-1 relative"
            title="Clique para avançar/retroceder"
          >
            {bars.map((barHeight, idx) => {
              const barPercent = (idx / totalBars) * 100;
              const isPassed = barPercent <= progressPercent;
              return (
                <div
                  key={idx}
                  style={{ height: `${barHeight}%` }}
                  className={`flex-1 rounded-full transition-colors ${
                    isPassed
                      ? 'bg-[#F27D26]'
                      : 'bg-[#2A2D36] group-hover:bg-[#343842]'
                  }`}
                />
              );
            })}
          </div>

          {/* Time & Volume row */}
          <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
            <span>{formatTime(currentTime)} / {formatTime(duration)}</span>

            <div className="relative flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleMute}
                onMouseEnter={() => setShowVolumeSlider(true)}
                className="text-slate-400 hover:text-slate-200 transition p-1"
                title={isMuted ? 'Desmutar' : 'Mutar'}
              >
                {isMuted || volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>

              {showVolumeSlider && (
                <div
                  onMouseLeave={() => setShowVolumeSlider(false)}
                  className="absolute bottom-6 right-0 p-2 bg-[#1C1E24] border border-[#2E313A] rounded-lg shadow-xl flex items-center z-30"
                >
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={handleVolumeChange}
                    className="w-16 h-1 bg-[#2E313A] rounded-lg appearance-none cursor-pointer accent-[#F27D26]"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
