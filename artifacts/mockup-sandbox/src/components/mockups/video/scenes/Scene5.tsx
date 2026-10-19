import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene5() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 400),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 3000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-[#050505]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 1 }}
    >
      <div className="text-center relative z-10">
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1, rotate: 0 } : { opacity: 0, scale: 0.8, rotate: -10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {/* APINET Logo placeholder */}
          <div className="w-32 h-32 mx-auto bg-gradient-to-tr from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(59,130,246,0.4)]">
            <span className="text-5xl font-bold">A</span>
          </div>
        </motion.div>

        <motion.h1 
          className="text-[4vw] font-bold tracking-tight mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ delay: 0.2 }}
        >
          APINET.CLOUD
        </motion.h1>

        <motion.div
          initial={{ opacity: 0 }}
          animate={phase >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="px-8 py-4 rounded-full bg-white text-black font-semibold text-2xl tracking-wide">
            Start Routing Today
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
