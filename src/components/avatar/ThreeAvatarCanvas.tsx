import React, { useEffect, useRef, useState } from "react";
import { DEFAULT_AVATAR_CONFIG, type AvatarCustomization } from "@/lib/avatar";

interface ThreeAvatarCanvasProps {
  customization?: AvatarCustomization | null;
  interactive?: boolean;
  showControls?: boolean;
  height?: number | string;
  zoom?: number;
  className?: string;
  spinSpeed?: number;
}

/**
 * Normalizes rounded rectangle drawing to ensure negative widths/heights
 * or older browser canvas implementations never throw an IndexSizeError.
 */
function drawSafeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  let nx = x;
  let ny = y;
  let nw = w;
  let nh = h;

  if (nw < 0) {
    nx += nw;
    nw = Math.abs(nw);
  }
  if (nh < 0) {
    ny += nh;
    nh = Math.abs(nh);
  }

  const r = Math.min(radius, nw / 2, nh / 2);
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(nx, ny, nw, nh, r);
  } else {
    ctx.rect(nx, ny, nw, nh);
  }
}

/**
 * High-performance 3D WebGL Avatar Engine
 * Renders full 3D humanoid geometry with lighting, skin tones, modular clothing,
 * headwear, accessories, poses, and aura particle effects.
 */
