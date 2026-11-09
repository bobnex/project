import { resultFor, standings, teamOf, teamScore, type Match } from "./game-rules";

export type CardStatus = "victory" | "draw" | "defeat";

export interface BattleCardData {
  status: CardStatus;
  mode: Match["mode"];
  modeLabel: string;
  playerName: string;
  score: number;
  correct: number;
  total: number;
  accuracy: number;
  headline: string;
  detail: string;
  date: string;
  seed: number;
}

const MODE_LABELS: Record<string, string> = { classic: "1v1 Battle", rush: "50 Players Rush", duo: "2v2 Duo" };

export function buildBattleCardData(m: Match, uid: string, seed = 0, now = Date.now()): BattleCardData {
  const r = resultFor(m, uid);
  const status: CardStatus = r === "win" ? "victory" : r === "draw" ? "draw" : "defeat";
  const me = m.players[uid];
  const total = m.questionIds.length;
  const correct = me?.correct ?? 0;
  const order = standings(m);
  let detail: string;
  if (m.mode === "rush") detail = `Placed #${order.indexOf(uid) + 1} of ${m.playerIds.length}`;
  else if (m.mode === "duo") {
    const t = teamOf(m, "B").includes(uid) ? "B" : "A";
    const o = t === "A" ? "B" : "A";
    detail = `Team score ${teamScore(m, t)} – ${teamScore(m, o)}`;
  } else {
    const opp = m.playerIds.find((id) => id !== uid);
    detail = opp ? `vs ${m.players[opp].name} (${m.players[opp].score})` : "Battle complete";
  }
  return {
    status,
    mode: m.mode,
    modeLabel: MODE_LABELS[m.mode] ?? "Battle",
    playerName: me?.name ?? "Player",
    score: me?.score ?? 0,
    correct,
    total,
    accuracy: total ? Math.round((correct / total) * 100) : 0,
    headline: status === "victory" ? "VICTORY" : status === "draw" ? "DRAW" : "DEFEAT",
    detail,
    date: new Date(now).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }),
    seed,
  };
}

export function buildCardSummaryText(c: BattleCardData): string {
  const lead = c.status === "victory" ? "🏆 I won" : c.status === "draw" ? "🤝 I drew" : "⚔️ I fought";
  return `${lead} a ${c.modeLabel} on Favoje Battle! Score ${c.score} · ${c.correct}/${c.total} correct (${c.accuracy}%) · ${c.detail}. Can you beat me?`;
}

export function getBattleCardFileName(c: BattleCardData): string {
  const name = c.playerName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "player";
  return `favoje-${c.status}-${name}.png`;
}

/** Resolve a theme token (e.g. "--primary") to a color the canvas understands. */
function token(el: HTMLElement, name: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(${name})`;
  el.appendChild(probe);
  const v = getComputedStyle(probe).color;
  probe.remove();
  return v;
}

function rand(seed: number) {
  let s = (seed * 9301 + 49297) % 233280 || 1;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}

export function renderBattleCardPreview(canvas: HTMLCanvasElement, c: BattleCardData) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  const host = canvas.parentElement ?? document.body;
  const bg = token(host, "--background");
  const fg = token(host, "--foreground");
  const muted = token(host, "--muted-foreground");
  const card = token(host, "--card");
  const primary = token(host, "--primary");
  const accent = c.status === "victory" ? token(host, "--warning") || primary : c.status === "draw" ? primary : token(host, "--destructive");
  const display = getComputedStyle(document.body).getPropertyValue("--font-display") || "sans-serif";

  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Decorative glow orbs — position varies with seed for "Regenerate".
  const rnd = rand(c.seed + 1);
  for (let i = 0; i < 3; i++) {
    const x = rnd() * W, y = rnd() * H * 0.7, r = 300 + rnd() * 400;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, i % 2 ? accent : primary);
    g.addColorStop(1, "transparent");
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = "center";
  ctx.fillStyle = muted;
  ctx.font = `700 40px ${display}`;
  ctx.fillText("FAVOJE BATTLE", W / 2, 140);
  ctx.font = `600 36px ${display}`;
  ctx.fillText(c.modeLabel.toUpperCase(), W / 2, 200);

  ctx.fillStyle = accent;
  ctx.font = `800 180px ${display}`;
  ctx.fillText(c.headline, W / 2, 440);

  ctx.fillStyle = fg;
  ctx.font = `700 64px ${display}`;
  ctx.fillText(c.playerName.slice(0, 22), W / 2, 560);
  ctx.fillStyle = muted;
  ctx.font = `500 40px ${display}`;
  ctx.fillText(c.detail.slice(0, 40), W / 2, 630);

  // Stat tiles
  const stats: [string, string][] = [["SCORE", String(c.score)], ["CORRECT", `${c.correct}/${c.total}`], ["ACCURACY", `${c.accuracy}%`]];
  const tw = 320, th = 260, gap = 40, sx = (W - (tw * 3 + gap * 2)) / 2, sy = 760;
  stats.forEach(([label, value], i) => {
    const x = sx + i * (tw + gap);
    ctx.fillStyle = card;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.roundRect(x, sy, tw, th, 36);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = fg;
    ctx.font = `800 96px ${display}`;
    ctx.fillText(value, x + tw / 2, sy + 145);
    ctx.fillStyle = muted;
    ctx.font = `700 30px ${display}`;
    ctx.fillText(label, x + tw / 2, sy + 210);
  });

  ctx.fillStyle = fg;
  ctx.font = `700 52px ${display}`;
  ctx.fillText("Can you beat me?", W / 2, 1250);
  ctx.fillStyle = muted;
  ctx.font = `500 34px ${display}`;
  ctx.fillText(c.date, W / 2, 1400);
}
