import { useEffect, useRef, useState } from 'react';

// Content should never depend on an animation to become visible: with reduced
// motion, or without IntersectionObserver, it renders shown from the start.
const showImmediately = () =>
    typeof window === 'undefined' ||
    !('IntersectionObserver' in window) ||
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Fades its children up into view the first time they enter the viewport.
// Add a `stagger` class to a grid/list child to cascade its items.
export default function Reveal({
    children,
    className = '',
}: {
    children: React.ReactNode;
    className?: string;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const [inView, setInView] = useState(showImmediately);

    useEffect(() => {
        if (inView) return;
        const el = ref.current;
        if (!el) return;
        // threshold 0: any visible pixel counts. A ratio threshold never fires for
        // blocks taller than the viewport (e.g. a long history list on a phone).
        const io = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setInView(true);
                    io.disconnect();
                }
            },
            { threshold: 0, rootMargin: '0px 0px -8% 0px' },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [inView]);

    return (
        <div ref={ref} className={`reveal ${inView ? 'in' : ''} ${className}`}>
            {children}
        </div>
    );
}
