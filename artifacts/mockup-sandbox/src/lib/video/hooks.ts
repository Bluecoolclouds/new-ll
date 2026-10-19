import { useState, useEffect } from 'react';

export function useVideoPlayer({ durations }: { durations: Record<string, number> }) {
  const [currentScene, setCurrentScene] = useState(0);
  
  useEffect(() => {
    const durationValues = Object.values(durations);
    if (durationValues.length === 0) return;

    if (typeof window !== 'undefined' && (window as any).startRecording) {
      (window as any).startRecording();
    }

    let timeout: ReturnType<typeof setTimeout>;
    let current = 0;
    
    const playScene = () => {
      timeout = setTimeout(() => {
        current = (current + 1) % durationValues.length;
        setCurrentScene(current);
        
        if (current === 0 && typeof window !== 'undefined' && (window as any).stopRecording) {
          (window as any).stopRecording();
        }
        
        playScene();
      }, durationValues[current]);
    };
    
    playScene();
    return () => clearTimeout(timeout);
  }, [JSON.stringify(durations)]);

  return { currentScene };
}
