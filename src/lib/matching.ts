import { MatchResult, Profile, SleepSlot } from "./types";

const sleepRank: Record<SleepSlot, number | null> = {
  "22:30前": 0,
  "22:30–00:00": 1,
  "00:00–01:30": 2,
  "01:30后": 3,
  "不固定": null,
};

type MatchableProfile = Pick<Profile, "id" | "gender" | "building" | "major" | "smoking" | "weekdaySleep" | "interests" | "intro">;

const interestAliases: Record<string, string[]> = {
  羽毛球: ["羽毛球", "羽球", "badminton"],
  跑步: ["跑步", "晨跑", "夜跑", "running"],
  篮球: ["篮球", "打球", "nba"],
  足球: ["足球", "英超", "欧冠"],
  健身: ["健身", "撸铁", "力量训练", "gym"],
  游泳: ["游泳", "泳池"],
  骑行: ["骑行", "骑车", "自行车"],
  音乐: ["音乐", "听歌", "唱歌", "k歌", "livehouse", "演唱会"],
  乐器: ["乐器", "吉他", "钢琴", "小提琴", "架子鼓"],
  摄影: ["摄影", "拍照", "相机"],
  电影: ["电影", "影迷", "看电影"],
  追剧: ["追剧", "电视剧", "韩剧", "美剧"],
  动漫: ["动漫", "二次元", "番剧", "漫画"],
  阅读: ["阅读", "读书", "看书", "小说"],
  游戏: ["游戏", "电竞", "开黑", "steam", "手游", "switch"],
  桌游: ["桌游", "剧本杀", "狼人杀"],
  旅行: ["旅行", "旅游", "出游"],
  美食: ["美食", "探店", "烘焙", "做饭"],
  编程: ["编程", "代码", "coding", "programming"],
  舞蹈: ["舞蹈", "跳舞"],
  宠物: ["宠物", "养猫", "养狗", "撸猫", "猫猫", "狗狗"],
};

function slotScore(a: number | null, b: number | null) {
  if (a === null || b === null) return 70;
  return [100, 82, 58, 35][Math.min(3, Math.abs(a - b))];
}

function scheduleScore(a: MatchableProfile, b: MatchableProfile) {
  return slotScore(sleepRank[a.weekdaySleep], sleepRank[b.weekdaySleep]);
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("zh-CN").replace(/\s+/g, "");
}

function extractInterestKeywords(profile: MatchableProfile, context = "") {
  const keywords = new Set<string>();
  const text = normalize([...profile.interests, profile.intro, context].join(" "));
  for (const interest of profile.interests) {
    const normalized = normalize(interest);
    if (normalized.length >= 2 && normalized.length <= 16) keywords.add(normalized);
  }
  for (const [label, aliases] of Object.entries(interestAliases)) {
    if (aliases.some((alias) => text.includes(normalize(alias)))) keywords.add(label);
  }
  return keywords;
}

function interestScore(a: MatchableProfile, b: MatchableProfile, context = "") {
  const mine = extractInterestKeywords(a);
  const theirs = extractInterestKeywords(b, context);
  const overlap = [...mine].filter((item) => theirs.has(item)).length;
  if (!mine.size && !theirs.size) return { score: 60, shared: [] as string[] };
  if (!mine.size || !theirs.size) return { score: 55, shared: [] as string[] };
  const union = new Set([...mine, ...theirs]).size || 1;
  if (!overlap) return { score: 35, shared: [] as string[] };
  const coverage = overlap / Math.min(mine.size, theirs.size);
  const jaccard = overlap / union;
  return {
    score: Math.min(100, Math.round(40 + coverage * 45 + jaccard * 15)),
    shared: [...mine].filter((item) => theirs.has(item)).slice(0, 4),
  };
}

function buildingHint(a: MatchableProfile, b: MatchableProfile) {
  if (a.building === "undecided" || b.building === "undecided") return undefined;
  return a.building === b.building
    ? `同楼栋：${a.building} 号楼`
    : `不同楼栋：你在 ${a.building} 号楼，对方在 ${b.building} 号楼`;
}

export function calculateMatch(me: MatchableProfile, candidate: MatchableProfile, context = ""): MatchResult | null {
  if (me.id === candidate.id) return null;
  const schedule = scheduleScore(me, candidate);
  const interestResult = interestScore(me, candidate, context);
  const smoking = me.smoking === "未选择" || candidate.smoking === "未选择" ? 65 : me.smoking === candidate.smoking ? 100 : 25;
  const major = me.major && candidate.major && me.major === candidate.major ? 100 : 55;
  const total = Math.round(schedule * 0.4 + interestResult.score * 0.4 + smoking * 0.15 + major * 0.05);
  const sameGender = me.gender === candidate.gender;
  const reasons = [
    schedule >= 82 ? "一般作息比较接近" : schedule >= 58 ? "一般作息有一些差异" : "一般作息差异较明显",
    interestResult.shared.length ? `共同兴趣：${interestResult.shared.join("、")}` : "暂未提取到明显的共同兴趣",
    smoking >= 100 ? "吸烟习惯一致" : smoking <= 25 ? "吸烟习惯不同，建议提前沟通" : "吸烟信息尚不完整",
    major >= 100 ? "同专业，后续分到同楼栋的可能性相对更高" : "专业不同，不计入硬性筛选",
  ];
  return {
    profile: candidate as Profile,
    total,
    schedule,
    interests: interestResult.score,
    smoking,
    major,
    sharedInterests: interestResult.shared,
    sameGender,
    buildingHint: buildingHint(me, candidate),
    reasons,
    caution: !sameGender
      ? "不同性别无法组队选寝；该匹配度仅作聊天和交友参考"
      : schedule < 58 || smoking < 50
        ? "存在需要提前沟通的生活习惯差异"
        : undefined,
  };
}

export function rankMatches(me: MatchableProfile, candidates: MatchableProfile[]) {
  return candidates
    .map((candidate) => calculateMatch(me, candidate))
    .filter((result): result is MatchResult => Boolean(result))
    .sort((a, b) => b.total - a.total);
}
