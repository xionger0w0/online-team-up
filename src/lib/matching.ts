import { MatchResult, Profile, SleepSlot, WakeSlot } from "./types";

const sleepRank: Record<SleepSlot, number | null> = {
  "22:30前": 0,
  "22:30–00:00": 1,
  "00:00–01:30": 2,
  "01:30后": 3,
  "不固定": null,
};

const wakeRank: Record<WakeSlot, number | null> = {
  "07:00前": 0,
  "07:00–08:30": 1,
  "08:30–10:00": 2,
  "10:00后": 3,
  "不固定": null,
};

function slotScore(a: number | null, b: number | null) {
  if (a === null || b === null) return 72;
  return Math.max(30, 100 - Math.abs(a - b) * 24);
}

function scheduleScore(a: Profile, b: Profile) {
  const values = [
    slotScore(sleepRank[a.weekdaySleep], sleepRank[b.weekdaySleep]),
    slotScore(sleepRank[a.weekendSleep], sleepRank[b.weekendSleep]),
    slotScore(wakeRank[a.weekdayWake], wakeRank[b.weekdayWake]),
    slotScore(wakeRank[a.weekendWake], wakeRank[b.weekendWake]),
  ];
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function hobbyScore(a: Profile, b: Profile) {
  const mine = new Set(a.interests);
  const theirs = new Set(b.interests);
  const overlap = [...mine].filter((item) => theirs.has(item)).length;
  const union = new Set([...mine, ...theirs]).size || 1;
  return Math.round(45 + (overlap / union) * 55);
}

export function calculateMatch(me: Profile, candidate: Profile): MatchResult | null {
  if (me.gender !== candidate.gender || me.building !== candidate.building) return null;
  const schedule = scheduleScore(me, candidate);
  const hobbies = hobbyScore(me, candidate);
  const orientation =
    me.orientation === "都可以" || candidate.orientation === "都可以"
      ? 88
      : me.orientation === candidate.orientation
        ? 100
        : 45;
  const total = Math.round(schedule * 0.55 + hobbies * 0.4 + orientation * 0.05);
  const shared = me.interests.filter((item) => candidate.interests.includes(item));
  const reasons = [
    schedule >= 82 ? "作息时间比较接近" : "作息时间有一些不同",
    shared.length ? `共同兴趣：${shared.slice(0, 2).join("、")}` : "兴趣爱好暂时没有明显重合",
    orientation >= 88 ? "采光期待比较接近" : "采光期待不完全相同",
  ];
  return {
    profile: candidate,
    total,
    schedule,
    hobbies,
    orientation,
    reasons,
    caution: schedule < 65 ? "周末作息差异较大，可以根据需要进一步了解" : undefined,
  };
}

export function rankMatches(me: Profile, candidates: Profile[]) {
  return candidates
    .map((candidate) => calculateMatch(me, candidate))
    .filter((result): result is MatchResult => Boolean(result))
    .sort((a, b) => b.total - a.total);
}
