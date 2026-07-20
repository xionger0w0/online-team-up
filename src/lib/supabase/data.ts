import type { SupabaseClient } from "@supabase/supabase-js";
import type { Building, Gender, LobbyComment, LobbyContactLink, LobbyContactStatus, LobbyPost, LobbyPostKind, Orientation, Profile, SleepSlot, Team, WakeSlot } from "@/lib/types";

type ContactType = "微信" | "QQ";

export interface ProfileInput {
  nickname: string;
  avatar: string;
  gender: Gender;
  sleep: SleepSlot;
  interests: string[];
  intro: string;
  contact: { type: ContactType; value: string };
}

interface ProfileRow {
  id: string;
  nickname: string;
  avatar_url: string | null;
  gender: Gender;
  building: Building;
  major: string;
  weekday_sleep: SleepSlot;
  weekend_sleep: SleepSlot;
  weekday_wake: WakeSlot;
  weekend_wake: WakeSlot;
  orientation: Orientation;
  interests: string[];
  intro: string;
  verified: boolean;
  visible: boolean;
}

function mapProfile(row: ProfileRow, contact?: Profile["contact"]): Profile {
  return {
    id: row.id,
    nickname: row.nickname,
    avatar: row.avatar_url || (row.gender === "female" ? "🌿" : "🌊"),
    gender: row.gender,
    building: row.building,
    major: row.major,
    weekdaySleep: row.weekday_sleep,
    weekendSleep: row.weekend_sleep,
    weekdayWake: row.weekday_wake,
    weekendWake: row.weekend_wake,
    orientation: row.orientation,
    interests: row.interests || [],
    intro: row.intro,
    verified: row.verified,
    teamStatus: "none",
    contact: contact || { type: "微信", value: "" },
  };
}

export async function getMyProfile(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: contact, error: contactError } = await client
    .from("contact_methods")
    .select("contact_type, contact_value")
    .eq("user_id", userId)
    .maybeSingle();
  if (contactError) throw contactError;
  return mapProfile(data as ProfileRow, contact ? {
    type: contact.contact_type as ContactType,
    value: contact.contact_value,
  } : undefined);
}

export async function listProfiles(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from("profiles").select("*").neq("id", userId).eq("visible", true);
  if (error) throw error;
  return (data as ProfileRow[]).map((row) => mapProfile(row));
}

export async function saveProfile(client: SupabaseClient, userId: string, input: ProfileInput) {
  const { error } = await client.from("profiles").upsert({
    id: userId,
    nickname: input.nickname.trim(),
    avatar_url: input.avatar,
    gender: input.gender,
    building: "undecided",
    major: "暂不填写",
    weekday_sleep: input.sleep,
    weekend_sleep: input.sleep,
    weekday_wake: "不固定",
    weekend_wake: "不固定",
    orientation: "都可以",
    interests: input.interests.slice(0, 8),
    intro: input.intro.trim().slice(0, 200),
    visible: true,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
  const { error: contactError } = await client.from("contact_methods").upsert({
    user_id: userId,
    contact_type: input.contact.type,
    contact_value: input.contact.value.trim(),
    updated_at: new Date().toISOString(),
  });
  if (contactError) throw contactError;
}

export async function uploadProfileAvatar(client: SupabaseClient, userId: string, file: File) {
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) throw new Error("请选择 JPG、PNG 或 WebP 图片");
  if (file.size > 2 * 1024 * 1024) throw new Error("图片请控制在 2MB 以内");
  const path = `${userId}/avatar`;
  const { error } = await client.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type,
    cacheControl: "3600",
  });
  if (error) throw error;
  const { data } = client.storage.from("avatars").getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function listLikedProfileIds(client: SupabaseClient, userId: string) {
  const { data, error } = await client.from("reactions").select("target_id").eq("actor_id", userId);
  if (error) throw error;
  return new Set((data || []).map((row) => row.target_id as string));
}

export async function setReaction(client: SupabaseClient, userId: string, targetId: string, active: boolean) {
  if (active) {
    const { error } = await client.from("reactions").upsert({ actor_id: userId, target_id: targetId });
    if (error) throw error;
  } else {
    const { error } = await client.from("reactions").delete().eq("actor_id", userId).eq("target_id", targetId);
    if (error) throw error;
  }
}

export async function getUnlockedContact(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("contact_methods")
    .select("contact_type, contact_value")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { type: data.contact_type as ContactType, value: data.contact_value as string };
}

export async function listUnlockedContacts(client: SupabaseClient, ownUserId: string) {
  const { data, error } = await client
    .from("contact_methods")
    .select("user_id, contact_type, contact_value")
    .neq("user_id", ownUserId);
  if (error) throw error;
  return new Map((data || []).map((row) => [row.user_id as string, {
    type: row.contact_type as ContactType,
    value: row.contact_value as string,
  }]));
}

interface TeamRpcRow {
  id: string;
  name: string;
  building: Building;
  gender: Gender;
  capacity: 4 | 8;
  member_count: number;
  summary: string;
  orientation: Orientation;
  open: boolean;
}

export async function listTeams(client: SupabaseClient): Promise<Team[]> {
  const { data, error } = await client.rpc("list_visible_teams");
  if (error) throw error;
  return ((data || []) as TeamRpcRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    building: row.building,
    gender: row.gender,
    members: Number(row.member_count),
    capacity: row.capacity,
    schedule: "成员生活节奏的综合参考",
    orientation: row.orientation,
    interests: [],
    summary: row.summary,
    open: row.open,
  }));
}

export async function listAppliedTeamIds(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("team_applications")
    .select("team_id")
    .eq("applicant_id", userId)
    .in("status", ["pending", "captain_approved"]);
  if (error) throw error;
  return new Set((data || []).map((row) => row.team_id as string));
}

