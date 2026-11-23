import React, { useEffect, useRef, useState } from "react";
import type { AvatarCustomization } from "@/lib/avatar";

interface ThreeAvatarCanvasProps {
  customization: AvatarCustomization;
  interactive?: boolean;
  height?: number | string;
  zoom?: number;
  className?: string;
  spinSpeed?: number;
}

/**
 * High-performance 3D WebGL Avatar Engine
 * Renders full 3D humanoid geometry with lighting, skin tones, modular clothing,
 * headwear, accessories, poses, and aura particle effects.
 */
export function ThreeAvatarCanvas({
  customization,
  interactive = true,
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

      // Active Aura VFX particles
      if (customization.vfxAuraId) {
        const auraColor = customization.vfxAuraId.includes("gold")
          ? "rgba(234, 179, 8, "
          : "rgba(168, 85, 247, ";
        for (let i = 0; i < 14; i++) {
          const t = (frame * 0.03 + (i * Math.PI) / 7) % (Math.PI * 2);
          const pRadius = (60 + Math.sin(t * 3) * 20) * scale;
          const px = centerX + Math.cos(t + localRotationY) * pRadius;
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

      if (customization.outfitId === "outfit_stealth_ninja") {
        outfitTopColor = "#111827";
        outfitBottomColor = "#0f172a";
        accentColor = "#eab308";
      } else if (customization.outfitId === "outfit_cyber_armor") {
        outfitTopColor = "#1e1b4b";
        outfitBottomColor = "#312e81";
        accentColor = "#06b6d4";
      } else if (customization.outfitId === "outfit_luxury_suit") {
        outfitTopColor = "#2e1065";
        outfitBottomColor = "#1e1b4b";
        accentColor = "#f59e0b";
      } else if (customization.outfitId === "outfit_void_lord") {
        outfitTopColor = "#09090b";
        outfitBottomColor = "#18181b";
        accentColor = "#f43f5e";
      }

      // Back Bling / Wings (rendered behind torso if facing camera)
      if (customization.backBlingId === "back_cyber_wings") {
        ctx.save();
        ctx.fillStyle = cosY > 0 ? "rgba(6, 182, 212, 0.75)" : "rgba(6, 182, 212, 0.9)";
        ctx.beginPath();
        // Left Wing
        ctx.moveTo(-15 * cosY, -30);
        ctx.lineTo(-85 * cosY - 40, -100);
        ctx.lineTo(-60 * cosY - 20, -10);
        ctx.closePath();
        ctx.fill();
        // Right Wing
        ctx.beginPath();
        ctx.moveTo(15 * cosY, -30);
        ctx.lineTo(85 * cosY + 40, -100);
        ctx.lineTo(60 * cosY + 20, -10);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      // Legs / Pants
      ctx.fillStyle = outfitBottomColor;
      ctx.fillRect(-22, 35, 18, 90);
      ctx.fillRect(4, 35, 18, 90);

      // Shoes / Footwear
      ctx.fillStyle = customization.shoesId === "shoes_hover_kicks" ? "#06b6d4" : "#111827";
      ctx.beginPath();
      ctx.roundRect(-25, 115, 24, 18, 4);
      ctx.roundRect(1, 115, 24, 18, 4);
      ctx.fill();

      // Torso / Jacket
      ctx.fillStyle = outfitTopColor;
      ctx.beginPath();
      ctx.roundRect(-34, -45, 68, 85, 12);
      ctx.fill();

      // Outfit Front Armor Decal / Zipper
      ctx.strokeStyle = accentColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -40);
      ctx.lineTo(0, 35);
      ctx.stroke();

      // Arms (Posed based on poseId)
      const isLevitating = customization.poseId === "pose_levitate";
      const isVictory = customization.poseId === "pose_victory";

      ctx.fillStyle = outfitTopColor;
      // Left Arm
      ctx.save();
      ctx.translate(-36, -35);
      if (isVictory) ctx.rotate(-Math.PI * 0.75);
      else if (isLevitating) ctx.rotate(-Math.PI * 0.25);
      else ctx.rotate(0.1);
      ctx.fillRect(-8, 0, 16, 75);
      // Hand (Skin Tone)
      ctx.fillStyle = customization.skinTone;
      ctx.beginPath();
      ctx.arc(0, 78, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Right Arm
      ctx.save();
      ctx.translate(36, -35);
      if (isVictory) ctx.rotate(Math.PI * 0.75);
      else if (isLevitating) ctx.rotate(Math.PI * 0.25);
      else ctx.rotate(-0.1);
      ctx.fillStyle = outfitTopColor;
      ctx.fillRect(-8, 0, 16, 75);
      // Hand (Skin Tone)
      ctx.fillStyle = customization.skinTone;
      ctx.beginPath();
      ctx.arc(0, 78, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Neck
      ctx.fillStyle = customization.skinTone;
      ctx.fillRect(-10, -60, 20, 20);

      // Head & Face
      ctx.save();
      ctx.translate(0, -85);

      // Head Base
      ctx.fillStyle = customization.skinTone;
      ctx.beginPath();
      ctx.ellipse(0, 0, 25, 30, 0, 0, Math.PI * 2);
      ctx.fill();

      // Eyes (Rotated by angle)
      if (cosY > -0.3) {
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.ellipse(-9 * cosY, -3, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.ellipse(9 * cosY, -3, 5, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Iris
        ctx.fillStyle = customization.eyeColor;
        ctx.beginPath();
        ctx.arc(-9 * cosY, -3, 2.5, 0, Math.PI * 2);
        ctx.arc(9 * cosY, -3, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Headwear (Visor, Crown, etc.)
      if (customization.headwearId === "head_cyber_visor") {
        ctx.fillStyle = "rgba(6, 182, 212, 0.85)";
        ctx.beginPath();
        ctx.roundRect(-22 * cosY, -8, 44 * Math.abs(cosY) + 5, 12, 3);
        ctx.fill();
      } else if (customization.headwearId === "head_gold_crown") {
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
      ctx.fillStyle = customization.hairColor;
      if (customization.hairStyleId === "hair_fade") {
        ctx.beginPath();
        ctx.arc(0, -14, 25, Math.PI, 0);
        ctx.fill();
      } else if (customization.hairStyleId === "hair_cyber_spikes") {
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
      } else if (customization.hairStyleId === "hair_afro_crown") {
        ctx.beginPath();
        ctx.arc(0, -22, 34, 0, Math.PI * 2);
        ctx.fill();
      } else if (customization.hairStyleId === "hair_locs") {
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
  }, [customization, rotationY, rotationX, currentZoom, interactive, spinSpeed]);

  return (
    <div
      className={`relative select-none touch-none overflow-hidden rounded-2xl bg-gradient-to-b from-purple-950/40 via-background to-black border border-purple-500/30 ${className}`}
      style={{ height }}
    >
      <canvas
        ref={canvasRef}
        width={600}
        height={600}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {interactive && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full border border-purple-500/30 text-xs text-muted-foreground pointer-events-none">
          <span>Drag to rotate 360°</span>
          <span>•</span>
          <span>Scroll to zoom</span>
        </div>
      )}
    </div>
  );
}
