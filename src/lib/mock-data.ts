import { LobbyComment, LobbyPost, Profile, Team } from "./types";

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
  { id: "t1", name: "13号楼·向阳小队", building: "13", gender: "female", members: 2, capacity: 4, schedule: "休息时间相对稳定", orientation: "阳面", interests: ["摄影", "电影", "旅行"], summary: "我们喜欢摄影、电影和旅行，也希望在尊重彼此空间的同时，遇到愿意慢慢沟通的新同学。", open: true },
  { id: "t2", name: "晨光同行小队", building: "13", gender: "female", members: 3, capacity: 4, schedule: "更喜欢早些休息", orientation: "都可以", interests: ["跑步", "阅读", "羽毛球"], summary: "我们比较喜欢早些休息，也爱运动和阅读。采光随缘，更在意每个人都能住得自在。", open: true },
  { id: "t3", name: "23号楼探索队", building: "23", gender: "female", members: 6, capacity: 8, schedule: "作息较灵活", orientation: "阳面", interests: ["美食", "桌游", "音乐"], summary: "我们喜欢轻松热闹的相处方式，也尊重每个人的独处时间，正在寻找两位新成员。", open: true },
];

export const lobbyPosts: LobbyPost[] = [
  { id: "l1", kind: "chat", body: "大家好，我刚拿到 13 号楼，兴趣爱好是摄影、电影和羽毛球。", createdAt: "2026-07-20T04:18:00.000Z", commentCount: 0, isMine: false, author: profiles[0] },
  { id: "l2", kind: "recruitment", body: "13 号楼四人间，目前有两位女生。作息大多在 00:00 前后，兴趣爱好是摄影、旅行和电影，希望再了解两位同学。", teamId: "t1", createdAt: "2026-07-20T04:22:00.000Z", commentCount: 2, isMine: false, author: profiles[1] },
  { id: "l3", kind: "chat", body: "想了解一下 23 号楼套间的公共区域大概是什么样，有知道的同学可以留言。", createdAt: "2026-07-20T04:27:00.000Z", commentCount: 1, isMine: false, author: profiles[4] },
];

export const lobbyComments: LobbyComment[] = [
  { id: "c1", postId: "l2", body: "你好，我也是 13 号楼，通常 23:30 左右休息，可以先看看彼此的介绍。", createdAt: "2026-07-20T04:25:00.000Z", isMine: true, author: currentUser },
  { id: "c2", postId: "l2", body: "我对采光都可以，兴趣爱好是电影和阅读。", createdAt: "2026-07-20T04:26:00.000Z", isMine: false, author: profiles[2] },
];
