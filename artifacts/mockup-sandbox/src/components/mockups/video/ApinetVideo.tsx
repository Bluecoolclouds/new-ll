import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SCENE_DURATIONS = [4500, 4500, 4500, 4500, 4500, 3500];

function useSimpleVideoPlayer() {
  const [currentScene, setCurrentScene] = useState(0);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const playNext = (index: number) => {
      if (index >= SCENE_DURATIONS.length) {
        setCurrentScene(0);
        playNext(0);
        return;
      }
      setCurrentScene(index);
      timeoutId = setTimeout(() => {
        playNext(index + 1);
      }, SCENE_DURATIONS[index]);
    };
    
    playNext(0);
    
    return () => clearTimeout(timeoutId);
  }, []);

  return { currentScene };
}

// Scenes
function Scene0() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20"
      initial={{ opacity: 0, scale: 1.1 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.8 }}>
      <motion.div className="text-[#3b82f6] font-bold text-2xl tracking-widest mb-4"
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        ШАГ 1
      </motion.div>
      <motion.h2 className="text-6xl font-black mb-8 text-center"
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
        Быстрая регистрация
      </motion.h2>
      
      <div className="relative w-96 h-48 bg-[#0a0f1e] border border-[#3b82f6]/30 rounded-2xl overflow-hidden shadow-[0_0_40px_rgba(59,130,246,0.15)] flex flex-col items-center justify-center">
        <motion.div className="w-64 h-12 bg-white/5 rounded-lg mb-4 flex items-center px-4"
          initial={{ x: -20, opacity: 0 }} animate={phase >= 1 ? { x: 0, opacity: 1 } : { x: -20, opacity: 0 }} transition={{ type: "spring" }}>
          <div className="w-4 h-4 rounded-full bg-white/20 mr-3"></div>
          <div className="h-2 w-32 bg-white/20 rounded"></div>
        </motion.div>
        <motion.div className="w-64 h-12 bg-[#3b82f6] rounded-lg flex items-center justify-center font-bold text-lg"
          initial={{ y: 20, opacity: 0 }} animate={phase >= 2 ? { y: 0, opacity: 1 } : { y: 20, opacity: 0 }} transition={{ type: "spring", stiffness: 300 }}>
          Войти
        </motion.div>
      </div>
    </motion.div>
  );
}

function Scene1() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 600),
      setTimeout(() => setPhase(2), 1600),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20"
      initial={{ opacity: 0, x: "100%" }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: "-100%" }} transition={{ type: "spring", damping: 25, stiffness: 120 }}>
      <motion.div className="text-[#3b82f6] font-bold text-2xl tracking-widest mb-4"
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        ШАГ 2
      </motion.div>
      <motion.h2 className="text-6xl font-black mb-8 text-center"
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
        Пополнение баланса
      </motion.h2>

      <div className="relative flex space-x-6">
        <motion.div className="w-48 h-32 bg-gradient-to-br from-[#3b82f6]/20 to-[#6366f1]/10 border border-[#3b82f6]/40 rounded-xl flex flex-col items-center justify-center shadow-lg"
          initial={{ scale: 0 }} animate={phase >= 1 ? { scale: 1 } : { scale: 0 }} transition={{ type: "spring", damping: 15 }}>
          <span className="text-4xl font-bold text-[#3b82f6] mb-2">$50</span>
          <span className="text-sm text-white/50">Crypto</span>
        </motion.div>
        <motion.div className="w-48 h-32 bg-gradient-to-br from-[#6366f1]/20 to-[#3b82f6]/10 border border-[#6366f1]/40 rounded-xl flex flex-col items-center justify-center shadow-lg"
          initial={{ scale: 0 }} animate={phase >= 2 ? { scale: 1 } : { scale: 0 }} transition={{ type: "spring", damping: 15 }}>
          <span className="text-4xl font-bold text-[#6366f1] mb-2">₽</span>
          <span className="text-sm text-white/50">Карты РФ</span>
        </motion.div>
      </div>
    </motion.div>
  );
}

