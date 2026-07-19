import { Profile, Team } from "./types";

export const majors = [
  "国际商务", "财务管理", "金融科技", "大数据管理与应用", "管理科学", "经济学",
  "国际经济与贸易", "国际事务与国际关系", "传播学", "英语", "计算机科学与技术",
  "数学与应用数学", "电气类", "统计学", "建筑学", "化学",
];

export const interestOptions = [
  "羽毛球", "跑步", "篮球", "健身", "音乐", "乐器", "摄影", "电影",
  "追剧", "动漫", "阅读", "游戏", "桌游", "旅行", "美食", "编程",
];

export const currentUser: Profile = {
  id: "me",
  nickname: "青禾",
  avatar: "🌿",
  gender: "female",
  building: "13",
  major: "国际商务",
  weekdaySleep: "22:30–00:00",
  weekendSleep: "00:00–01:30",
  weekdayWake: "07:00–08:30",
  weekendWake: "08:30–10:00",
  orientation: "阳面",
  interests: ["羽毛球", "摄影", "电影", "旅行"],
  intro: "希望找到可以彼此尊重、偶尔一起吃饭逛校园的室友。",
  verified: false,
  teamStatus: "open",
  contact: { type: "微信", value: "unnc-demo" },
};

export const profiles: Profile[] = [
  { id: "p1", nickname: "小满", avatar: "☁️", gender: "female", building: "13", major: "传播学", weekdaySleep: "22:30–00:00", weekendSleep: "00:00–01:30", weekdayWake: "07:00–08:30", weekendWake: "08:30–10:00", orientation: "阳面", interests: ["摄影", "电影", "羽毛球", "音乐"], intro: "INFJ，喜欢拍照和散步，希望寝室是能安心休息的小空间。", verified: false, teamStatus: "none", contact: { type: "微信", value: "xiaoman-demo" } },
  { id: "p2", nickname: "北北", avatar: "🧸", gender: "female", building: "13", major: "国际商务", weekdaySleep: "00:00–01:30", weekendSleep: "00:00–01:30", weekdayWake: "07:00–08:30", weekendWake: "10:00后", orientation: "都可以", interests: ["旅行", "美食", "追剧", "桌游"], intro: "好相处，尊重彼此的空间，也很期待一起探索宁波。", verified: false, teamStatus: "open", contact: { type: "QQ", value: "20260001" } },
  { id: "p3", nickname: "Lumi", avatar: "🌙", gender: "female", building: "13", major: "经济学", weekdaySleep: "22:30–00:00", weekendSleep: "22:30–00:00", weekdayWake: "07:00前", weekendWake: "07:00–08:30", orientation: "阴面", interests: ["阅读", "跑步", "音乐", "电影"], intro: "慢热但真诚，喜欢晨跑和读书。希望有事直接沟通。", verified: false, teamStatus: "none", contact: { type: "微信", value: "lumi-demo" } },
  { id: "p4", nickname: "阿榆", avatar: "🎧", gender: "female", building: "13", major: "英语", weekdaySleep: "01:30后", weekendSleep: "01:30后", weekdayWake: "08:30–10:00", weekendWake: "10:00后", orientation: "阳面", interests: ["音乐", "游戏", "动漫", "美食"], intro: "喜欢音乐和游戏，作息偏晚，希望提前把彼此在意的事说清楚。", verified: false, teamStatus: "none", contact: { type: "QQ", value: "20260002" } },
  { id: "p5", nickname: "屿川", avatar: "🏀", gender: "male", building: "15", major: "计算机科学与技术", weekdaySleep: "00:00–01:30", weekendSleep: "01:30后", weekdayWake: "07:00–08:30", weekendWake: "10:00后", orientation: "都可以", interests: ["篮球", "游戏", "编程"], intro: "欢迎一起打球。", verified: false, teamStatus: "none", contact: { type: "微信", value: "yuchuan-demo" } },
];

export const teams: Team[] = [
  { id: "t1", name: "13号楼·向阳小队", building: "13", gender: "female", members: 2, capacity: 4, schedule: "整体正常作息", orientation: "阳面", interests: ["摄影", "电影", "旅行"], summary: "我们整体作息适中，喜欢摄影、电影和旅行，希望找到尊重彼此空间、愿意坦诚沟通的新成员。", open: true },
  { id: "t2", name: "早睡早起搭子", building: "13", gender: "female", members: 3, capacity: 4, schedule: "整体偏早", orientation: "都可以", interests: ["跑步", "阅读", "羽毛球"], summary: "小队偏爱规律作息，兴趣集中在运动与阅读。朝向随缘，更看重相处舒服。", open: true },
  { id: "t3", name: "23号楼探索队", building: "23", gender: "female", members: 6, capacity: 8, schedule: "作息较灵活", orientation: "阳面", interests: ["美食", "桌游", "音乐"], summary: "我们喜欢轻松热闹的相处方式，也尊重每个人的独处时间，正在寻找两位新成员。", open: true },
];

