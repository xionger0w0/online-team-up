export type Gender = "female" | "male";
export type Building = "undecided" | "13" | "14" | "15" | "19" | "23";
export type SleepSlot = "22:30前" | "22:30–00:00" | "00:00–01:30" | "01:30后" | "不固定";
export type WakeSlot = "07:00前" | "07:00–08:30" | "08:30–10:00" | "10:00后" | "不固定";
export type Orientation = "阳面" | "阴面" | "都可以";
export type SmokingStatus = "未选择" | "不吸烟" | "吸烟";

export interface Profile {
  id: string;
  nickname: string;
  avatar: string;
  isAdmin?: boolean;
  realName?: string;
  gender: Gender;
  building: Building;
  major: string;
  smoking: SmokingStatus;
  weekdaySleep: SleepSlot;
  weekendSleep: SleepSlot;
  weekdayWake: WakeSlot;
  weekendWake: WakeSlot;
  orientation: Orientation;
  interests: string[];
  intro: string;
  verified: boolean;
  teamStatus: "none" | "open" | "closed";
  contact: { type: "微信" | "QQ"; value: string };
}

export interface MatchResult {
  profile: Profile;
  total: number;
  schedule: number;
  hobbies: number;
  orientation: number;
  reasons: string[];
  caution?: string;
}

export interface Team {
  id: string;
  name: string;
  building: Building;
  gender: Gender;
  members: number;
  capacity: 4 | 8;
  schedule: string;
  orientation: Orientation;
  interests: string[];
  summary: string;
  open: boolean;
}

export type LobbyPostKind = "chat" | "recruitment";

export interface LobbyPost {
  id: string;
  isExample?: boolean;
  kind: LobbyPostKind;
  body: string;
  teamId?: string;
  createdAt: string;
  commentCount: number;
  isMine: boolean;
  author: Pick<Profile, "id" | "nickname" | "avatar" | "isAdmin" | "building" | "gender" | "major" | "smoking" | "weekdaySleep" | "interests" | "intro">;
}

export interface LobbyComment {
  id: string;
  postId: string;
  body: string;
  createdAt: string;
  isMine: boolean;
  author: Pick<Profile, "id" | "nickname" | "avatar" | "isAdmin" | "building" | "gender" | "major">;
}

export type LobbyContactStatus = "pending" | "accepted" | "declined";

export interface LobbyContactLink {
  requestId: string;
  postId: string;
  role: "requester" | "recipient";
  status: LobbyContactStatus;
  createdAt: string;
  other: Pick<Profile, "id" | "nickname" | "avatar" | "isAdmin" | "gender">;
  contact?: Profile["contact"];
  realName?: string;
}

export interface DirectConversation {
  id: string;
  other: Pick<Profile, "id" | "nickname" | "avatar" | "isAdmin" | "gender" | "major">;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

export interface DirectMessage {
  id: string;
  conversationId: string;
  body: string;
  createdAt: string;
  isMine: boolean;
  sender: Pick<Profile, "id" | "nickname" | "avatar" | "isAdmin">;
}
