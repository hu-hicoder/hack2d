import { NormalizedLandmarkList, NormalizedLandmark } from "@mediapipe/hands";

// Finger Type
export const FingerTypes = {
  // Numbers
  ONE: "one",
  TWO: "two",
  THREE: "three",
  FOUR: "four",
  FIVE: "five",
  SIX: "six",
  SEVEN: "seven",
  EIGHT: "eight",
  NINE: "nine",
  // others
  REST: "rest",
  REPEAT: "repeat",
} as const;
export type FingerType = typeof FingerTypes[keyof typeof FingerTypes];
export const AllFingerType = Object.values(FingerTypes);

export const getPitch = (fingerType: FingerType): number | null => {
  switch (fingerType) {
    case FingerTypes.ONE:
      return 0;
    case FingerTypes.TWO:
      return 2;
    case FingerTypes.THREE:
      return 4;
    case FingerTypes.FOUR:
      return 5;
    case FingerTypes.FIVE:
      return 7;
    case FingerTypes.SIX:
      return 9;
    case FingerTypes.SEVEN:
      return 11;
    case FingerTypes.EIGHT:
      return 12;
    case FingerTypes.NINE:
      return 14;
    case FingerTypes.REST:
    case FingerTypes.REPEAT:
      return null;
  }
};

export function calcAngle(
  p0: NormalizedLandmark,
  p1: NormalizedLandmark,
  p2: NormalizedLandmark
) {
  const a1 = p1.x - p0.x;
  const a2 = p1.y - p0.y;
  const b1 = p2.x - p1.x;
  const b2 = p2.y - p1.y;
  const angle =
    (Math.acos(
      (a1 * b1 + a2 * b2) / Math.sqrt((a1 * a1 + a2 * a2) * (b1 * b1 + b2 * b2))
    ) *
      180) /
    Math.PI;
  return angle;
}

function fingerAngle(
  p0: NormalizedLandmark,
  p1: NormalizedLandmark,
  p2: NormalizedLandmark,
  p3: NormalizedLandmark,
  p4: NormalizedLandmark
) {
  let result = 0;
  result += calcAngle(p0, p1, p2);
  result += calcAngle(p1, p2, p3);
  result += calcAngle(p2, p3, p4);
  return result;
}

export const detectFingerPose = (
  landmarks: NormalizedLandmarkList
): FingerType => {
  const isThumbOpen =
    fingerAngle(
      landmarks[0],
      landmarks[1],
      landmarks[2],
      landmarks[3],
      landmarks[4]
    ) < 70;
  const isIndexFingerOpen =
    fingerAngle(
      landmarks[0],
      landmarks[5],
      landmarks[6],
      landmarks[7],
      landmarks[8]
    ) < 100;
  const isMiddleFingerOpen =
    fingerAngle(
      landmarks[0],
      landmarks[9],
      landmarks[10],
      landmarks[11],
      landmarks[12]
    ) < 100;
  const isRingFingerOpen =
    fingerAngle(
      landmarks[0],
      landmarks[13],
      landmarks[14],
      landmarks[15],
      landmarks[16]
    ) < 100;
  const isPinkieOpen =
    fingerAngle(
      landmarks[0],
      landmarks[17],
      landmarks[18],
      landmarks[19],
      landmarks[20]
    ) < 100;

  if (
    !isThumbOpen &&
    !isIndexFingerOpen &&
    !isMiddleFingerOpen &&
    !isRingFingerOpen &&
    isPinkieOpen
  ) {
    return FingerTypes.REPEAT;
  } else if (
    isThumbOpen &&
    isIndexFingerOpen &&
    isMiddleFingerOpen &&
    isRingFingerOpen &&
    !isPinkieOpen
  ) {
    return FingerTypes.NINE;
  } else if (
    isThumbOpen &&
    isIndexFingerOpen &&
    isMiddleFingerOpen &&
    !isRingFingerOpen &&
    !isPinkieOpen
  ) {
    return FingerTypes.EIGHT;
  } else if (
    isThumbOpen &&
    isIndexFingerOpen &&
    !isMiddleFingerOpen &&
    !isRingFingerOpen &&
    !isPinkieOpen
  ) {
    return FingerTypes.SEVEN;
  } else if (
    isThumbOpen &&
    !isIndexFingerOpen &&
    !isMiddleFingerOpen &&
    !isRingFingerOpen &&
    !isPinkieOpen
  ) {
    return FingerTypes.SIX;
  } else if (
    isThumbOpen &&
    isIndexFingerOpen &&
    isMiddleFingerOpen &&
    isRingFingerOpen &&
    isPinkieOpen
  ) {
    return FingerTypes.FIVE;
  } else if (
    !isThumbOpen &&
    isIndexFingerOpen &&
    isMiddleFingerOpen &&
    isRingFingerOpen &&
    isPinkieOpen
  ) {
    return FingerTypes.FOUR;
  } else if (
    !isThumbOpen &&
    isIndexFingerOpen &&
    isMiddleFingerOpen &&
    isRingFingerOpen &&
    !isPinkieOpen
  ) {
    return FingerTypes.THREE;
  } else if (
    !isThumbOpen &&
    isIndexFingerOpen &&
    isMiddleFingerOpen &&
    !isRingFingerOpen &&
    !isPinkieOpen
  ) {
    return FingerTypes.TWO;
  } else if (
    !isThumbOpen &&
    isIndexFingerOpen &&
    !isMiddleFingerOpen &&
    !isRingFingerOpen &&
    !isPinkieOpen
  ) {
    return FingerTypes.ONE;
  }
  return FingerTypes.REST;
};
