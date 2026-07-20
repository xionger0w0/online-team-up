import type { SupabaseClient } from "@supabase/supabase-js";
import type { Building, Gender, Orientation, Profile, SleepSlot, Team, WakeSlot } from "@/lib/types";

type ContactType = "微信" | "QQ";

export interface ProfileInput {
  nickname: string;
  avatar: string;
  gender: Gender;
  building: Building;
  major: string;
  weekdaySleep: SleepSlot;
  weekendSleep: SleepSlot;
  weekdayWake: WakeSlot;
  weekendWake: WakeSlot;
  orientation: Orientation;
  interests: string[];
  intro: string;
  visible: boolean;
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
    building: input.building,
    major: input.major,
    weekday_sleep: input.weekdaySleep,
    weekend_sleep: input.weekendSleep,
    weekday_wake: input.weekdayWake,
    weekend_wake: input.weekendWake,
    orientation: input.orientation,
    interests: input.interests.slice(0, 8),
    intro: input.intro.trim().slice(0, 200),
    visible: input.visible,
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
