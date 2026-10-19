import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene4() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 1000),
      setTimeout(() => setPhase(3), 1500),
      setTimeout(() => setPhase(4), 3000),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center bg-blue-600/10"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.2, ease: [0.65, 0, 0.35, 1] }}
    >
      <div className="text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={phase >= 1 ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-[2.5vw] font-bold text-white/80 mb-8">
            One line of code change.
          </p>
        </motion.div>

        <motion.div
          className="bg-[#0d1117] border border-white/20 rounded-2xl p-8 text-left font-mono text-xl shadow-2xl relative overflow-hidden"
          initial={{ opacity: 0, y: 40 }}
          animate={phase >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500" />
          <div className="text-blue-400">const <span className="text-white">client</span> = <span className="text-purple-400">new</span> <span className="text-yellow-200">OpenAI</span>({'{'}</div>
          <div className="pl-8 text-white/80">apiKey: <span className="text-green-300">"sk-apinet-..."</span>,</div>
          <div className="pl-8 text-white/80 relative">
            baseURL: <span className="text-green-300 relative z-10">"https://apinet.cloud"</span>
            <motion.div 
              className="absolute -inset-2 bg-blue-500/20 rounded-lg blur-md"
              initial={{ opacity: 0 }}
              animate={phase >= 3 ? { opacity: 1 } : { opacity: 0 }}
            />
          </div>
          <div className="text-white">{'}'});</div>
        </motion.div>
      </div>
    </motion.div>
  );
}
