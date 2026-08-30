"use client";

import { useEffect, useRef, useState } from "react";
import { animate } from "framer-motion";

export default function AnimatedNumber({
  value,
  formatter,
  className,
}: {
  value: number;
  formatter?: (n: number) => string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const prevValue = useRef(value);

  useEffect(() => {
    const controls = animate(prevValue.current, value, {
      duration: 0.6,
      ease: "easeOut",
      onUpdate: (latest) => setDisplay(latest),
    });
    prevValue.current = value;
    return () => controls.stop();
  }, [value]);

  const format = formatter ?? ((n: number) => Math.round(n).toString());

  return <span className={className}>{format(display)}</span>;
}
