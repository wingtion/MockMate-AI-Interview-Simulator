import { useEffect, useRef } from 'react';
import { cssToken } from '../lib/tokens';

interface VisualizerProps {
    isListening: boolean;
    isSpeaking: boolean;
}

const AudioVisualizer = ({ isListening, isSpeaking }: VisualizerProps) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const heightsRef = useRef<number[]>([2, 2, 2, 2, 2]);
    const lastUpdateRef = useRef<number>(0);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Signal Light Rule: red while you record, mint while the interviewer speaks.
        const idleColor = cssToken('--surface-hover', '#2c2f37');
        const recColor = cssToken('--red', '#ff5f5f');
        const speakColor = cssToken('--accent', '#239978');

        let animationId: number;

        const render = (timestamp: number) => {
            // Only pick new random heights every 120ms
            if (timestamp - lastUpdateRef.current > 120) {
                lastUpdateRef.current = timestamp;

                let multiplier = 0;
                if (isListening) multiplier = 10;
                else if (isSpeaking) multiplier = 20;

                heightsRef.current = heightsRef.current.map(() =>
                    (isListening || isSpeaking)
                        ? Math.random() * multiplier + 4
                        : 2
                );
            }

            let color = idleColor;
            if (isListening) color = recColor;
            else if (isSpeaking) color = speakColor;

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const barWidth = 8;
            const gap = 6;
            const totalWidth = 5 * barWidth + 4 * gap;
            const startX = (canvas.width - totalWidth) / 2;
            const centerY = canvas.height / 2;

            heightsRef.current.forEach((height, i) => {
                ctx.fillStyle = color;
                const x = startX + i * (barWidth + gap);
                const y = centerY - height / 2;
                ctx.beginPath();
                ctx.roundRect(x, y, barWidth, height, 4);
                ctx.fill();
            });

            animationId = requestAnimationFrame(render);
        };

        animationId = requestAnimationFrame(render);
        return () => cancelAnimationFrame(animationId);
    }, [isListening, isSpeaking]);

    return (
        <canvas
            ref={canvasRef}
            width={100}
            height={40}
            style={{ width: '100px', height: '40px' }}
            aria-hidden="true"
        />
    );
};

export default AudioVisualizer;