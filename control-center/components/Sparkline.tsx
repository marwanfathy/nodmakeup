'use client';

import { useEffect, useRef } from 'react';
import type { SeriesData } from '@/lib/types';

const hexA = (hex: string, alpha: number): string => {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return `rgba(232,131,108,${alpha})`;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
};

/** Dependency-free canvas line chart (port of public/charts.js to React). */
export default function Sparkline({ series, color }: { series: SeriesData; color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const w = Math.max(10, Math.floor(rect.width * dpr));
    const h = Math.max(10, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const t = series.t || [];
    const v = series.v || [];
    ctx.clearRect(0, 0, w, h);

    if (t.length < 2) {
      ctx.strokeStyle = 'rgba(139,147,161,0.25)';
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      return;
    }

    const tMin = t[0];
    const tSpan = Math.max(1, t[t.length - 1] - tMin);
    const vMin = Math.min(...v);
    const vMax = Math.max(...v);
    const vSpan = Math.max(1e-6, vMax - vMin);
    const x = (i: number): number => (tMin === t[t.length - 1] ? w : ((t[i] - tMin) / tSpan) * w);
    const y = (i: number): number => h - ((v[i] - vMin) / vSpan) * (h - 8) - 4;

    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, hexA(color, 0.28));
    grad.addColorStop(1, hexA(color, 0.02));
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let i = 0; i < v.length; i++) ctx.lineTo(x(i), y(i));
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.beginPath();
    for (let i = 0; i < v.length; i++) {
      if (i === 0) ctx.moveTo(x(i), y(i));
      else ctx.lineTo(x(i), y(i));
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6 * dpr;
    ctx.lineJoin = 'round';
    ctx.stroke();

    const last = v.length - 1;
    ctx.beginPath();
    ctx.arc(x(last), y(last), 2.6 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }, [series, color]);

  return <canvas ref={ref} className="spark" />;
}