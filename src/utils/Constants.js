export const LANE_WIDTH = 3.4;
export const LANE_COUNT = 4;
export const LANE_X = [
  -1.5 * LANE_WIDTH,
  -0.5 * LANE_WIDTH,
  0.5 * LANE_WIDTH,
  1.5 * LANE_WIDTH,
];
export const ROAD_WIDTH = LANE_WIDTH * LANE_COUNT + 1.2; // drivable 13.6 + curbs
export const ROAD_HALF = ROAD_WIDTH / 2;

export const SEGMENT_LENGTH = 40;
export const SEGMENT_COUNT = 8;
export const WORLD_SPAN = SEGMENT_LENGTH * SEGMENT_COUNT;
export const RECYCLE_Z = 45; // past both cameras before recycling

export const BASE_SPEED = 34; // world units / second
export const WHEEL_RADIUS = 0.42;
export const DEFAULT_CAR_COLOR = 0xff2a4d;
export const P1_COLOR = 0xff2a4d; // Red
export const P2_COLOR = 0x00d4ff; // Cyan-Blue

export const THEMES = {
  day: {
    skyTop: '#2f7fd8', skyHorizon: '#bfe6ff', stars: false,
    ambient: 0xffffff, ambientI: 0.5,
    sun: 0xfff1d6, sunI: 2.4, envI: 0.95,
    grass: 0x7ad07a, road: 0xffffff,
    windows: 0, lamp: 0.2, glow: 0, headlights: false,
  },
  night: {
    skyTop: '#02030c', skyHorizon: '#18234f', stars: true,
    ambient: 0x6a7cff, ambientI: 0.45,
    sun: 0x8fa8ff, sunI: 0.7, envI: 0.14,
    grass: 0x34664a, road: 0x9298b8,
    windows: 1.6, lamp: 4, glow: 0.55, headlights: true,
  },
};

// ---- Phase 3: driving model ----
export const MIN_SPEED = 18;      // full brake floor
export const CRUISE_SPEED = BASE_SPEED;
export const MAX_SPEED = 56;      // holding accelerate
export const NITRO_SPEED = 80;
export const ACCEL = 22;          // units/s^2
export const BRAKE_DECEL = 45;
export const COAST_DECEL = 18;    // slowing back to cruise
export const NITRO_ACCEL = 60;
export const NITRO_MAX = 100;
export const NITRO_DRAIN = 35;    // per second while active
export const NITRO_RECHARGE = 8;  // per second while idle
export const NITRO_MIN_START = 15;
export const KMH_FACTOR = 3.6;    // 1 unit = 1 metre

// ---- Phase 4/5: gameplay rules ----
export const LIVES_MAX = 3;
export const INVINCIBLE_TIME = 2.2;   // seconds of ghost mode after a foul
export const LEVEL_KM = 1;            // one level per kilometre
export const LEVEL_BONUS = 500;
export const CRUISE_PER_LEVEL = 1.5;  // cruise speed increase per level
export const MAX_CRUISE = 48;
export const CRASH_SPEED = 12;        // speed cap right after hitting a car
export const PLAYER_HW = 0.85;        // player hitbox half width / half length
export const PLAYER_HL = 2.0;
export const RAIL_X = (LANE_WIDTH * LANE_COUNT) / 2 - 0.1;       // hard limit of the car centre
export const RAIL_HIT_X = RAIL_X - 0.15;                           // beyond this the car scrapes the railing = foul
export const STEER_LIMIT = RAIL_X + 0.2;
export const LAT_SPEED = 11;          // free-steering lateral speed (units/s)
export const HOLD_FREE = 0.22;        // keyboard hold time before free steering starts
export const LAT_K = 95;              // snappy lane tracking so the view never feels paused
export const LAT_DAMP = 1;
export const LAT_MAX_A = 90;

/** Player sideways physics. Returns [x, vx]. */
export function stepLateral(x, vx, target, dt, maxA = LAT_MAX_A) {
  const damp = 2 * Math.sqrt(LAT_K) * LAT_DAMP;
  let ax = (target - x) * LAT_K - vx * damp;
  if (ax > maxA) ax = maxA;
  else if (ax < -maxA) ax = -maxA;
  vx += ax * dt;
  x += vx * dt;
  return [x, vx];
}

// Traffic lane changes are heavier: limited grip, so the car steers across instead of darting.
export const TRAFFIC_LAT_K = 8;
export const TRAFFIC_LAT_DAMP = 0.92;
export const TRAFFIC_LAT_MAX_A = 6.5;
export const TRAFFIC_LAT_MAX_V = 2.35;

/** Heavier sideways physics used only by traffic. Returns [x, vx]. */
export function stepTrafficLateral(x, vx, target, dt) {
  const damp = 2 * Math.sqrt(TRAFFIC_LAT_K) * TRAFFIC_LAT_DAMP;
  let ax = (target - x) * TRAFFIC_LAT_K - vx * damp;
  if (ax > TRAFFIC_LAT_MAX_A) ax = TRAFFIC_LAT_MAX_A;
  else if (ax < -TRAFFIC_LAT_MAX_A) ax = -TRAFFIC_LAT_MAX_A;
  vx += ax * dt;
  if (vx > TRAFFIC_LAT_MAX_V) vx = TRAFFIC_LAT_MAX_V;
  else if (vx < -TRAFFIC_LAT_MAX_V) vx = -TRAFFIC_LAT_MAX_V;
  x += vx * dt;
  return [x, vx];
}
export const TRAFFIC_POOL = 18;
