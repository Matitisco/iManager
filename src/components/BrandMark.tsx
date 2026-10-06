import { Box } from 'lucide-react';
import { motion } from 'motion/react';

/** Production mark: black rounded square, white Box, 90° hover spin. */
export function BrandMark() {
  return (
    <motion.div
      whileHover={{ rotate: 90 }}
      transition={{ type: 'spring', stiffness: 200, damping: 10 }}
      className="bg-black text-white p-2 rounded-lg shrink-0"
      style={{ background: '#000', color: '#fff', padding: 8, borderRadius: 8 }}
      aria-hidden="true"
    >
      <Box size={20} color="#fff" />
    </motion.div>
  );
}

export function BrandLockup({
  subtitle,
  tone = 'dark',
}: {
  subtitle?: string;
  tone?: 'dark' | 'light';
}) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <BrandMark />
      <div className="min-w-0">
        <div className={tone === 'light' ? 'text-2xl font-bold tracking-tight leading-tight' : 'font-bold text-lg leading-tight text-[#16181D]'}>
          iManager
        </div>
        {subtitle ? (
          <p className={`text-xs font-medium truncate ${tone === 'light' ? 'text-zinc-400' : 'text-[#737984]'}`}>
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}
