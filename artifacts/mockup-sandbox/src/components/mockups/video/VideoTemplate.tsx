import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVideoPlayer } from '@/lib/video/hooks';
import { Scene1 } from './scenes/Scene1';
import { Scene2 } from './scenes/Scene2';
import { Scene3 } from './scenes/Scene3';
import { Scene4 } from './scenes/Scene4';
import { Scene5 } from './scenes/Scene5';

const SCENE_DURATIONS = { open: 4000, providers: 4500, features: 4500, value: 4000, close: 4000 };

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({ durations: SCENE_DURATIONS });

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#050505] font-sans text-white">
      {/* Background layer */}
      <div className="absolute inset-0">
        <motion.div 
          className="absolute w-[800px] h-[800px] rounded-full opacity-[0.15] blur-3xl"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }}
          animate={{ x: ['-20%', '80%', '10%'], y: ['-10%', '60%', '20%'], scale: [1, 1.2, 0.9] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }} 
        />
        <motion.div 
          className="absolute w-[600px] h-[600px] rounded-full opacity-[0.15] blur-3xl"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }}
          animate={{ x: ['80%', '-10%', '50%'], y: ['60%', '-10%', '80%'], scale: [0.9, 1.3, 1] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear' }} 
        />
        
        {/* Grid pattern */}
        <div 
          className="absolute inset-0 opacity-[0.03]" 
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Persistent Midground Elements */}
      <motion.div
        className="absolute w-[2px] bg-blue-500/50"
        animate={{
          left: ['10%', '90%', '50%', '80%', '20%'][currentScene],
          top: ['20%', '10%', '80%', '30%', '60%'][currentScene],
          height: ['100px', '200px', '50px', '150px', '300px'][currentScene],
          opacity: [0, 1, 0.5, 1, 0.3][currentScene],
        }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
      />
      
      <motion.div
        className="absolute h-[2px] bg-purple-500/50"
        animate={{
          left: ['0%', '20%', '10%', '40%', '0%'][currentScene],
          top: ['80%', '20%', '50%', '90%', '40%'][currentScene],
          width: ['100px', '300px', '500px', '200px', '150px'][currentScene],
          opacity: [0, 0.5, 1, 0.4, 0.8][currentScene],
        }}
        transition={{ duration: 1.5, ease: [0.16, 1, 0.3, 1] }}
      />

      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene1 key="open" />}
        {currentScene === 1 && <Scene2 key="providers" />}
        {currentScene === 2 && <Scene3 key="features" />}
        {currentScene === 3 && <Scene4 key="value" />}
        {currentScene === 4 && <Scene5 key="close" />}
      </AnimatePresence>
    </div>
  );
}
