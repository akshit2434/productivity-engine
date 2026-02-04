"use client";

import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4, 
        ease: [0.22, 1, 0.36, 1], // Custom cubic-bezier for a premium "native" feel
        delay: 0.1 
      }}
    >
      {children}
    </motion.div>
  );
}
