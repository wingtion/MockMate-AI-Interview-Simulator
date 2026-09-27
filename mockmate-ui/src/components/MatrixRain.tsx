import { useEffect, useRef } from 'react';
import { cssToken } from '../lib/tokens';

// Matrix-style digital rain, rendered to a full-screen canvas behind the page content.
const CHARS = (
    '0123456789' +
    'ｦｧｨｩｪｫｬｭｮｯｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ' +
    '+*=<>/$#%'
).split('');

const FONT_SIZE = 16;

export default function MatrixRain() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const rainColor = cssToken('--accent', '#239978');
        const trailColor = 'rgba(10, 11, 13, 0.08)'; // --bg at 8%, builds the fading trail

        let width = 0;
        let height = 0;
        let drops: number[] = [];

        const resize = () => {
            // Scale the backing store to the device pixel ratio so text stays crisp on hi-DPI screens.
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            const columns = Math.floor(width / FONT_SIZE);
            drops = Array.from({ length: columns }, () => Math.random() * -40);
        };
        resize();
        window.addEventListener('resize', resize);

        let raf = 0;
        let frame = 0;
        const SPEED = 4; // advance one row every SPEED frames (higher = slower)

        const draw = () => {
            raf = requestAnimationFrame(draw);
            if (frame++ % SPEED !== 0) return;

            // translucent fill creates the fading trail
            ctx.fillStyle = trailColor;
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = rainColor;
            ctx.font = `${FONT_SIZE}px 'Geist Mono Variable', monospace`;

            for (let i = 0; i < drops.length; i++) {
                const ch = CHARS[(Math.random() * CHARS.length) | 0];
                const y = drops[i] * FONT_SIZE;
                ctx.fillText(ch, i * FONT_SIZE, y);

                if (y > height && Math.random() > 0.975) drops[i] = 0;
                drops[i] += 1;
            }
        };

        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduceMotion) raf = requestAnimationFrame(draw);

        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener('resize', resize);
        };
    }, []);

    return (
        <div className="matrix-bg" aria-hidden="true">
            <canvas ref={canvasRef} className="matrix-rain" />
        </div>
    );
}
