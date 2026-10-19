import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function Scene2() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 600),
      setTimeout(() => setPhase(3), 1000),
      setTimeout(() => setPhase(4), 1400),
      setTimeout(() => setPhase(5), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const providers = ["OpenAI", "Claude", "Gemini", "DeepSeek", "Llama", "Cohere", "Mistral", "Grok"];

  return (
    <motion.div 
      className="absolute inset-0 flex flex-col items-center justify-center px-24"
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full max-w-5xl">
        <motion.div 
          className="text-left mb-12"
          initial={{ opacity: 0, y: 20 }}
          animate={phase >= 1 ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
        >
          <h2 className="text-[4vw] font-bold leading-tight">
            40+ AI Providers.<br/>
            <span className="text-white/50">Standardized.</span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-4 gap-4 w-full">
          {providers.map((p, i) => (
            <motion.div
              key={p}
              className="bg-white/5 border border-white/10 rounded-xl p-6 flex items-center justify-center backdrop-blur-sm"
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={phase >= 2 ? { opacity: 1, scale: 1, y: 0 } : { opacity: 0, scale: 0.8, y: 20 }}
              transition={{ delay: i * 0.1, type: 'spring', stiffness: 300, damping: 20 }}
            >
              <span className="text-xl font-semibold text-white/90">{p}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
