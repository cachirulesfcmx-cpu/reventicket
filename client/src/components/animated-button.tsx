import { motion } from "framer-motion";
import { Button, ButtonProps } from "@/components/ui/button";
import { forwardRef, useState } from "react";
import { cn } from "@/lib/utils";

interface RippleProps {
  x: number;
  y: number;
  size: number;
}

export const AnimatedButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ children, className, onClick, ...props }, ref) => {
    const [ripples, setRipples] = useState<RippleProps[]>([]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      const newRipple = { x, y, size };
      setRipples((prev) => [...prev, newRipple]);

      setTimeout(() => {
        setRipples((prev) => prev.slice(1));
      }, 600);

      onClick?.(e);
    };

    return (
      <motion.div
        whileTap={{ scale: 0.98 }}
        whileHover={{ scale: 1.02 }}
        transition={{ type: "spring", stiffness: 400, damping: 17 }}
      >
        <Button
          ref={ref}
          onClick={handleClick}
          className={cn("relative overflow-hidden", className)}
          {...props}
        >
          {ripples.map((ripple, i) => (
            <span
              key={i}
              className="absolute rounded-full bg-white/30 animate-ripple pointer-events-none"
              style={{
                left: ripple.x,
                top: ripple.y,
                width: ripple.size,
                height: ripple.size,
              }}
            />
          ))}
          {children}
        </Button>
      </motion.div>
    );
  }
);

AnimatedButton.displayName = "AnimatedButton";