export async function applyToTeam(client: SupabaseClient, teamId: string) {
  const { error } = await client.rpc("apply_to_team", { target_team: teamId });
  if (error) throw error;
}

export async function createTeam(client: SupabaseClient, input: { name: string; summary: string; orientation: Orientation }) {
  const { data, error } = await client.rpc("create_team", {
    team_name: input.name.trim(),
    team_summary: input.summary.trim(),
    team_orientation: input.orientation,
  });
  if (error) throw error;
  return data as string;
}

export async function listNotifications(client: SupabaseClient, userId: string) {
  const { data, error } = await client
    .from("notifications")
    .select("id, type, title, body, read_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw error;
  return data || [];
}

interface LobbyAuthorRow {
  author_id: string;
  author_nickname: string;
  author_avatar: string | null;
  author_building: Building;
  author_gender: Gender;
  author_major: string;
}

interface LobbyPostRow extends LobbyAuthorRow {
  id: string;
  kind: LobbyPostKind;
  body: string;
  team_id: string | null;
  created_at: string;
  comment_count: number;
  author_sleep: SleepSlot;
  author_interests: string[];
  author_intro: string;
}

interface LobbyCommentRow extends LobbyAuthorRow {
  id: string;
  post_id: string;
  body: string;
  created_at: string;
}

function mapLobbyAuthor(row: LobbyAuthorRow) {
  return {
    id: row.author_id,
    nickname: row.author_nickname,
    avatar: row.author_avatar || (row.author_gender === "female" ? "🌿" : "🌊"),
    building: row.author_building,
    gender: row.author_gender,
    major: row.author_major,
  };
}

export async function listLobbyPosts(client: SupabaseClient, ownUserId: string): Promise<LobbyPost[]> {
  const { data, error } = await client.rpc("list_lobby_posts", { post_limit: 100 });
  if (error) throw error;
  return ((data || []) as LobbyPostRow[]).map((row) => ({
    id: row.id,
    kind: row.kind,
    body: row.body,
    teamId: row.team_id || undefined,
    createdAt: row.created_at,
    commentCount: Number(row.comment_count),
    isMine: row.author_id === ownUserId,
    author: {
      ...mapLobbyAuthor(row),
      weekdaySleep: row.author_sleep,
      interests: row.author_interests || [],
      intro: row.author_intro || "",
    },
  }));
}

export async function publishLobbyPost(client: SupabaseClient, kind: LobbyPostKind, body: string, teamId?: string) {
  const { data, error } = await client.rpc("publish_lobby_post", {
    post_kind: kind,
    message_body: body.trim(),
    target_team: teamId || null,
  });
  if (error) throw error;
  return data as string;
}

export async function deleteLobbyPost(client: SupabaseClient, postId: string) {
  const { error } = await client.from("lobby_posts").delete().eq("id", postId);
  if (error) throw error;
}

export async function listLobbyComments(client: SupabaseClient, postId: string, ownUserId: string): Promise<LobbyComment[]> {
  const { data, error } = await client.rpc("list_lobby_comments", { target_post: postId });
  if (error) throw error;
  return ((data || []) as LobbyCommentRow[]).map((row) => ({
    id: row.id,
    postId: row.post_id,
    body: row.body,
    createdAt: row.created_at,
    isMine: row.author_id === ownUserId,
    author: mapLobbyAuthor(row),
  }));
}

export async function addLobbyComment(client: SupabaseClient, postId: string, body: string) {
  const { data, error } = await client.rpc("add_lobby_comment", { target_post: postId, message_body: body.trim() });
  if (error) throw error;
  return data as string;
}

export async function deleteLobbyComment(client: SupabaseClient, commentId: string) {
  const { error } = await client.from("lobby_comments").delete().eq("id", commentId);
  if (error) throw error;
}

export async function reportLobbyPost(client: SupabaseClient, postId: string, reason: string) {
  const { error } = await client.rpc("report_lobby_post", { target_post: postId, report_reason: reason.trim() });
  if (error) throw error;
}

interface LobbyContactLinkRow {
  request_id: string;
  post_id: string;
  relation_role: "requester" | "recipient";
  request_status: LobbyContactStatus;
  created_at: string;
  other_id: string;
  other_nickname: string;
  other_avatar: string | null;
  other_gender: Gender;
  other_contact_type: ContactType | null;
  other_contact_value: string | null;
}

export async function listLobbyContactLinks(client: SupabaseClient): Promise<LobbyContactLink[]> {
  const { data, error } = await client.rpc("list_lobby_contact_links");
  if (error) throw error;
  return ((data || []) as LobbyContactLinkRow[]).map((row) => ({
    requestId: row.request_id,
    postId: row.post_id,
    role: row.relation_role,
    status: row.request_status,
    createdAt: row.created_at,
    other: {
      id: row.other_id,
      nickname: row.other_nickname,
      avatar: row.other_avatar || (row.other_gender === "female" ? "🌿" : "🌊"),
      gender: row.other_gender,
    },
    contact: row.request_status === "accepted" && row.other_contact_type && row.other_contact_value
      ? { type: row.other_contact_type, value: row.other_contact_value }
      : undefined,
  }));
}

export async function requestLobbyContact(client: SupabaseClient, postId: string) {
  const { data, error } = await client.rpc("request_lobby_contact", { target_post: postId });
  if (error) throw error;
  return data as string;
}

export async function respondLobbyContact(client: SupabaseClient, requestId: string, accept: boolean) {
  const { error } = await client.rpc("respond_lobby_contact", { target_request: requestId, accept_request: accept });
  if (error) throw error;
}
