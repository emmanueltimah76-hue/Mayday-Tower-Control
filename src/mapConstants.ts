// One physical scale for server motion, route geometry and radar distances.
export const NM_PER_MAP_UNIT = 0.004;
export const FEET_PER_NM = 6076.12;
export const SECONDS_PER_HOUR = 3600;
export const feetToUnits = (feet:number) => feet / FEET_PER_NM / NM_PER_MAP_UNIT;
export const knotsToUnitsPerSecond = (knots:number) => knots / SECONDS_PER_HOUR / NM_PER_MAP_UNIT;
export const MOTION_STEP_SECONDS = 0.1;
export const MAX_FLASHING_TRACKS = 4;
export const ALERT_REPEAT_SECONDS = 20;
// Import calibration only: original public runway schematics used different zooms.
const sourceScale={easy:.0044998,medium:.0038833,hard:.0055768,expert:.009906};
export function normalizeMapPoint(point:[number,number],difficulty:keyof typeof sourceScale):[number,number]{const f=sourceScale[difficulty]/NM_PER_MAP_UNIT;return [350+(point[0]-350)*f,210+(point[1]-210)*f];}

export const MAP_VIEW={x:-570,y:-620,w:1940,h:1640};
