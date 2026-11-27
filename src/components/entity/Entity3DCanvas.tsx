import React, { useEffect, useRef, useState } from "react";
import { type EntityCustomization, type EvolutionStage, EVOLUTION_STAGES } from "@/lib/entity";

interface Entity3DCanvasProps {
  customization: EntityCustomization;
  stage?: EvolutionStage;
  height?: number | string;
  interactive?: boolean;
  className?: string;
  spinSpeed?: number;
}

interface Point3D {
  x: number;
  y: number;
  z: number;
}

export function Entity3DCanvas({
  customization,
  stage = "awakened",
  height = 360,
  interactive = true,
  className = "",
  spinSpeed = 1,
}: Entity3DCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotX, setRotX] = useState(0.2);
  const [rotY, setRotY] = useState(0);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Geometry generator based on core shape
  const getCoreVertices = (): { vertices: Point3D[]; edges: [number, number][] } => {
    switch (customization.coreShape) {
      case "octahedron": {
        const s = 1.2;
        const vertices: Point3D[] = [
          { x: 0, y: -s, z: 0 },
          { x: 0, y: s, z: 0 },
          { x: -s, y: 0, z: 0 },
          { x: s, y: 0, z: 0 },
          { x: 0, y: 0, z: -s },
          { x: 0, y: 0, z: s },
        ];
        const edges: [number, number][] = [
          [0, 2], [0, 3], [0, 4], [0, 5],
          [1, 2], [1, 3], [1, 4], [1, 5],
          [2, 4], [4, 3], [3, 5], [5, 2],
        ];
        return { vertices, edges };
      }
      case "icosahedron": {
        const phi = (1 + Math.sqrt(5)) / 2;
        const a = 0.7;
        const b = a / phi;
        const vertices: Point3D[] = [
          { x: 0, y: b, z: a }, { x: 0, y: b, z: -a }, { x: 0, y: -b, z: a }, { x: 0, y: -b, z: -a },
          { x: b, y: a, z: 0 }, { x: b, y: -a, z: 0 }, { x: -b, y: a, z: 0 }, { x: -b, y: -a, z: 0 },
          { x: a, y: 0, z: b }, { x: -a, y: 0, z: b }, { x: a, y: 0, z: -b }, { x: -a, y: 0, z: -b },
        ];
        const edges: [number, number][] = [
          [0, 8], [0, 9], [0, 4], [0, 6], [0, 2],
          [1, 10], [1, 11], [1, 4], [1, 6], [1, 3],
          [2, 8], [2, 9], [2, 5], [2, 7],
          [3, 10], [3, 11], [3, 5], [3, 7],
          [4, 8], [4, 10], [6, 9], [6, 11],
          [5, 8], [5, 10], [7, 9], [7, 11],
        ];
        return { vertices, edges };
      }
      case "hypercube": {
        const s = 0.85;
        const vertices: Point3D[] = [];
        for (let i = 0; i < 8; i++) {
          vertices.push({
            x: (i & 1 ? 1 : -1) * s,
            y: (i & 2 ? 1 : -1) * s,
            z: (i & 4 ? 1 : -1) * s,
          });
        }
        // Inner tesseract core
        for (let i = 0; i < 8; i++) {
          vertices.push({
            x: (i & 1 ? 1 : -1) * s * 0.45,
            y: (i & 2 ? 1 : -1) * s * 0.45,
            z: (i & 4 ? 1 : -1) * s * 0.45,
          });
        }
        const edges: [number, number][] = [
          [0, 1], [1, 3], [3, 2], [2, 0],
          [4, 5], [5, 7], [7, 6], [6, 4],
          [0, 4], [1, 5], [2, 6], [3, 7],
          // Inner box
          [8, 9], [9, 11], [11, 10], [10, 8],
          [12, 13], [13, 15], [15, 14], [14, 12],
          [8, 12], [9, 13], [10, 14], [11, 15],
          // Cross-connectors
          [0, 8], [1, 9], [2, 10], [3, 11],
          [4, 12], [5, 13], [6, 14], [7, 15],
        ];
        return { vertices, edges };
      }
      default: {
        // Star & crystal fallback
        const s = 1.3;
        const vertices: Point3D[] = [
          { x: 0, y: -s, z: 0 },
          { x: 0, y: s, z: 0 },
          { x: -s, y: 0, z: 0 },
          { x: s, y: 0, z: 0 },
          { x: 0, y: 0, z: -s },
          { x: 0, y: 0, z: s },
          { x: 0, y: 0, z: 0 },
        ];
        const edges: [number, number][] = [
          [0, 2], [0, 3], [0, 4], [0, 5],
          [1, 2], [1, 3], [1, 4], [1, 5],
          [2, 4], [4, 3], [3, 5], [5, 2],
          [6, 0], [6, 1], [6, 2], [6, 3],
        ];
        return { vertices, edges };
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let time = 0;

    const { vertices, edges } = getCoreVertices();

    // Swarming particles
    const particleCount = customization.particleDensity === "subtle" ? 25 : customization.particleDensity === "balanced" ? 50 : 85;
    const particles = Array.from({ length: particleCount }, () => ({
      theta: Math.random() * Math.PI * 2,
      phi: Math.acos(Math.random() * 2 - 1),
      radius: 1.4 + Math.random() * 0.9,
      speed: 0.01 + Math.random() * 0.02,
      size: 1.5 + Math.random() * 2.5,
    }));

    const render = () => {
      time += 0.02 * (customization.resonanceSpeed === "overdrive" ? 2 : customization.resonanceSpeed === "calm" ? 0.6 : 1);
      const width = canvas.width;
      const heightPx = canvas.height;
      const cx = width / 2;
      const cy = heightPx / 2;
      const scale = Math.min(width, heightPx) * 0.28;

      ctx.clearRect(0, 0, width, heightPx);

      // Deep space atmospheric aura
      const radial = ctx.createRadialGradient(cx, cy, 10, cx, cy, scale * 1.8);
      radial.addColorStop(0, `${customization.primaryColor}33`);
      radial.addColorStop(0.5, `${customization.secondaryColor}15`);
      radial.addColorStop(1, "transparent");
      ctx.fillStyle = radial;
      ctx.fillRect(0, 0, width, heightPx);

      // 3D rotation angles
      const currentRotY = rotY + time * spinSpeed * 0.8;
      const currentRotX = rotX + Math.sin(time * 0.5) * 0.1;

      const cosX = Math.cos(currentRotX);
      const sinX = Math.sin(currentRotX);
      const cosY = Math.cos(currentRotY);
      const sinY = Math.sin(currentRotY);

      const project = (p: Point3D) => {
        // Rotate around Y
        const x1 = p.x * cosY - p.z * sinY;
        const z1 = p.x * sinY + p.z * cosY;
        // Rotate around X
        const y2 = p.y * cosX - z1 * sinX;
        const z2 = p.y * sinX + z1 * cosX;

        const distance = 4.0;
        const fov = distance / (distance + z2);
        return {
          x: cx + x1 * scale * fov,
          y: cy + y2 * scale * fov,
          z: z2,
          scale: fov,
        };
      };

      // Orbiting Quantum Rings
      const ringCount = Math.min(customization.orbitalRings, stage === "transcendent" ? 3 : stage === "ascended" ? 2 : 1);
      for (let r = 0; r < ringCount; r++) {
        ctx.save();
        ctx.beginPath();
        const ringTilt = (r * Math.PI) / 3 + time * 0.4;
        const pts: { x: number; y: number }[] = [];
        for (let a = 0; a <= Math.PI * 2; a += 0.15) {
          const rx = Math.cos(a) * 1.8;
          const ry = Math.sin(a) * Math.sin(ringTilt) * 1.8;
          const rz = Math.sin(a) * Math.cos(ringTilt) * 1.8;
          const proj = project({ x: rx, y: ry, z: rz });
          pts.push(proj);
        }
        pts.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.strokeStyle = r % 2 === 0 ? customization.secondaryColor : customization.primaryColor;
        ctx.lineWidth = 1.5;
        ctx.shadowColor = customization.secondaryColor;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.restore();
      }

      // Draw Projected Edges
      const projectedVertices = vertices.map(project);

      ctx.save();
      ctx.lineWidth = 2;
      ctx.strokeStyle = customization.primaryColor;
      ctx.shadowColor = customization.primaryColor;
      ctx.shadowBlur = 14;

      edges.forEach(([i, j]) => {
        const p1 = projectedVertices[i];
        const p2 = projectedVertices[j];
        if (p1 && p2) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.stroke();
        }
      });
      ctx.restore();

      // Draw Floating Core Nodes
      projectedVertices.forEach((p) => {
        ctx.save();
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(2, 4 * p.scale), 0, Math.PI * 2);
        ctx.fillStyle = customization.secondaryColor;
        ctx.shadowColor = customization.secondaryColor;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.restore();
      });

      // Orbiting Stardust Particles
      particles.forEach((pt) => {
        pt.theta += pt.speed;
        const px = pt.radius * Math.sin(pt.phi) * Math.cos(pt.theta);
        const py = pt.radius * Math.sin(pt.phi) * Math.sin(pt.theta);
        const pz = pt.radius * Math.cos(pt.phi);
        const proj = project({ x: px, y: py, z: pz });

        ctx.save();
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, Math.max(1, pt.size * proj.scale), 0, Math.PI * 2);
        ctx.fillStyle = pt.size > 2.5 ? customization.secondaryColor : customization.primaryColor;
        ctx.shadowColor = customization.primaryColor;
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.restore();
      });

      // Transcendent Celestial Corona
      if (stage === "transcendent") {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, scale * 0.9 + Math.sin(time * 3) * 6, 0, Math.PI * 2);
        ctx.strokeStyle = "#fdf4ff";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#f0abfc";
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => cancelAnimationFrame(animId);
  }, [customization, stage, rotX, rotY, spinSpeed]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!interactive) return;
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging.current || !interactive) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    setRotY((prev) => prev + dx * 0.012);
    setRotX((prev) => Math.max(-1.2, Math.min(1.2, prev + dy * 0.012)));
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => {
    isDragging.current = false;
  };

  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-2xl bg-zinc-950/80 border border-purple-500/20 ${className}`}>
      <canvas
        ref={canvasRef}
        width={480}
        height={typeof height === "number" ? height : 360}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="touch-none cursor-grab active:cursor-grabbing w-full h-full"
      />
      <div className="absolute bottom-2 right-3 pointer-events-none text-[10px] font-mono text-purple-300/50 uppercase tracking-wider">
        {EVOLUTION_STAGES[stage].name}
      </div>
    </div>
  );
}
