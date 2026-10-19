import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Shield, Coins, Users } from 'lucide-react';

export function Scene3() {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 300),
      setTimeout(() => setPhase(2), 800),
      setTimeout(() => setPhase(3), 1300),
      setTimeout(() => setPhase(4), 3500),
    ];
    return () => timers.forEach(t => clearTimeout(t));
  }, []);

  const features = [
    { icon: <Activity size={32} className="text-blue-400" />, title: "Rate Limiting", desc: "Protect your upstream budgets" },
    { icon: <Coins size={32} className="text-purple-400" />, title: "Cost Tracking", desc: "Real-time usage analytics" },
    { icon: <Users size={32} className="text-pink-400" />, title: "Team Billing", desc: "Allocate credits per user" }
  ];

  return (
    <motion.div 
      className="absolute inset-0 flex items-center justify-center px-24"
      initial={{ opacity: 0, y: 100 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 1.1, filter: 'blur(10px)' }}
      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="w-full flex gap-16 items-center">
        <motion.div 
          className="flex-1"
          initial={{ opacity: 0, x: -40 }}
          animate={phase >= 1 ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
        >
          <h2 className="text-[3.5vw] font-bold leading-tight mb-6">
            Complete Control<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Out of the Box
            </span>
          </h2>
          <p className="text-2xl text-white/60">
            Enterprise-grade management for your AI usage.
          </p>
        </motion.div>

        <div className="flex-1 flex flex-col gap-6">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              className="bg-white/5 border border-white/10 rounded-2xl p-6 flex items-start gap-6 backdrop-blur-md"
              initial={{ opacity: 0, x: 40 }}
              animate={phase >= 2 ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
              transition={{ delay: i * 0.2, type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                {f.icon}
              </div>
              <div>
                <h3 className="text-2xl font-bold mb-2">{f.title}</h3>
                <p className="text-white/60 text-lg">{f.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
