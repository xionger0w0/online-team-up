"use client";

import {
  AlertTriangle, Bell, Building2, Check, ChevronRight, CircleUserRound, Clock3,
  Coffee, Compass, Home, LockKeyhole, Menu, MessageCircle, Search, ShieldCheck,
  Sparkles, UserPlus, Users, X,
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
  { id: "plaza", label: "同楼", icon: Users },
  { id: "recommend", label: "相处线索", icon: Sparkles },
  { id: "teams", label: "同行小队", icon: UserPlus },
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

function ProfileCard({ result, liked, canContact, onLike, onContact }: { result: MatchResult; liked: boolean; canContact: boolean; onLike: () => void; onContact: () => void }) {
  const p = result.profile;
  return (
    <article className="card profile-card group p-5">
      <div className="flex items-start gap-4">
        <Avatar profile={p} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-slate-900">{p.nickname}</h3><Badge tone="yellow">校园验证稍后开放</Badge>{p.teamStatus !== "none" && <Badge tone="green">已有队伍 · 欢迎交流</Badge>}</div>
          <p className="mt-1 text-sm text-slate-500">{p.building}号楼 · {p.major}</p>
        </div>
        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-amber-50 text-amber-700"><Coffee className="size-5" /></span>
      </div>
      <p className="mt-4 line-clamp-2 text-sm leading-6 text-slate-600">{p.intro}</p>
      <div className="mt-4 flex flex-wrap gap-2">{p.interests.map((tag) => <Badge key={tag} tone="gray">{tag}</Badge>)}</div>
      <div className="mt-4 rounded-2xl bg-[#f7f3ea] p-4">
        <p className="text-xs font-bold text-amber-900">愿意分享的生活信息</p>
        <div className="mt-2 space-y-1.5 text-xs leading-5 text-slate-600">{result.reasons.slice(0, 2).map((reason) => <p key={reason} className="flex gap-2"><span className="text-amber-500">•</span><span>{reason}</span></p>)}</div>
      </div>
      <div className="mt-4 flex gap-2">
        <button onClick={onLike} className={`button flex-1 ${liked ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "button-primary"}`}><MessageCircle className="size-4" />{liked ? "已表示愿意认识" : "愿意认识"}</button>
        {canContact && <button onClick={onContact} className="button button-secondary">查看联系方式</button>}
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
        <div className="text-right"><strong className="text-xl text-sky-900">{team.members}/{team.capacity}</strong><span className="block text-xs text-slate-400">同行人数</span></div>
      </div>
      <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-sky-600" style={{ width: `${percent}%` }} /></div>
      <p className="mt-4 text-sm leading-6 text-slate-600">{team.summary}</p>
      <div className="mt-4 flex flex-wrap gap-2"><Badge tone="green">{team.schedule}</Badge><Badge tone="yellow">采光更倾向{team.orientation}</Badge>{team.interests.slice(0, 3).map((tag) => <Badge key={tag} tone="gray">{tag}</Badge>)}</div>
      <div className="mt-5 flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className="text-xs text-slate-400">可以先了解，不需要马上决定</span><button onClick={onApply} disabled={applied} className="button button-primary disabled:bg-slate-200 disabled:text-slate-500">{applied ? <><Check className="size-4" />已留下加入意向</> : <>留下加入意向<ChevronRight className="size-4" /></>}</button></div>
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
  const [showDisclaimer, setShowDisclaimer] = useState(false);
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
        if (!session) throw new Error("暂时没能为你建立浏览器账户");
        if (active) await refreshLiveData(session.user.id);
      } catch (error) {
        if (active) setConnectionError(error instanceof Error ? error.message : "暂时没能连接到线上资料");
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
        notify("小满也愿意认识你，联系方式现在可以看到了");
      }
      return;
    }
    try {
      await setReaction(supabase, me.id, profile.id, !wasLiked);
      if (wasLiked) {
        const updated = new Map(contacts); updated.delete(profile.id); setContacts(updated);
        notify("已收回认识意愿，对方不会收到额外提示");
      } else {
        const contact = await getUnlockedContact(supabase, profile.id);
        if (contact) {
          setContacts(new Map(contacts).set(profile.id, contact));
          notify(`${profile.nickname}也愿意认识你，联系方式现在可以看到了`);
        } else notify("认识意愿已经保存；不需要马上聊天，对方愿意时再继续就好");
      }
    } catch (error) {
      setLiked(new Set(liked));
      notify(error instanceof Error ? error.message : "这次没有完成，请稍后再试");
    }
  };
  const applyTeam = async (team: Team) => {
    setApplied(new Set(applied).add(team.id));
    if (!supabase) { notify(`已向「${team.name}」表达加入意愿，等待队长回应`); return; }
    try {
      await applyToTeam(supabase, team.id);
      notify(`已向「${team.name}」表达加入意愿，等待队长回应`);
    } catch (error) {
      const reverted = new Set(applied); reverted.delete(team.id); setApplied(reverted);
      notify(error instanceof Error ? error.message : "这次没有提交成功，请稍后再试");
    }
  };

  const openContact = (profile: Profile) => {
    const contact = contacts.get(profile.id);
    if (contact) setShowContact({ ...profile, contact });
  };

  const handleSaveProfile = async (input: ProfileInput) => {
    if (!supabase) { setShowProfile(false); notify("资料已保存到当前设备（演示模式）"); return; }
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("浏览器账户还在准备中，请稍后再试");
    await saveProfile(supabase, data.session.user.id, input);
    await refreshLiveData(data.session.user.id);
    setShowProfile(false);
    notify("你的资料已经妥善保存");
  };

  const handleCreateTeam = async (input: { name: string; summary: string; orientation: Profile["orientation"] }) => {
    if (!supabase) { setShowCreateTeam(false); notify("演示队伍已创建"); return; }
    await createTeam(supabase, input);
    const updatedTeams = await listTeams(supabase);
    setTeamList(updatedTeams);
    setShowCreateTeam(false);
    notify("小队已经创建好啦，你可以慢慢邀请合适的同学");
  };

  return (
    <div className="min-h-screen bg-[#f7f7f2] text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex h-17 max-w-7xl items-center gap-8 px-4 sm:px-6">
          <button onClick={() => setTab("home")} className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-sky-900 text-xl text-white">伴</span><span className="text-left"><strong className="block leading-4 text-sky-950">线上组队</strong><small className="text-[10px] tracking-widest text-slate-400">第三方个人网站</small></span></button>
          <nav className="hidden flex-1 items-center gap-1 md:flex">{navItems.map(({ id, label }) => <button key={id} onClick={() => setTab(id)} className={`nav-link ${tab === id ? "nav-link-active" : ""}`}>{label}</button>)}</nav>
          <div className="ml-auto flex items-center gap-2"><button onClick={() => setTab("me")} className="icon-button relative" aria-label="通知"><Bell className="size-5" />{notices.length > 0 && <span className="absolute right-2 top-2 size-2 rounded-full bg-amber-400 ring-2 ring-white" />}</button><button onClick={() => setShowProfile(true)} className="hidden items-center gap-2 rounded-full bg-slate-50 py-1.5 pl-2 pr-3 text-sm font-semibold sm:flex"><Avatar profile={me} size="sm" />{me.nickname || "完善资料"}</button><button onClick={() => setMenuOpen(!menuOpen)} className="icon-button md:hidden"><Menu className="size-5" /></button></div>
        </div>
      </header>

      <div className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2.5 text-xs leading-5 text-amber-900 sm:px-6"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p><b>选寝前的小提醒：</b>这里的组队是一份彼此同行的约定，并不会预留房间，也无法保证最后住在一起。低层、阳面等较受欢迎的位置，可能需要大家准备不同方案。</p></div>
      </div>

      {connectionError && <div className="border-b border-rose-200 bg-rose-50"><div className="mx-auto max-w-7xl px-4 py-3 text-xs text-rose-800 sm:px-6"><b>线上资料暂时没有加载出来：</b>{connectionError}。你仍可以先看看页面，稍后再试。</div></div>}

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-9">
        {loading ? <div className="card grid min-h-72 place-items-center p-8 text-sm text-slate-500">正在为你准备一个安静、私密的小空间…</div> : <>
          {tab === "home" && <HomePage me={me} matches={matches} onPeople={() => { setPlazaType("people"); setTab("plaza"); }} onTeams={() => { setPlazaType("teams"); setTab("plaza"); }} onProfile={() => setShowProfile(true)} />}
          {tab === "plaza" && <PlazaPage me={me} teams={teamList} type={plazaType} setType={setPlazaType} matches={matches} liked={liked} contacts={contacts} applied={applied} onLike={toggleLike} onContact={openContact} onApply={applyTeam} />}
          {tab === "recommend" && <RecommendPage matches={matches} liked={liked} contacts={contacts} onLike={toggleLike} onContact={openContact} />}
          {tab === "teams" && <TeamsPage me={me} teams={teamList} applied={applied} onApply={applyTeam} onCreate={() => setShowCreateTeam(true)} />}
          {tab === "me" && <MePage me={me} notices={notices} onProfile={() => setShowProfile(true)} />}
        </>}
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 pb-24 pt-6 text-xs text-slate-500 sm:px-6 md:pb-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p>线上组队由在校生个人制作，是独立的第三方个人网站，并非学校官方平台。</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <button onClick={() => setShowDisclaimer(true)} className="font-semibold text-sky-800 hover:text-sky-950">免责声明与使用说明</button>
            <a href="mailto:scymg5@nottingham.edu.cn" className="font-semibold text-sky-800 hover:text-sky-950">联系制作者</a>
          </div>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex flex-col items-center gap-1 py-1 text-[10px] font-semibold ${tab === id ? "text-sky-800" : "text-slate-400"}`}><Icon className="size-5" />{label}</button>)}</nav>

      {toast && <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-sky-950 px-5 py-3 text-sm font-medium text-white shadow-xl md:bottom-8">{toast}</div>}
      {showContact && <ContactModal profile={showContact} onClose={() => setShowContact(null)} />}
      {showProfile && <ProfileModal profile={needsProfile ? { ...demoCurrentUser, nickname: "", intro: "", interests: [], contact: { type: "微信", value: "" } } : me} required={needsProfile} onClose={() => { if (!needsProfile) setShowProfile(false); }} onSave={handleSaveProfile} />}
      {showCreateTeam && <CreateTeamModal me={me} onClose={() => setShowCreateTeam(false)} onSave={handleCreateTeam} />}
      {showDisclaimer && <DisclaimerModal onClose={() => setShowDisclaimer(false)} />}
      {menuOpen && <div className="fixed inset-0 z-50 bg-slate-950/25 md:hidden" onClick={() => setMenuOpen(false)}><div className="absolute right-4 top-19 w-48 rounded-2xl bg-white p-2 shadow-xl">{navItems.map(({ id, label }) => <button key={id} onClick={() => { setTab(id); setMenuOpen(false); }} className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium hover:bg-slate-50">{label}</button>)}</div></div>}
    </div>
  );
}

function HomePage({ me, matches, onPeople, onTeams, onProfile }: { me: Profile; matches: MatchResult[]; onPeople: () => void; onTeams: () => void; onProfile: () => void }) {
  return <div className="space-y-8">
    <section className="hero-panel overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14"><div className="relative z-10 max-w-2xl"><Badge tone="yellow">2026 新生 · {me.building}号楼</Badge><h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl">同一栋楼，<br /><span className="text-amber-300">先看看彼此的介绍</span></h1><p className="mt-5 max-w-xl text-base leading-7 text-sky-100 sm:text-lg">不必急着开始聊天。可以先了解大家愿意分享的作息、兴趣和生活习惯，再按自己的节奏决定。</p><div className="mt-8 flex flex-wrap gap-3"><button onClick={onPeople} className="button bg-amber-300 px-6 py-3 text-sky-950 hover:bg-amber-200"><Users className="size-5" />查看{me.building}号楼同学</button><button onClick={onTeams} className="button border border-white/20 bg-white/10 px-6 py-3 text-white hover:bg-white/15"><Compass className="size-5" />查看同行小队</button></div><button onClick={onProfile} className="mt-5 text-sm font-semibold text-sky-100 underline decoration-white/30 underline-offset-4 hover:text-white">填写我的介绍 →</button></div><div className="campus-notes hidden lg:block"><span>兴趣：羽毛球</span><span>作息：00:00 前后</span><span>采光：都可以</span></div></section>
    <section className="grid gap-4 sm:grid-cols-2"><button onClick={onPeople} className="path-card group text-left"><span className="path-icon bg-sky-100 text-sky-800"><Users className="size-6" /></span><span><b>先看看同楼同学</b><small>按昵称、专业、兴趣或生活节奏寻找</small></span><ChevronRight className="ml-auto size-5 text-slate-300 transition-transform group-hover:translate-x-1" /></button><button onClick={onTeams} className="path-card group text-left"><span className="path-icon bg-amber-100 text-amber-800"><Compass className="size-6" /></span><span><b>再看看同行小队</b><small>了解小队的相处期待，先聊聊再决定</small></span><ChevronRight className="ml-auto size-5 text-slate-300 transition-transform group-hover:translate-x-1" /></button></section>
    <section><SectionTitle eyebrow="来自同楼的介绍" title="可以先安静地看看" action="查看更多" onAction={onPeople} /><div className="grid gap-4 lg:grid-cols-3">{matches.slice(0, 3).map((item) => <MiniMatch key={item.profile.id} result={item} onOpen={onPeople} />)}</div></section>
    <section className="grid gap-4 sm:grid-cols-3"><InfoTile icon={ShieldCheck} title="你来决定边界" text="联系方式只有双方都愿意时才会显示" /><InfoTile icon={MessageCircle} title="不急着下结论" text="生活线索只是聊天的开头，不是给人打分" /><InfoTile icon={Building2} title="只看相关同学" text={`优先展示${me.building}号楼、住宿范围相同的同学`} /></section>
  </div>;
}

function InfoTile({ icon: Icon, title, text }: { icon: typeof Home; title: string; text: string }) { return <div className="card flex gap-4 p-5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-800"><Icon className="size-5" /></span><div><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>; }
function MiniMatch({ result, onOpen }: { result: MatchResult; onOpen: () => void }) { return <button onClick={onOpen} className="card group flex items-center gap-4 p-4 text-left"><Avatar profile={result.profile} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{result.profile.nickname}</strong><Badge tone="yellow">{result.profile.building}号楼</Badge></div><p className="mt-1 truncate text-xs text-slate-500">{result.profile.major} · {result.profile.interests.slice(0, 2).join(" / ")}</p><p className="mt-2 truncate text-xs text-amber-800">{result.reasons[0]}</p></div><ChevronRight className="size-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-1" /></button>; }
function SectionTitle({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) { return <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">{eyebrow}</p><h2 className="mt-1 text-2xl font-black text-slate-900">{title}</h2></div>{action && <button onClick={onAction} className="text-sm font-semibold text-sky-700">{action} →</button>}</div>; }

function PlazaPage({ me, teams, type, setType, matches, liked, contacts, applied, onLike, onContact, onApply }: { me: Profile; teams: Team[]; type: "people" | "teams"; setType: (v: "people" | "teams") => void; matches: MatchResult[]; liked: Set<string>; contacts: Map<string, Profile["contact"]>; applied: Set<string>; onLike: (p: Profile) => void; onContact: (p: Profile) => void; onApply: (t: Team) => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "schedule" | "interest">("all");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleMatches = matches.filter((result) => {
    const profile = result.profile;
    const searchable = [profile.nickname, profile.major, profile.intro, ...profile.interests].join(" ").toLowerCase();
    const queryMatches = !normalizedQuery || searchable.includes(normalizedQuery);
    const filterMatches = filter === "all" || (filter === "schedule" ? result.schedule >= 78 : result.hobbies > 45);
    return queryMatches && filterMatches;
  });
  const visibleTeams = teams.filter((team) => !normalizedQuery || [team.name, team.summary, ...team.interests].join(" ").toLowerCase().includes(normalizedQuery));
  return <div><SectionTitle eyebrow={`${me.building}号楼 · 同楼社区`} title="按自己的节奏慢慢看" /><div className="mb-5 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4 text-sm leading-6 text-emerald-950"><b>对不太喜欢主动社交的同学也友好：</b>只看介绍、不发起联系完全可以。系统不会催促你回复，也不会把你的浏览记录告诉其他人。</div><div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="segmented"><button onClick={() => setType("people")} className={type === "people" ? "active" : ""}>同楼同学 <span className="ml-1 text-xs opacity-60">{matches.length}</span></button><button onClick={() => setType("teams")} className={type === "teams" ? "active" : ""}>同行小队 <span className="ml-1 text-xs opacity-60">{teams.length}</span></button></div><label className="search-box"><Search className="size-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={type === "people" ? "搜索昵称、专业、兴趣或介绍" : "搜索小队名称、兴趣或介绍"} /></label></div>{type === "people" && <div className="mb-6 flex flex-wrap items-center gap-2"><span className="mr-1 text-xs text-slate-400">更快找到：</span>{([{ id: "all", label: "全部介绍" }, { id: "schedule", label: "生活节奏较接近" }, { id: "interest", label: "有共同兴趣" }] as const).map((option) => <button key={option.id} onClick={() => setFilter(option.id)} className={`filter-chip ${filter === option.id ? "filter-chip-active" : ""}`}>{option.id === "schedule" && <Clock3 className="size-3.5" />}{option.label}</button>)}<span className="ml-auto text-xs text-slate-400">找到 {visibleMatches.length} 位同学</span></div>}{type === "people" ? <div className="grid gap-4 lg:grid-cols-2">{visibleMatches.length ? visibleMatches.map((r) => <ProfileCard key={r.profile.id} result={r} liked={liked.has(r.profile.id)} canContact={contacts.has(r.profile.id)} onLike={() => onLike(r.profile)} onContact={() => onContact(r.profile)} />) : <EmptyState text="暂时没有符合这些条件的介绍，可以换个关键词，或者看看全部同学" />}</div> : <div className="grid gap-4 lg:grid-cols-2">{visibleTeams.length ? visibleTeams.map((t) => <TeamCard key={t.id} team={t} applied={applied.has(t.id)} onApply={() => onApply(t)} />) : <EmptyState text="暂时没有找到符合这些关键词的小队，可以换个词再看看" />}</div>}</div>;
}

function RecommendPage({ matches, liked, contacts, onLike, onContact }: { matches: MatchResult[]; liked: Set<string>; contacts: Map<string, Profile["contact"]>; onLike: (p: Profile) => void; onContact: (p: Profile) => void }) {
  return <div><SectionTitle eyebrow="相处线索" title="为你整理的同楼介绍" /><div className="mb-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-900"><b>这里不是人物排名。</b>系统只把同楼、住宿范围相同的同学放在一起，并优先整理生活节奏和兴趣爱好较接近的介绍。数字不会展示给任何人，结果也不代表谁更好或一定更适合；不想主动联系时，只把这里当作信息整理页也可以。</div><div className="grid gap-5 lg:grid-cols-2">{matches.length ? matches.map((r) => <ProfileCard key={r.profile.id} result={r} liked={liked.has(r.profile.id)} canContact={contacts.has(r.profile.id)} onLike={() => onLike(r.profile)} onContact={() => onContact(r.profile)} />) : <EmptyState text="等你愿意留下简单介绍后，这里会为你整理一些同楼信息" />}</div></div>;
}

function TeamsPage({ me, teams, applied, onApply, onCreate }: { me: Profile; teams: Team[]; applied: Set<string>; onApply: (t: Team) => void; onCreate: () => void }) {
  return <div><div className="mb-6 flex items-end justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">{me.building}号楼同行空间</p><h1 className="mt-1 text-2xl font-black text-slate-900">我的小队与加入意向</h1></div><button onClick={onCreate} className="button button-primary"><UserPlus className="size-4" />发起一个小队</button></div><div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><b>关于提前组队的小提醒：</b>小队帮助大家约好选择同一宿舍号下的不同床位，但不会预留房间，也无法保证最终同住。可以先了解小队介绍，不需要立即申请或交流。</div><section className="card mb-8 p-6"><div className="flex items-start gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Users /></span><div className="flex-1"><h2 className="font-bold">加入前可以再确认</h2><p className="mt-1 text-sm text-slate-500">你可以先向多个小队留下意向。队长回应后，是否加入仍由你决定；加入一个小队后，系统会替你妥善结束其他意向。</p></div></div></section><SectionTitle eyebrow="同楼小队" title="正在开放加入的小队" /><div className="grid gap-4 lg:grid-cols-2">{teams.length ? teams.map((t) => <TeamCard key={t.id} team={t} applied={applied.has(t.id)} onApply={() => onApply(t)} />) : <EmptyState text="这里暂时还没有小队。如果你愿意，可以发起一个，也可以之后再来看看" />}</div></div>;
}

function MePage({ me, notices, onProfile }: { me: Profile; notices: Array<{ id: string; title: string; body: string; created_at: string }>; onProfile: () => void }) {
  return <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><section><SectionTitle eyebrow="属于你的空间" title="我的自我介绍" /><div className="card p-6"><div className="flex items-center gap-4"><Avatar profile={me} size="lg" /><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{me.nickname}</h2><Badge tone={me.verified ? "green" : "yellow"}>{me.verified ? "校园身份已确认" : "校园验证稍后开放"}</Badge></div><p className="mt-2 text-sm text-slate-500">{me.building}号楼 · {me.major}</p></div><button onClick={onProfile} className="button button-secondary">调整介绍</button></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Stat label="愿意分享的兴趣" value={`${me.interests.length}/8`} /><Stat label="广场可见状态" value="愿意被看见" /><Stat label="联系方式" value="由你和对方共同决定" /></div></div><h2 className="mb-3 mt-8 text-lg font-bold">给你的消息</h2><div className="card divide-y divide-slate-100">{notices.length ? notices.map((notice) => <Notice key={notice.id} icon={Bell} title={notice.title} text={notice.body} />) : <Notice icon={ShieldCheck} title="这里暂时很安静" text="认识意愿、小队回应和加入确认会在这里温和地提醒你" />}</div></section><aside className="space-y-4"><div className="card p-5"><h3 className="font-bold">你的隐私选择</h3><div className="mt-4 space-y-3 text-sm"><PrivacyRow icon={LockKeyhole} label="联系方式" value="彼此愿意后可见" /><PrivacyRow icon={ShieldCheck} label="校园身份" value={me.verified ? "已经确认" : "稍后开放确认"} /><PrivacyRow icon={Users} label="介绍可见范围" value={`${me.building}号楼住宿范围相同的同学`} /></div></div><div className="card p-5"><h3 className="font-bold">账户与数据</h3><p className="mt-2 text-sm leading-6 text-slate-500">目前使用的是仅保存在这个浏览器中的匿名账户。学校邮箱发放后可以选择绑定；本届选寝结束 30 天后，相关资料会自动清理。</p></div></aside></div>;
}

function EmptyState({ text }: { text: string }) { return <div className="card col-span-full grid min-h-40 place-items-center p-6 text-center text-sm text-slate-500">{text}</div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-50 p-4"><strong className="text-2xl text-sky-900">{value}</strong><span className="mt-1 block text-xs text-slate-500">{label}</span></div>; }
function Notice({ icon: Icon, title, text }: { icon: typeof Home; title: string; text: string }) { return <div className="flex gap-4 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-700"><Icon className="size-4" /></span><div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>; }
function PrivacyRow({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: string }) { return <div className="flex items-center gap-3"><Icon className="size-4 text-sky-700" /><span className="text-slate-500">{label}</span><b className="ml-auto text-xs">{value}</b></div>; }

function ContactModal({ profile, onClose }: { profile: Profile; onClose: () => void }) { return <Modal onClose={onClose}><div className="text-center"><Avatar profile={profile} size="lg" /><h2 className="mt-4 text-xl font-bold">你们都愿意再认识一点</h2><p className="mt-2 text-sm leading-6 text-slate-500">因为彼此都表达了意愿，现在可以交换联系方式。之后聊到什么程度、分享哪些信息，都可以按让自己舒服的节奏来。</p><div className="mt-6 rounded-2xl bg-sky-50 p-5"><span className="text-xs text-sky-700">{profile.contact.type}</span><strong className="mt-1 block text-lg text-sky-950">{profile.contact.value}</strong></div><button onClick={onClose} className="button button-primary mt-5 w-full">好，慢慢认识</button></div></Modal>; }

function DisclaimerModal({ onClose }: { onClose: () => void }) {
  const sections = [
    { title: "网站性质", text: "“线上组队”由宁波诺丁汉大学在校生个人制作与维护，是独立的第三方个人网站，并非学校官方选寝系统，也不代表学校、住宿管理部门或任何学生组织。学校名称及楼栋信息仅用于帮助同学理解相关场景；如网站信息与学校正式通知不一致，请以学校官方信息为准。" },
    { title: "服务说明", text: "网站希望为同学们提供一个自愿认识、交流和提前约伴的空间。相处参考、推荐结果与小队信息仅用于帮助开启交流，不构成对任何人的评价、承诺或保证，也不能预留宿舍、床位，无法保证成员最终入住同一宿舍。" },
    { title: "信息与交往边界", text: "请只分享真实、合法且让自己感到安心的内容，不要在公开介绍中填写真实姓名、手机号、微信号、QQ号等敏感信息。联系方式仅会在彼此同意进一步认识，或依照网站规则加入同一小队后显示。是否继续联系、见面或分享更多信息，始终由你自己决定；如感到不适，可以随时停止交流。" },
    { title: "内容与安全", text: "每位使用者应对自己发布的内容和交流行为负责。请勿发布骚扰、歧视、冒充、欺骗、违法或侵犯他人权益的内容。网站会在能力范围内维护社区秩序与资料安全，但互联网服务无法保证绝对稳定或绝对安全；请保持必要判断，并及时反馈可疑情况。" },
    { title: "责任范围", text: "使用者基于个人介绍、推荐结果或沟通内容作出的选择，属于个人自主决定。在法律允许的范围内，制作者不对因学校安排变化、选寝结果、用户自行发布的不实内容、第三方行为或不可抗力造成的间接损失承担责任；但本说明不会排除法律规定不得排除的责任。" },
    { title: "服务调整", text: "为保障网站运行和使用体验，功能、规则或开放时间可能根据实际情况调整，也可能因维护、安全风险或学校选寝安排而暂停。涉及个人资料的处理将遵循网站当时展示的隐私说明；本届选寝结束后，相关资料将依照网站公示的期限进行清理。" },
  ];
  return <Modal onClose={onClose} wide><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">使用前，彼此多一份安心</p><h2 className="mt-1 text-2xl font-black text-slate-900">免责声明与使用说明</h2></div><button type="button" className="icon-button shrink-0" onClick={onClose} aria-label="关闭免责声明"><X className="size-5" /></button></div><p className="mt-3 text-sm leading-6 text-slate-500">谢谢你愿意在这里认识新的同学。下面这些说明不是为了制造距离，而是希望每个人都能在清楚边界的前提下，更安心地交流。</p><div className="mt-6 space-y-5">{sections.map((section) => <section key={section.title}><h3 className="text-sm font-bold text-slate-800">{section.title}</h3><p className="mt-1 text-sm leading-7 text-slate-600">{section.text}</p></section>)}</div><div className="mt-6 rounded-2xl bg-sky-50 p-4 text-sm leading-6 text-sky-950"><b>有任何问题、建议或需要反馈的情况，欢迎联系：</b><a href="mailto:scymg5@nottingham.edu.cn" className="mt-1 block break-all font-semibold text-sky-800 underline decoration-sky-300 underline-offset-4">scymg5@nottingham.edu.cn</a></div><p className="mt-4 text-xs text-slate-400">最近更新：2026年7月20日</p><button onClick={onClose} className="button button-primary mt-5 w-full">我知道了</button></Modal>;
}

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
    if (!validSegment) { setError("这栋楼的住宿安排与刚才选择的信息不一致，请确认后再试。13、14号楼为女生宿舍，15、19号楼为男生宿舍；23号楼男女均可入住，但套间内为同性。"); return; }
    const interests = String(form.get("interests") || "").split(/[,，、\s]+/).map((item) => item.trim()).filter(Boolean);
    if (interests.length > 8) { setError("先留下 8 个以内最想分享的兴趣就好，也可以只写一两个。"); return; }
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
    } catch (cause) { setError(cause instanceof Error ? cause.message : "这次没有保存成功，请稍后再试。"); }
    finally { setSaving(false); }
  };
  return <Modal onClose={onClose} wide><form onSubmit={submit}><div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">{required ? "第一次填写" : "你的介绍"}</p><h2 className="mt-1 text-2xl font-black">{required ? "填写一份简单介绍" : "调整我的自我介绍"}</h2></div>{!required && <button type="button" className="icon-button" onClick={onClose}><X className="size-5" /></button>}</div><p className="mt-3 text-sm leading-6 text-slate-500">不用写得很详细，留下你愿意分享的部分就好。联系方式不会出现在公开介绍中，只有彼此都愿意进一步认识，或已经加入同一小队后才会显示。</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="希望大家怎么称呼你（必填）"><input name="nickname" required maxLength={24} defaultValue={profile.nickname} /></Field><Field label="选一个喜欢的头像符号"><input name="avatar" maxLength={4} defaultValue={profile.avatar} /></Field><Field label="住宿安排中的性别信息"><select name="gender" defaultValue={profile.gender}><option value="female">女生</option><option value="male">男生</option></select></Field><Field label="学校分配的宿舍楼"><select name="building" defaultValue={profile.building}>{["13", "14", "15", "19", "23"].map((building) => <option key={building} value={building}>{building}号楼</option>)}</select></Field><Field label="专业大类"><select name="major" defaultValue={profile.major}>{majors.map((major) => <option key={major}>{major}</option>)}</select></Field><Field label="对房间采光的期待"><select name="orientation" defaultValue={profile.orientation}><option>阳面</option><option>阴面</option><option>都可以</option></select></Field><Field label="工作日通常几点准备休息（必填）"><select name="weekdaySleep" defaultValue={profile.weekdaySleep}>{sleepSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></Field><Field label="周末通常几点准备休息（必填）"><select name="weekendSleep" defaultValue={profile.weekendSleep}>{sleepSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></Field><Field label="工作日通常几点开始新一天（必填）"><select name="weekdayWake" defaultValue={profile.weekdayWake}>{wakeSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></Field><Field label="周末通常几点开始新一天（必填）"><select name="weekendWake" defaultValue={profile.weekendWake}>{wakeSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></Field><Field label="希望用哪种方式联系"><select name="contactType" defaultValue={profile.contact.type}><option>微信</option><option>QQ</option></select></Field><Field label="联系方式（仅彼此同意后显示）"><input name="contactValue" required maxLength={64} defaultValue={profile.contact.value} /></Field><div className="sm:col-span-2"><Field label="兴趣爱好（可选，最多8个）"><input name="interests" defaultValue={profile.interests.join("、")} placeholder="例如：羽毛球、摄影、电影；写一两个也可以" /></Field></div><Field label="是否愿意出现在同楼页面"><select name="visible" defaultValue="true"><option value="true">愿意被同楼同学看见</option><option value="false">暂时只留给自己</option></select></Field><div className="sm:col-span-2"><Field label="其他想补充的内容（可选，最多200字）"><textarea name="intro" defaultValue={profile.intro} rows={3} maxLength={200} placeholder="可以写生活习惯、对寝室的期待，也可以留空" /><small className="mt-1 block text-xs text-slate-400">真实姓名、手机号、微信号等信息请留在受保护的联系方式中。</small></Field></div></div><div className="mt-5 space-y-2">{["我已了解：这是第三方个人网站，并非学校官方系统", "我已了解：提前组队不会预留房间，也无法保证最终同住", "我愿意只在公开介绍中分享让自己感到安心的内容"].map((label, i) => <label key={label} className="flex items-start gap-3 text-xs leading-5 text-slate-600"><input type="checkbox" checked={checked[i]} onChange={() => setChecked(checked.map((v, j) => j === i ? !v : v))} className="mt-1" />{label}</label>)}</div>{error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<button type="submit" disabled={!checked.every(Boolean) || saving} className="button button-primary mt-6 w-full disabled:opacity-40">{saving ? "正在妥善保存…" : "保存这份介绍"}</button></form></Modal>;
}

function CreateTeamModal({ me, onClose, onSave }: { me: Profile; onClose: () => void; onSave: (input: { name: string; summary: string; orientation: Profile["orientation"] }) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <Modal onClose={onClose}><form onSubmit={async (event) => { event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget); try { await onSave({ name: String(form.get("name")), summary: String(form.get("summary")), orientation: form.get("orientation") as Profile["orientation"] }); } catch (cause) { setError(cause instanceof Error ? cause.message : "这次没有创建成功，请稍后再试。"); } finally { setSaving(false); } }}><div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">{me.building}号楼</p><h2 className="mt-1 text-2xl font-black">发起一个小队</h2></div><button type="button" className="icon-button" onClick={onClose}><X className="size-5" /></button></div><p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">这是邀请大家彼此认识的起点，不会预留任何房间。{me.building === "23" ? "小队最多8人；按照住宿安排，同一套间内为同性。" : "小队最多4人。"}</p><div className="mt-5 space-y-4"><Field label="给小队起个名字"><input name="name" required minLength={1} maxLength={32} placeholder="例如：一起看日落的小队" /></Field><Field label="对房间采光的共同期待"><select name="orientation" defaultValue={me.orientation}><option>阳面</option><option>阴面</option><option>都可以</option></select></Field><Field label="想对未来队友说的话"><textarea name="summary" required maxLength={240} rows={4} defaultValue={`我们来自${me.building}号楼，希望在尊重彼此空间的同时，也能自在地沟通。共同兴趣可能有${me.interests.slice(0, 3).join("、") || "一起探索校园"}，也欢迎不一样的你。`} /></Field></div>{error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<button type="submit" disabled={saving} className="button button-primary mt-6 w-full disabled:opacity-40">{saving ? "正在准备小队…" : "发起小队"}</button></form></Modal>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) { return <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}><div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-[2rem] ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}>{children}</div></div>; }
