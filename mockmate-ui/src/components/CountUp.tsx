import { useEffect, useState } from 'react';

// Animates a number from 0 up to `value` on mount (easeOutCubic).
export default function CountUp({
    value,
    decimals = 0,
    duration = 850,
}: {
    value: number;
    decimals?: number;
    duration?: number;
}) {
    const [n, setN] = useState(0);
    // Reduced motion: show the final value straight away, no animation state.
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    useEffect(() => {
        if (reduceMotion) return;
        let raf = 0;
        const start = performance.now();
        const tick = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setN(value * eased);
            if (p < 1) raf = requestAnimationFrame(tick);
            else setN(value);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [value, duration, reduceMotion]);

    const shown = reduceMotion ? value : n;
    return <>{decimals ? shown.toFixed(decimals) : Math.round(shown)}</>;
}