function Scene2() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 500),
      setTimeout(() => setPhase(2), 1500),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20"
      initial={{ opacity: 0, y: "100%" }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 1.2 }} transition={{ type: "spring", damping: 25, stiffness: 120 }}>
      <motion.div className="text-[#6366f1] font-bold text-2xl tracking-widest mb-4"
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        ШАГ 3
      </motion.div>
      <motion.h2 className="text-6xl font-black mb-8 text-center"
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
        Активация промокода
      </motion.h2>

      <div className="relative w-full max-w-md">
        <motion.div className="flex bg-[#0a0f1e] border border-[#6366f1]/40 rounded-xl p-2 shadow-[0_0_30px_rgba(99,102,241,0.2)]"
          initial={{ width: "20%" }} animate={phase >= 1 ? { width: "100%" } : { width: "20%" }} transition={{ duration: 0.6, ease: "circOut" }}>
          <div className="flex-1 bg-transparent px-4 py-3 text-2xl font-mono text-[#6366f1] tracking-widest opacity-0"
            style={{ opacity: phase >= 2 ? 1 : 0, transition: 'opacity 0.3s 0.6s' }}>
            START2024
          </div>
          <motion.div className="bg-[#6366f1] text-white font-bold px-6 py-3 rounded-lg flex items-center whitespace-nowrap"
            initial={{ opacity: 0 }} animate={phase >= 1 ? { opacity: 1 } : { opacity: 0 }} transition={{ delay: 0.4 }}>
            Применить
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function Scene3() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 700),
      setTimeout(() => setPhase(2), 1800),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20"
      initial={{ opacity: 0, scale: 0.5, rotateX: 45 }} animate={{ opacity: 1, scale: 1, rotateX: 0 }} exit={{ opacity: 0, scale: 1.5, filter: "blur(10px)" }} transition={{ type: "spring", damping: 20 }}>
      <motion.div className="text-[#3b82f6] font-bold text-2xl tracking-widest mb-4"
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        ШАГ 4
      </motion.div>
      <motion.h2 className="text-6xl font-black mb-8 text-center"
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
        Создание API-ключа
      </motion.h2>

      <motion.div className="w-32 h-32 rounded-full border-4 border-[#3b82f6] flex items-center justify-center shadow-[0_0_50px_rgba(59,130,246,0.3)] mb-6"
        initial={{ scale: 0, rotate: -180 }} animate={phase >= 1 ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -180 }} transition={{ type: "spring", stiffness: 100 }}>
        <div className="w-16 h-16 rounded-full bg-[#3b82f6] flex items-center justify-center">
          <div className="w-6 h-6 bg-[#0a0f1e] rounded-full"></div>
        </div>
      </motion.div>

      <motion.div className="bg-[#0a0f1e] border border-[#3b82f6]/40 px-6 py-4 rounded-xl font-mono text-xl text-[#3b82f6] shadow-xl overflow-hidden relative"
        initial={{ opacity: 0, width: 0 }} animate={phase >= 2 ? { opacity: 1, width: "auto" } : { opacity: 0, width: 0 }} transition={{ duration: 0.8, ease: "easeOut" }}>
        sk-apinet-xxxxxxxxxxxxxxxxx
      </motion.div>
    </motion.div>
  );
}

function Scene4() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 800),
      setTimeout(() => setPhase(2), 2000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20"
      initial={{ opacity: 0, x: "-100%" }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: "100%" }} transition={{ type: "spring", damping: 25 }}>
      <motion.div className="text-[#6366f1] font-bold text-2xl tracking-widest mb-4"
        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}>
        ШАГ 5
      </motion.div>
      <motion.h2 className="text-6xl font-black mb-8 text-center"
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}>
        Первый запрос
      </motion.h2>

      <div className="bg-[#0a0f1e] border border-white/10 rounded-xl p-6 shadow-2xl w-full max-w-2xl font-mono text-sm leading-relaxed">
        <motion.div className="text-[#3b82f6]" initial={{ opacity: 0, x: -20 }} animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}>
          curl https://apinet.cloud/v1/chat/completions \
        </motion.div>
        <motion.div className="text-white/70 ml-4" initial={{ opacity: 0, x: -20 }} animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }} transition={{ delay: 0.1 }}>
          -H "Authorization: Bearer sk-..." \
        </motion.div>
        <motion.div className="text-white/70 ml-4" initial={{ opacity: 0, x: -20 }} animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }} transition={{ delay: 0.2 }}>
          -d '&#123;"model": "gpt-4o", "messages": [...]&#125;'
        </motion.div>
        
        <motion.div className="mt-6 text-[#10b981]"
          initial={{ opacity: 0, y: 10 }} animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }} transition={{ type: "spring" }}>
          &#123;
          <br/>
          &nbsp;&nbsp;"choices": [
          <br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&#123;"message": &#123;"content": "Привет! Чем могу помочь?"&#125;&#125;
          <br/>
          &nbsp;&nbsp;]
          <br/>
          &#125;
        </motion.div>
      </div>
    </motion.div>
  );
}

function Scene5() {
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20"
      initial={{ opacity: 0, scale: 2 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.8 }} transition={{ duration: 1, ease: "easeOut" }}>
      <motion.div className="text-7xl font-black mb-4 tracking-tighter"
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5, type: "spring", stiffness: 100 }}>
        APINET<span className="text-[#3b82f6]">.CLOUD</span>
      </motion.div>
      <motion.div className="text-2xl text-white/70 font-light"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 1 }}>
        Все AI-модели в одном API
      </motion.div>
    </motion.div>
  );
}

export function ApinetVideo() {
  const { currentScene } = useSimpleVideoPlayer();

  return (
    <div className="relative w-full h-screen overflow-hidden bg-[#0a0f1e] font-sans">
      {/* Background Layer */}
      <div className="absolute inset-0 z-0">
        <motion.div className="absolute w-[800px] h-[800px] rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent)' }}
          animate={{ x: ['-20%', '80%', '10%'], y: ['-10%', '60%', '20%'], scale: [1, 1.2, 0.8] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }} />
        <motion.div className="absolute w-[600px] h-[600px] rounded-full opacity-10 blur-3xl pointer-events-none bottom-0 right-0"
          style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }}
          animate={{ x: ['20%', '-50%', '0%'], y: ['10%', '-40%', '-10%'] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }} />
      </div>

      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene0 key="scene0" />}
        {currentScene === 1 && <Scene1 key="scene1" />}
        {currentScene === 2 && <Scene2 key="scene2" />}
        {currentScene === 3 && <Scene3 key="scene3" />}
        {currentScene === 4 && <Scene4 key="scene4" />}
        {currentScene === 5 && <Scene5 key="scene5" />}
      </AnimatePresence>
    </div>
  );
}

export default ApinetVideo;
