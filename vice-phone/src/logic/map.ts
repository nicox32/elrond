import { METERS_PER_UNIT, NODES, type Pt, ROADS } from '../data/map.ts';

const dist = (a: Pt, b: Pt) => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Carrefour le plus proche d’un point. */
export function nearestNode(p: Pt): string {
  let best = '';
  let d = Infinity;
  for (const [id, n] of Object.entries(NODES)) {
    const x = dist(p, n);
    if (x < d) {
      d = x;
      best = id;
    }
  }
  return best;
}

/** Plus court chemin entre deux carrefours (Dijkstra sur le réseau routier). */
export function shortestPath(from: string, to: string): string[] {
  const adj: Record<string, { to: string; w: number }[]> = {};
  for (const r of ROADS) {
    const w = dist(NODES[r.a], NODES[r.b]) * (r.kind === 'highway' ? 0.7 : 1); // la route côtière est plus rapide
    (adj[r.a] ??= []).push({ to: r.b, w });
    (adj[r.b] ??= []).push({ to: r.a, w });
  }
  const best: Record<string, number> = { [from]: 0 };
  const prev: Record<string, string> = {};
  const todo = new Set(Object.keys(NODES));
  while (todo.size) {
    let u = '';
    let du = Infinity;
    for (const n of todo) {
      if ((best[n] ?? Infinity) < du) {
        du = best[n];
        u = n;
      }
    }
    if (!u || u === to) break;
    todo.delete(u);
    for (const e of adj[u] ?? []) {
      const alt = du + e.w;
      if (alt < (best[e.to] ?? Infinity)) {
        best[e.to] = alt;
        prev[e.to] = u;
      }
    }
  }
  if (from !== to && !prev[to]) return [];
  const path = [to];
  while (path[0] !== from) path.unshift(prev[path[0]]);
  return path;
}

export type Route = { points: Pt[]; meters: number; minutes: number };

/** Itinéraire GPS entre deux points : on rejoint la route, on la suit, puis on rejoint l’arrivée. */
export function route(from: Pt, to: Pt): Route {
  const a = nearestNode(from);
  const b = nearestNode(to);
  const nodes = shortestPath(a, b).map((n) => NODES[n]);
  const points: Pt[] = [from, ...nodes, to];
  let units = 0;
  for (let i = 1; i < points.length; i++) units += dist(points[i - 1], points[i]);
  const meters = Math.round(units * METERS_PER_UNIT);
  // 40 km/h de moyenne en ville, au moins 1 minute.
  const minutes = Math.max(1, Math.round(meters / ((40 * 1000) / 60)));
  return { points, meters, minutes };
}

export function formatDistance(m: number): string {
  return m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}
