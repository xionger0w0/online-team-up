"use client";

import {
  AlertTriangle, Bell, Building2, Check, ChevronRight, CircleUserRound, Clock3,
  Heart, Home, LockKeyhole, Menu, Search, ShieldCheck, Sparkles, UserPlus,
  Users, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { currentUser as demoCurrentUser, majors, profiles as demoProfiles, teams as demoTeams } from "@/lib/mock-data";
import { rankMatches } from "@/lib/matching";
import type { MatchResult, Profile, Team } from "@/lib/types";
import { createClient, ensureAnonymousSession, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  applyToTeam, createTeam, getMyProfile, getUnlockedContact, listAppliedTeamIds,
  listLikedProfileIds, listNotifications, listProfiles, listTeams, listUnlockedContacts, saveProfile,
  setReaction, type ProfileInput,
} from "@/lib/supabase/data";

type Tab = "home" | "plaza" | "recommend" | "teams" | "me";

const navItems: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "首页", icon: Home },
  { id: "plaza", label: "广场", icon: Users },
  { id: "recommend", label: "推荐", icon: Sparkles },
  { id: "teams", label: "队伍", icon: UserPlus },
  { id: "me", label: "我的", icon: CircleUserRound },
];

function Avatar({ profile, size = "md" }: { profile: Pick<Profile, "avatar" | "nickname">; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-10 text-lg", md: "size-13 text-2xl", lg: "size-20 text-4xl" };
  return <div aria-label={`${profile.nickname}的头像`} className={`${sizes[size]} grid shrink-0 place-items-center rounded-[1.15rem] bg-gradient-to-br from-sky-100 to-amber-50 ring-1 ring-sky-900/8`}>{profile.avatar}</div>;
}

function Badge({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "yellow" | "green" | "gray" }) {
  const colors = { blue: "bg-sky-50 text-sky-800", yellow: "bg-amber-50 text-amber-800", green: "bg-emerald-50 text-emerald-800", gray: "bg-slate-100 text-slate-600" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${colors[tone]}`}>{children}</span>;
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div className="relative grid size-16 place-items-center rounded-full" style={{ background: `conic-gradient(#1677a7 ${score * 3.6}deg, #e6eef2 0deg)` }}>
      <div className="grid size-12 place-items-center rounded-full bg-white"><strong className="text-lg text-sky-900">{score}</strong><span className="-mt-2 text-[9px] text-slate-400">匹配度</span></div>
    </div>
  );
}

function ProfileCard({ result, liked, canContact, onLike, onContact }: { result: MatchResult; liked: boolean; canContact: boolean; onLike: () => void; onContact: () => void }) {
  const p = result.profile;
  return (
    <article className="card group p-5">
      <div className="flex items-start gap-4">
        <Avatar profile={p} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">{p.nickname}</h3><Badge tone="yellow">身份未验证</Badge>{p.teamStatus !== "none" && <Badge tone="green">已组队·仍愿交流</Badge>}</div>
          <p className="mt-1 text-sm text-slate-500">{p.building}号楼 · {p.major}</p>
        </div>
        <ScoreRing score={result.total} />
      </div>
      <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{p.intro}</p>
      <div className="mt-4 flex flex-wrap gap-2">{p.interests.map((tag) => <Badge key={tag} tone="gray">{tag}</Badge>)}</div>
      <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-slate-50 p-3 text-center text-xs text-slate-500">
        <div><b className="block text-sm text-slate-800">{result.schedule}%</b>作息</div>
        <div><b className="block text-sm text-slate-800">{result.hobbies}%</b>兴趣</div>
        <div><b className="block text-sm text-slate-800">{result.orientation}%</b>朝向</div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={onLike} className={`button flex-1 ${liked ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200" : "button-primary"}`}><Heart className={`size-4 ${liked ? "fill-current" : ""}`} />{liked ? "已感兴趣" : "感兴趣"}</button>
        {canContact && <button onClick={onContact} className="button button-secondary">查看联系</button>}
      </div>
    </article>
  );
}

function TeamCard({ team, applied, onApply }: { team: Team; applied: boolean; onApply: () => void }) {
  const percent = Math.round((team.members / team.capacity) * 100);
  return (
    <article className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div><Badge>{team.building}号楼 · {team.capacity}人间</Badge><h3 className="mt-3 text-lg font-bold text-slate-900">{team.name}</h3></div>
        <div className="text-right"><strong className="text-xl text-sky-900">{team.members}/{team.capacity}</strong><span className="block text-xs text-slate-400">当前人数</span></div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-600" style={{ width: `${percent}%` }} /></div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{team.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2"><Badge tone="green">{team.schedule}</Badge><Badge tone="yellow">偏好{team.orientation}</Badge>{team.interests.slice(0, 3).map((tag) => <Badge key={tag} tone="gray">{tag}</Badge>)}</div>
      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4"><span className="text-xs text-slate-400">成员资料入队后可见</span><button onClick={onApply} disabled={applied} className="button button-primary disabled:bg-slate-200 disabled:text-slate-500">{applied ? <><Check className="size-4" />已申请</> : <>申请加入<ChevronRight className="size-4" /></>}</button></div>
    </article>
  );
}

export function PlatformApp() {
  const [tab, setTab] = useState<Tab>("home");
  const [plazaType, setPlazaType] = useState<"people" | "teams">("people");
  const [me, setMe] = useState<Profile>(demoCurrentUser);
  const [people, setPeople] = useState<Profile[]>(demoProfiles);
  const [teamList, setTeamList] = useState<Team[]>(demoTeams);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [contacts, setContacts] = useState<Map<string, Profile["contact"]>>(new Map());
  const [notices, setNotices] = useState<Array<{ id: string; title: string; body: string; created_at: string }>>([]);
  const [toast, setToast] = useState("");
  const [showContact, setShowContact] = useState<Profile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [connectionError, setConnectionError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const supabase = useMemo(() => isSupabaseConfigured() ? createClient() : null, []);
  const matches = useMemo(() => rankMatches(me, people), [me, people]);

  const refreshLiveData = async (userId: string) => {
    if (!supabase) return;
    const own = await getMyProfile(supabase, userId);
    if (!own) {
      setNeedsProfile(true);
      setShowProfile(true);
      return;
    }
    const [otherProfiles, visibleTeams, likedIds, appliedIds, unlocked, notificationRows] = await Promise.all([
      listProfiles(supabase, userId), listTeams(supabase), listLikedProfileIds(supabase, userId),
      listAppliedTeamIds(supabase, userId), listUnlockedContacts(supabase, userId), listNotifications(supabase, userId),
    ]);
    setMe(own);
    setPeople(otherProfiles);
    setTeamList(visibleTeams);
    setLiked(likedIds);
    setApplied(appliedIds);
    setContacts(unlocked);
    setNotices(notificationRows as Array<{ id: string; title: string; body: string; created_at: string }>);
    setNeedsProfile(false);
  };

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    (async () => {
      try {
        const session = await ensureAnonymousSession();
        if (!session) throw new Error("无法建立匿名账户");
        if (active) await refreshLiveData(session.user.id);
      } catch (error) {
        if (active) setConnectionError(error instanceof Error ? error.message : "数据库连接失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  // Supabase 客户端在组件生命周期内保持不变。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };
  const toggleLike = async (profile: Profile) => {
    const wasLiked = liked.has(profile.id);
    const next = new Set(liked);
    if (wasLiked) next.delete(profile.id); else next.add(profile.id);
    setLiked(next);
    if (!supabase) {
      if (profile.id === "p1" && !wasLiked) {
        setContacts(new Map(contacts).set(profile.id, profile.contact));
        notify("你和小满互相感兴趣，联系方式已解锁");
      }
      return;
    }
    try {
      await setReaction(supabase, me.id, profile.id, !wasLiked);
      if (wasLiked) {
        const updated = new Map(contacts); updated.delete(profile.id); setContacts(updated);
        notify("已取消感兴趣");
      } else {
        const contact = await getUnlockedContact(supabase, profile.id);
        if (contact) {
          setContacts(new Map(contacts).set(profile.id, contact));
          notify(`你和${profile.nickname}互相感兴趣，联系方式已解锁`);
        } else notify("已表达兴趣，对方同意后会解锁联系方式");
      }
    } catch (error) {
      setLiked(new Set(liked));
      notify(error instanceof Error ? error.message : "操作失败，请稍后重试");
    }
  };
  const applyTeam = async (team: Team) => {
    setApplied(new Set(applied).add(team.id));
    if (!supabase) { notify(`已向「${team.name}」提交申请，等待队长审批`); return; }
    try {
      await applyToTeam(supabase, team.id);
      notify(`已向「${team.name}」提交申请，等待队长审批`);
    } catch (error) {
      const reverted = new Set(applied); reverted.delete(team.id); setApplied(reverted);
      notify(error instanceof Error ? error.message : "申请失败");
    }
  };

  const openContact = (profile: Profile) => {
    const contact = contacts.get(profile.id);
    if (contact) setShowContact({ ...profile, contact });
  };

  const handleSaveProfile = async (input: ProfileInput) => {
    if (!supabase) { setShowProfile(false); notify("资料已保存到当前设备（演示模式）"); return; }
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("匿名账户尚未建立");
    await saveProfile(supabase, data.session.user.id, input);
    await refreshLiveData(data.session.user.id);
    setShowProfile(false);
    notify("资料已安全保存");
  };

  const handleCreateTeam = async (input: { name: string; summary: string; orientation: Profile["orientation"] }) => {
    if (!supabase) { setShowCreateTeam(false); notify("演示队伍已创建"); return; }
    await createTeam(supabase, input);
    const updatedTeams = await listTeams(supabase);
    setTeamList(updatedTeams);
    setShowCreateTeam(false);
    notify("队伍已创建，你已成为队长");
  };

  return (
    <div className="min-h-screen bg-[#f7fafb] text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex h-17 max-w-7xl items-center gap-8 px-4 sm:px-6">
          <button onClick={() => setTab("home")} className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-sky-900 text-xl text-white">伴</span><span className="text-left"><strong className="block leading-4 text-sky-950">线上组队</strong><small className="text-[10px] tracking-widest text-slate-400">第三方个人网站</small></span></button>
          <nav className="hidden flex-1 items-center gap-1 md:flex">{navItems.map(({ id, label }) => <button key={id} onClick={() => setTab(id)} className={`nav-link ${tab === id ? "nav-link-active" : ""}`}>{label}</button>)}</nav>
          <div className="ml-auto flex items-center gap-2"><button onClick={() => setTab("me")} className="icon-button relative" aria-label="通知"><Bell className="size-5" />{notices.length > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-amber-400 ring-2 ring-white" />}</button><button onClick={() => setShowProfile(true)} className="hidden items-center gap-2 rounded-full bg-slate-50 py-1.5 pl-2 pr-3 text-sm font-semibold sm:flex"><Avatar profile={me} size="sm" />{me.nickname || "完善资料"}</button><button onClick={() => setMenuOpen(!menuOpen)} className="icon-button md:hidden"><Menu className="size-5" /></button></div>
        </div>
      </header>

      <div className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2.5 text-xs leading-5 text-amber-900 sm:px-6"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p><b>重要提醒：</b>提前组队不等于锁定房源，也不能保证入住同一宿舍。低层、阳面等热门位置可能更难抢到。</p></div>
      </div>

      {connectionError && <div className="border-b border-rose-200 bg-rose-50"><div className="mx-auto max-w-7xl px-4 py-3 text-xs text-rose-800 sm:px-6"><b>暂时使用演示数据：</b>{connectionError}。请确认 Supabase 已开启匿名登录。</div></div>}

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-9">
        {loading ? <div className="card grid min-h-72 place-items-center p-8 text-sm text-slate-500">正在建立匿名账户并安全加载资料…</div> : <>
          {tab === "home" && <HomePage me={me} matches={matches} onExplore={() => setTab("recommend")} onProfile={() => setShowProfile(true)} />}
          {tab === "plaza" && <PlazaPage me={me} teams={teamList} type={plazaType} setType={setPlazaType} matches={matches} liked={liked} contacts={contacts} applied={applied} onLike={toggleLike} onContact={openContact} onApply={applyTeam} />}
          {tab === "recommend" && <RecommendPage matches={matches} liked={liked} contacts={contacts} onLike={toggleLike} onContact={openContact} />}
          {tab === "teams" && <TeamsPage me={me} teams={teamList} applied={applied} onApply={applyTeam} onCreate={() => setShowCreateTeam(true)} />}
          {tab === "me" && <MePage me={me} notices={notices} onProfile={() => setShowProfile(true)} />}
        </>}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex flex-col items-center gap-1 py-1 text-[10px] font-semibold ${tab === id ? "text-sky-800" : "text-slate-400"}`}><Icon className="size-5" />{label}</button>)}</nav>

      {toast && <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-sky-950 px-5 py-3 text-sm font-medium text-white shadow-xl md:bottom-8">{toast}</div>}
      {showContact && <ContactModal profile={showContact} onClose={() => setShowContact(null)} />}
      {showProfile && <ProfileModal profile={needsProfile ? { ...demoCurrentUser, nickname: "", intro: "", interests: [], contact: { type: "微信", value: "" } } : me} required={needsProfile} onClose={() => { if (!needsProfile) setShowProfile(false); }} onSave={handleSaveProfile} />}
      {showCreateTeam && <CreateTeamModal me={me} onClose={() => setShowCreateTeam(false)} onSave={handleCreateTeam} />}
      {menuOpen && <div className="fixed inset-0 z-50 bg-slate-950/25 md:hidden" onClick={() => setMenuOpen(false)}><div className="absolute right-4 top-19 w-48 rounded-2xl bg-white p-2 shadow-xl">{navItems.map(({ id, label }) => <button key={id} onClick={() => { setTab(id); setMenuOpen(false); }} className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium hover:bg-slate-50">{label}</button>)}</div></div>}
    </div>
  );
}

function HomePage({ me, matches, onExplore, onProfile }: { me: Profile; matches: MatchResult[]; onExplore: () => void; onProfile: () => void }) {
  return <div className="space-y-8">
    <section className="hero-panel overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14"><div className="relative z-10 max-w-2xl"><Badge tone="yellow">2026 新生 · {me.building}号楼</Badge><h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl">选寝前，先找到<br /><span className="text-amber-300">合拍的人</span></h1><p className="mt-5 max-w-xl text-base leading-7 text-sky-100 sm:text-lg">按楼栋、作息和兴趣认识未来室友。联系方式只有双方互相感兴趣后才会解锁。</p><div className="mt-8 flex flex-wrap gap-3"><button onClick={onExplore} className="button bg-amber-300 px-6 py-3 text-sky-950 hover:bg-amber-200"><Sparkles className="size-5" />查看推荐</button><button onClick={onProfile} className="button border border-white/20 bg-white/10 px-6 py-3 text-white hover:bg-white/15">完善资料</button></div></div><div className="hero-orbit hidden lg:block"><span>13</span><span>14</span><span>15</span><span>19</span><span>23</span></div></section>
    <section className="grid gap-4 sm:grid-cols-3"><InfoTile icon={ShieldCheck} title="隐私优先" text="资料最小化收集，联系方式双向同意后解锁" /><InfoTile icon={Sparkles} title="透明匹配" text="作息 55% · 兴趣 40% · 朝向 5%" /><InfoTile icon={Building2} title="按楼组队" text="楼栋与性别硬筛选，不混入无效推荐" /></section>
    <section><SectionTitle eyebrow="为你推荐" title="也许会合拍的室友" action="查看全部" onAction={onExplore} /><div className="grid gap-4 lg:grid-cols-3">{matches.slice(0, 3).map((item) => <MiniMatch key={item.profile.id} result={item} />)}</div></section>
    <section className="card grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center"><div><h2 className="text-xl font-bold text-slate-900">你还没有加入队伍</h2><p className="mt-2 text-sm leading-6 text-slate-500">可以先认识同学，也可以浏览匿名化的小队特点。每人同一时间只能加入一个队伍。</p></div><button className="button button-secondary" onClick={onExplore}>先看看推荐<ChevronRight className="size-4" /></button></section>
  </div>;
}

function InfoTile({ icon: Icon, title, text }: { icon: typeof Home; title: string; text: string }) { return <div className="card flex gap-4 p-5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-800"><Icon className="size-5" /></span><div><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>; }
function MiniMatch({ result }: { result: MatchResult }) { return <div className="card flex items-center gap-4 p-4"><Avatar profile={result.profile} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong>{result.profile.nickname}</strong><Badge tone="yellow">未验证</Badge></div><p className="mt-1 truncate text-xs text-slate-500">{result.profile.major} · {result.profile.interests.slice(0, 2).join(" / ")}</p></div><div className="text-center"><strong className="text-xl text-sky-900">{result.total}</strong><span className="block text-[9px] text-slate-400">匹配度</span></div></div>; }
function SectionTitle({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) { return <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">{eyebrow}</p><h2 className="mt-1 text-2xl font-black text-slate-900">{title}</h2></div>{action && <button onClick={onAction} className="text-sm font-semibold text-sky-700">{action} →</button>}</div>; }

function PlazaPage({ me, teams, type, setType, matches, liked, contacts, applied, onLike, onContact, onApply }: { me: Profile; teams: Team[]; type: "people" | "teams"; setType: (v: "people" | "teams") => void; matches: MatchResult[]; liked: Set<string>; contacts: Map<string, Profile["contact"]>; applied: Set<string>; onLike: (p: Profile) => void; onContact: (p: Profile) => void; onApply: (t: Team) => void }) {
  return <div><SectionTitle eyebrow={`${me.building}号楼广场`} title="找到同楼的新同学" /><div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="segmented"><button onClick={() => setType("people")} className={type === "people" ? "active" : ""}>找舍友</button><button onClick={() => setType("teams")} className={type === "teams" ? "active" : ""}>找队伍</button></div><div className="flex gap-2"><label className="search-box"><Search className="size-4" /><input placeholder="搜索昵称、专业或兴趣" /></label><button className="icon-button border border-slate-200"><Clock3 className="size-4" /></button></div></div>{type === "people" ? <div className="grid gap-4 lg:grid-cols-2">{matches.length ? matches.map((r) => <ProfileCard key={r.profile.id} result={r} liked={liked.has(r.profile.id)} canContact={contacts.has(r.profile.id)} onLike={() => onLike(r.profile)} onContact={() => onContact(r.profile)} />) : <EmptyState text="同楼同性别广场暂时还没有其他公开资料" />}</div> : <div className="grid gap-4 lg:grid-cols-2">{teams.length ? teams.map((t) => <TeamCard key={t.id} team={t} applied={applied.has(t.id)} onApply={() => onApply(t)} />) : <EmptyState text="暂时还没有招募中的队伍，可以先创建一个" />}</div>}</div>;
}

function RecommendPage({ matches, liked, contacts, onLike, onContact }: { matches: MatchResult[]; liked: Set<string>; contacts: Map<string, Profile["contact"]>; onLike: (p: Profile) => void; onContact: (p: Profile) => void }) {
  return <div><SectionTitle eyebrow="双向匹配算法" title="为你推荐" /><div className="mb-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-900"><b>算法说明：</b>只比较同楼、同性别资料。作息占 55%，兴趣占 40%，朝向占 5%；不使用隐藏画像，也不会把公开介绍交给第三方 AI。</div><div className="grid gap-5 lg:grid-cols-2">{matches.length ? matches.map((r) => <ProfileCard key={r.profile.id} result={r} liked={liked.has(r.profile.id)} canContact={contacts.has(r.profile.id)} onLike={() => onLike(r.profile)} onContact={() => onContact(r.profile)} />) : <EmptyState text="资料发布后，新的匹配会自动出现在这里" />}</div></div>;
}

function TeamsPage({ me, teams, applied, onApply, onCreate }: { me: Profile; teams: Team[]; applied: Set<string>; onApply: (t: Team) => void; onCreate: () => void }) {
  return <div><div className="mb-6 flex items-end justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">{me.building}号楼组队中心</p><h1 className="mt-1 text-2xl font-black text-slate-900">我的队伍与申请</h1></div><button onClick={onCreate} className="button button-primary"><UserPlus className="size-4" />创建队伍</button></div><div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><b>组队不是选寝。</b> 队伍只是帮助大家相约注册同一宿舍号下的不同床位，无法锁定房间，也不保证最终同住。</div><section className="card mb-8 p-6"><div className="flex items-start gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Users /></span><div className="flex-1"><h2 className="font-bold">申请与入队采用双重确认</h2><p className="mt-1 text-sm text-slate-500">可同时申请多个队伍；队长同意后仍需你再次确认，正式加入一个队伍后其他申请自动撤销。</p></div></div></section><SectionTitle eyebrow="招募中" title="适合你的队伍" /><div className="grid gap-4 lg:grid-cols-2">{teams.length ? teams.map((t) => <TeamCard key={t.id} team={t} applied={applied.has(t.id)} onApply={() => onApply(t)} />) : <EmptyState text="还没有队伍，成为第一位队长吧" />}</div></div>;
}

function MePage({ me, notices, onProfile }: { me: Profile; notices: Array<{ id: string; title: string; body: string; created_at: string }>; onProfile: () => void }) {
  return <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><section><SectionTitle eyebrow="个人中心" title="我的资料" /><div className="card p-6"><div className="flex items-center gap-4"><Avatar profile={me} size="lg" /><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{me.nickname}</h2><Badge tone={me.verified ? "green" : "yellow"}>{me.verified ? "已验证" : "身份未验证"}</Badge></div><p className="mt-2 text-sm text-slate-500">{me.building}号楼 · {me.major}</p></div><button onClick={onProfile} className="button button-secondary">编辑资料</button></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Stat label="兴趣标签" value={`${me.interests.length}/8`} /><Stat label="公开状态" value="展示中" /><Stat label="联系方式" value="已保护" /></div></div><h2 className="mb-3 mt-8 text-lg font-bold">站内通知</h2><div className="card divide-y divide-slate-100">{notices.length ? notices.map((notice) => <Notice key={notice.id} icon={Bell} title={notice.title} text={notice.body} />) : <Notice icon={ShieldCheck} title="暂无新通知" text="互相感兴趣、入队申请和队长处理结果会显示在这里" />}</div></section><aside className="space-y-4"><div className="card p-5"><h3 className="font-bold">隐私状态</h3><div className="mt-4 space-y-3 text-sm"><PrivacyRow icon={LockKeyhole} label="联系方式" value="双方同意后可见" /><PrivacyRow icon={ShieldCheck} label="校园身份" value={me.verified ? "已验证" : "尚未验证"} /><PrivacyRow icon={Users} label="展示范围" value={`${me.building}号楼同性同学`} /></div></div><div className="card p-5"><h3 className="font-bold">账户与数据</h3><p className="mt-2 text-sm leading-6 text-slate-500">当前为浏览器匿名账户。学校邮箱发放后将支持绑定；选寝结束 30 天后自动删除本届数据。</p></div></aside></div>;
}

function EmptyState({ text }: { text: string }) { return <div className="card col-span-full grid min-h-40 place-items-center p-6 text-center text-sm text-slate-500">{text}</div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-50 p-4"><strong className="text-2xl text-sky-900">{value}</strong><span className="mt-1 block text-xs text-slate-500">{label}</span></div>; }
function Notice({ icon: Icon, title, text }: { icon: typeof Home; title: string; text: string }) { return <div className="flex gap-4 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-700"><Icon className="size-4" /></span><div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>; }
function PrivacyRow({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: string }) { return <div className="flex items-center gap-3"><Icon className="size-4 text-sky-700" /><span className="text-slate-500">{label}</span><b className="ml-auto text-xs">{value}</b></div>; }

function ContactModal({ profile, onClose }: { profile: Profile; onClose: () => void }) { return <Modal onClose={onClose}><div className="text-center"><Avatar profile={profile} size="lg" /><h2 className="mt-4 text-xl font-bold">你们互相感兴趣</h2><p className="mt-2 text-sm leading-6 text-slate-500">双方均已同意交换联系方式。离开平台后的沟通请注意保护个人信息。</p><div className="mt-6 rounded-2xl bg-sky-50 p-5"><span className="text-xs text-sky-700">{profile.contact.type}</span><strong className="mt-1 block text-lg text-sky-950">{profile.contact.value}</strong></div><button onClick={onClose} className="button button-primary mt-5 w-full">我知道了</button></div></Modal>; }

function ProfileModal({ profile, required, onClose, onSave }: { profile: Profile; required: boolean; onClose: () => void; onSave: (input: ProfileInput) => Promise<void> }) {
  const [checked, setChecked] = useState([false, false, false]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const sleepSlots = ["22:30前", "22:30–00:00", "00:00–01:30", "01:30后", "不固定"] as const;
  const wakeSlots = ["07:00前", "07:00–08:30", "08:30–10:00", "10:00后", "不固定"] as const;
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const gender = form.get("gender") as Profile["gender"];
    const building = form.get("building") as Profile["building"];
    const validSegment = building === "23" || (["13", "14"].includes(building) ? gender === "female" : gender === "male");
    if (!validSegment) { setError("13、14号楼请选择女生；15、19号楼请选择男生；23号楼男女均可。 "); return; }
    const interests = String(form.get("interests") || "").split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean);
    if (interests.length > 8) { setError("兴趣标签最多填写 8 个"); return; }
    setSaving(true);
    try {
      await onSave({
        nickname: String(form.get("nickname") || ""), avatar: String(form.get("avatar") || "🌿"), gender, building,
        major: String(form.get("major")), weekdaySleep: form.get("weekdaySleep") as Profile["weekdaySleep"],
        weekendSleep: form.get("weekendSleep") as Profile["weekendSleep"], weekdayWake: form.get("weekdayWake") as Profile["weekdayWake"],
        weekendWake: form.get("weekendWake") as Profile["weekendWake"], orientation: form.get("orientation") as Profile["orientation"],
        interests: [...new Set(interests)], intro: String(form.get("intro") || ""), visible: form.get("visible") === "true",
        contact: { type: form.get("contactType") as "微信" | "QQ", value: String(form.get("contactValue") || "") },
      });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "保存失败"); }
    finally { setSaving(false); }
  };
  return <Modal onClose={onClose} wide><form onSubmit={submit}><div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">{required ? "首次使用" : "公开资料"}</p><h2 className="mt-1 text-2xl font-black">{required ? "先创建你的匿名资料" : "完善我的资料"}</h2></div>{!required && <button type="button" className="icon-button" onClick={onClose}><X className="size-5" /></button>}</div><p className="mt-3 text-sm leading-6 text-slate-500">联系方式单独加密保护，不会出现在公开资料中，只有互相感兴趣或加入同一队伍后才能读取。</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="昵称（必填）"><input name="nickname" required maxLength={24} defaultValue={profile.nickname} /></Field><Field label="头像符号"><input name="avatar" maxLength={4} defaultValue={profile.avatar} /></Field><Field label="性别（硬筛选）"><select name="gender" defaultValue={profile.gender}><option value="female">女生</option><option value="male">男生</option></select></Field><Field label="宿舍楼"><select name="building" defaultValue={profile.building}>{["13", "14", "15", "19", "23"].map((building) => <option key={building} value={building}>{building}号楼</option>)}</select></Field><Field label="专业大类"><select name="major" defaultValue={profile.major}>{majors.map((major) => <option key={major}>{major}</option>)}</select></Field><Field label="朝向偏好"><select name="orientation" defaultValue={profile.orientation}><option>阳面</option><option>阴面</option><option>都可以</option></select></Field><Field label="工作日入睡（必填）"><select name="weekdaySleep" defaultValue={profile.weekdaySleep}>{sleepSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></Field><Field label="周末入睡（必填）"><select name="weekendSleep" defaultValue={profile.weekendSleep}>{sleepSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></Field><Field label="工作日起床（必填）"><select name="weekdayWake" defaultValue={profile.weekdayWake}>{wakeSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></Field><Field label="周末起床（必填）"><select name="weekendWake" defaultValue={profile.weekendWake}>{wakeSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></Field><Field label="联系方式类型"><select name="contactType" defaultValue={profile.contact.type}><option>微信</option><option>QQ</option></select></Field><Field label="微信或 QQ（必填）"><input name="contactValue" required maxLength={64} defaultValue={profile.contact.value} /></Field><div className="sm:col-span-2"><Field label="兴趣爱好（可选，最多8个，用逗号分隔）"><input name="interests" defaultValue={profile.interests.join("、")} placeholder="例如：羽毛球、摄影、电影" /></Field></div><Field label="公开状态"><select name="visible" defaultValue="true"><option value="true">正在展示</option><option value="false">暂停展示</option></select></Field><div className="sm:col-span-2"><Field label="个人介绍（可选，最多200字）"><textarea name="intro" defaultValue={profile.intro} rows={3} maxLength={200} /><small className="mt-1 block text-xs text-slate-400">请勿填写真实姓名、手机号、微信号等敏感信息。</small></Field></div></div><div className="mt-5 space-y-2">{["我知道这是第三方个人网站，并非学校官方系统", "我知道组队不代表锁定房源或保证同住", "我不会在公开介绍中填写联系方式等敏感信息"].map((label, i) => <label key={label} className="flex items-start gap-3 text-xs leading-5 text-slate-600"><input type="checkbox" checked={checked[i]} onChange={() => setChecked(checked.map((v, j) => j === i ? !v : v))} className="mt-1" />{label}</label>)}</div>{error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<button type="submit" disabled={!checked.every(Boolean) || saving} className="button button-primary mt-6 w-full disabled:opacity-40">{saving ? "正在保存…" : "保存资料"}</button></form></Modal>;
}

function CreateTeamModal({ me, onClose, onSave }: { me: Profile; onClose: () => void; onSave: (input: { name: string; summary: string; orientation: Profile["orientation"] }) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <Modal onClose={onClose}><form onSubmit={async (event) => { event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget); try { await onSave({ name: String(form.get("name")), summary: String(form.get("summary")), orientation: form.get("orientation") as Profile["orientation"] }); } catch (cause) { setError(cause instanceof Error ? cause.message : "创建失败"); } finally { setSaving(false); } }}><div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">{me.building}号楼</p><h2 className="mt-1 text-2xl font-black">创建队伍</h2></div><button type="button" className="icon-button" onClick={onClose}><X className="size-5" /></button></div><p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">创建队伍不会锁定任何房间。{me.building === "23" ? "本队最多8人，套间内必须同性。" : "本队最多4人。"}</p><div className="mt-5 space-y-4"><Field label="队伍名称"><input name="name" required minLength={1} maxLength={32} placeholder="例如：规律作息小队" /></Field><Field label="朝向偏好"><select name="orientation" defaultValue={me.orientation}><option>阳面</option><option>阴面</option><option>都可以</option></select></Field><Field label="小队介绍"><textarea name="summary" required maxLength={240} rows={4} defaultValue={`我们来自${me.building}号楼，整体希望彼此尊重、坦诚沟通。共同兴趣包括${me.interests.slice(0, 3).join("、") || "探索校园"}。`} /></Field></div>{error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<button type="submit" disabled={saving} className="button button-primary mt-6 w-full disabled:opacity-40">{saving ? "正在创建…" : "创建并成为队长"}</button></form></Modal>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) { return <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}><div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-[2rem] ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}>{children}</div></div>; }