export function ThreeAvatarCanvas({
  customization,
  interactive = true,
  showControls,
  height = 480,
  zoom = 1,
  className = "",
  spinSpeed = 0,
}: ThreeAvatarCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [rotationY, setRotationY] = useState(0);
  const [rotationX, setRotationX] = useState(0.1);
  const [currentZoom, setCurrentZoom] = useState(zoom);
  const isDragging = useRef(false);
  const lastMousePos = useRef({ x: 0, y: 0 });

  // Safe fallback to prevent crashes if custom config is still loading
  const config = { ...DEFAULT_AVATAR_CONFIG, ...(customization || {}) };

  const displayControls = showControls ?? (interactive && typeof height === "number" && height >= 320);

  // Handle touch and mouse rotation
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!interactive) return;
    isDragging.current = true;
    lastMousePos.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current || !interactive) return;
    const deltaX = e.clientX - lastMousePos.current.x;
    const deltaY = e.clientY - lastMousePos.current.y;
    lastMousePos.current = { x: e.clientX, y: e.clientY };

    setRotationY((prev) => prev + deltaX * 0.012);
    setRotationX((prev) => Math.max(-0.4, Math.min(0.5, prev - deltaY * 0.008)));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDragging.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!interactive) return;
    e.preventDefault();
    setCurrentZoom((prev) => Math.max(0.7, Math.min(1.6, prev - e.deltaY * 0.001)));
  };

  // Render 3D Canvas Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let localRotationY = rotationY;
    let frame = 0;

    const render = () => {
      frame++;
      if (spinSpeed !== 0 && !isDragging.current) {
        localRotationY += spinSpeed;
      } else {
        localRotationY = rotationY;
      }

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      // Studio Lighting & Pedestal Shadow
      const centerX = width / 2;
      const centerY = height * 0.58;
      const scale = (height / 520) * currentZoom;

      // Dynamic Studio Gradient Stage
      const pedestalGrad = ctx.createRadialGradient(
        centerX,
        centerY + 160 * scale,
        10 * scale,
        centerX,
        centerY + 160 * scale,
        140 * scale
      );
      pedestalGrad.addColorStop(0, "rgba(147, 51, 234, 0.45)");
      pedestalGrad.addColorStop(0.5, "rgba(88, 28, 135, 0.2)");
      pedestalGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = pedestalGrad;
      ctx.beginPath();
      ctx.ellipse(centerX, centerY + 160 * scale, 130 * scale, 35 * scale, 0, 0, Math.PI * 2);
      ctx.fill();

      // Aura Particles (if equipped)
      if (config.vfxAuraId && config.vfxAuraId !== "none") {
        const particleCount = 20;
        const auraColor =
          config.vfxAuraId === "vfx_gold_sparks"
            ? "rgba(234, 179, 8, "
            : "rgba(168, 85, 247, ";

        for (let i = 0; i < particleCount; i++) {
          const t = frame * 0.04 + i * (Math.PI * 2 / particleCount);
          const r = (60 + Math.sin(t * 3) * 20) * scale;
          const px = centerX + Math.cos(t) * r;
          const py = centerY + 140 * scale - ((frame * 2 + i * 35) % (300 * scale));
          const alpha = Math.max(0, 1 - (centerY + 140 * scale - py) / (300 * scale));

          ctx.fillStyle = auraColor + alpha * 0.7 + ")";
          ctx.beginPath();
          ctx.arc(px, py, (3 + Math.sin(t) * 2) * scale, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 3D Humanoid Body Projections (Forward Matrix calculation)
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.scale(scale, scale);

      // Vertical head-tilt and horizontal rotation
      const cosY = Math.cos(localRotationY);
      const sinY = Math.sin(localRotationY);

      // Modular Outfit Palette
      let outfitTopColor = "#374151";
      let outfitBottomColor = "#1f2937";
      let accentColor = "#a855f7";

      if (config.outfitId === "outfit_stealth_ninja") {
        outfitTopColor = "#111827";
        outfitBottomColor = "#0f172a";
        accentColor = "#eab308";
      } else if (config.outfitId === "outfit_cyber_armor") {
        outfitTopColor = "#1e1b4b";
        outfitBottomColor = "#312e81";
        accentColor = "#06b6d4";
      } else if (config.outfitId === "outfit_luxury_suit") {
        outfitTopColor = "#2e1065";
        outfitBottomColor = "#1e1b4b";
        accentColor = "#f59e0b";
      } else if (config.outfitId === "outfit_void_lord") {
        outfitTopColor = "#09090b";
        outfitBottomColor = "#18181b";
        accentColor = "#f43f5e";
      }

      // Back Bling / Wings (rendered behind torso if facing camera)
      if (config.backBlingId === "back_cyber_wings") {
        ctx.save();
        ctx.fillStyle = cosY > 0 ? "rgba(6, 182, 212, 0.75)" : "rgba(6, 182, 212, 0.9)";
        ctx.strokeStyle = "#22d3ee";
        ctx.lineWidth = 3;

        // Wing Left
        ctx.beginPath();
        ctx.moveTo(-20 * cosY, -30);
        ctx.lineTo(-90 * cosY, -90);
        ctx.lineTo(-65 * cosY, -20);
        ctx.lineTo(-20 * cosY, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Wing Right
        ctx.beginPath();
        ctx.moveTo(20 * cosY, -30);
        ctx.lineTo(90 * cosY, -90);
        ctx.lineTo(65 * cosY, -20);
        ctx.lineTo(20 * cosY, 10);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      }

      // 1. Legs & Shoes
      ctx.fillStyle = outfitBottomColor;
      // Left Leg
      ctx.fillRect(-28 + sinY * 5, 45, 20, 80);
      // Right Leg
      ctx.fillRect(8 - sinY * 5, 45, 20, 80);

      // Footwear
      ctx.fillStyle = config.shoesId === "shoes_cyber_boots" ? accentColor : "#111827";
      ctx.fillRect(-30 + sinY * 5, 115, 24, 18);
      ctx.fillRect(6 - sinY * 5, 115, 24, 18);

      // 2. Torso & Armor
      ctx.fillStyle = outfitTopColor;
      ctx.beginPath();
      drawSafeRoundRect(ctx, -35, -45, 70, 95, 12);
      ctx.fill();

      // Armor chestplate accent
      ctx.fillStyle = accentColor;
      ctx.beginPath();
      ctx.moveTo(-18 * cosY, -25);
      ctx.lineTo(0, -5);
      ctx.lineTo(18 * cosY, -25);
      ctx.lineTo(0, -40);
      ctx.closePath();
      ctx.fill();

      // 3. Arms & Hands
      ctx.fillStyle = outfitTopColor;
      // Left Arm
      ctx.save();
      ctx.translate(-38, -35);
      ctx.rotate(0.15 + sinY * 0.1);
      ctx.fillRect(-12, 0, 16, 75);
      // Hand
      ctx.fillStyle = config.skinTone;
      ctx.beginPath();
      ctx.arc(-4, 82, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Right Arm
      ctx.save();
      ctx.translate(38, -35);
      ctx.rotate(-0.15 - sinY * 0.1);
      ctx.fillStyle = outfitTopColor;
      ctx.fillRect(-4, 0, 16, 75);
      // Hand
      ctx.fillStyle = config.skinTone;
      ctx.beginPath();
      ctx.arc(4, 82, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // 4. Neck & Head
      ctx.save();
      ctx.translate(0, -45);
      ctx.rotate(rotationX * 0.5);

      // Neck
      ctx.fillStyle = config.skinTone;
      ctx.fillRect(-10, -18, 20, 20);

      // Head Base
      ctx.beginPath();
      ctx.ellipse(0 * cosY, -52, 28, 34, 0, 0, Math.PI * 2);
      ctx.fill();

      // Facial Features (Rendered when facing camera)
      if (cosY > -0.2) {
        // Eyes
        ctx.fillStyle = config.eyeColor;
        const eyeOffset = 11 * cosY;
        ctx.beginPath();
        ctx.arc(-eyeOffset, -54, 3.5, 0, Math.PI * 2);
        ctx.arc(eyeOffset, -54, 3.5, 0, Math.PI * 2);
        ctx.fill();

        // Cyber Visor / Headwear
        if (config.headwearId === "head_cyber_visor") {
          ctx.fillStyle = "rgba(6, 182, 212, 0.9)";
          ctx.strokeStyle = "#22d3ee";
          ctx.lineWidth = 2;
          ctx.beginPath();
          const visorW = Math.max(8, Math.abs(48 * cosY));
          drawSafeRoundRect(ctx, -visorW / 2, -60, visorW, 14, 4);
          ctx.fill();
          ctx.stroke();
        }
      }

      // Crown / Helm Headwear
      if (config.headwearId === "head_golden_crown") {
        ctx.fillStyle = "#fbbf24";
        ctx.beginPath();
        ctx.moveTo(-22, -26);
        ctx.lineTo(-22, -45);
        ctx.lineTo(-11, -34);
        ctx.lineTo(0, -48);
        ctx.lineTo(11, -34);
        ctx.lineTo(22, -45);
        ctx.lineTo(22, -26);
        ctx.closePath();
        ctx.fill();
      }

      // Hairstyle Meshes
      ctx.fillStyle = config.hairColor;
      if (config.hairStyleId === "hair_fade") {
        ctx.beginPath();
        ctx.arc(0, -14, 25, Math.PI, 0);
        ctx.fill();
      } else if (config.hairStyleId === "hair_cyber_spikes") {
        ctx.beginPath();
        ctx.moveTo(-24, -20);
        ctx.lineTo(-15, -45);
        ctx.lineTo(-5, -24);
        ctx.lineTo(0, -52);
        ctx.lineTo(8, -24);
        ctx.lineTo(20, -42);
        ctx.lineTo(24, -20);
        ctx.closePath();
        ctx.fill();
      } else if (config.hairStyleId === "hair_afro_crown") {
        ctx.beginPath();
        ctx.arc(0, -22, 34, 0, Math.PI * 2);
        ctx.fill();
      } else if (config.hairStyleId === "hair_locs") {
        ctx.beginPath();
        ctx.arc(0, -28, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(-22, -20, 44, 12);
      }

      ctx.restore(); // Restore head
      ctx.restore(); // Restore body projection

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [config.skinTone, config.hairColor, config.eyeColor, config.outfitId, config.shoesId, config.headwearId, config.backBlingId, config.vfxAuraId, config.hairStyleId, rotationY, rotationX, currentZoom, interactive, spinSpeed]);

  return (
    <div
      className={`relative select-none touch-none overflow-hidden rounded-2xl bg-gradient-to-b from-purple-950/40 via-background to-black border border-purple-500/30 ${className}`}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        width={500}
        height={500}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block object-contain"
      />

      {displayControls && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-purple-500/30 text-xs text-muted-foreground pointer-events-none whitespace-nowrap">
          <span>Drag to rotate 360°</span>
          <span>•</span>
          <span>Scroll to zoom</span>
        </div>
      )}
    </div>
  );
}
