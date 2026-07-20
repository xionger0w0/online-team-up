"use client";

import {
  AlertTriangle, Bell, Check, ChevronRight, CircleUserRound,
  Coffee, Compass, Flag, Hash, Home, LockKeyhole, Megaphone, Menu, MessageCircle,
  Radio, Search, Send, ShieldCheck, Sparkles, Trash2, UserPlus, Users, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { currentUser as demoCurrentUser, lobbyComments as demoLobbyComments, lobbyPosts as demoLobbyPosts, majors, profiles as demoProfiles, teams as demoTeams } from "@/lib/mock-data";
import { rankMatches } from "@/lib/matching";
import type { LobbyComment, LobbyPost, LobbyPostKind, MatchResult, Profile, Team } from "@/lib/types";
import { createClient, ensureAnonymousSession, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  addLobbyComment, applyToTeam, createTeam, deleteLobbyComment, deleteLobbyPost, getMyProfile,
  getUnlockedContact, listAppliedTeamIds, listLikedProfileIds, listLobbyComments, listLobbyPosts,
  listNotifications, listProfiles, listTeams, listUnlockedContacts, publishLobbyPost, reportLobbyPost,
  saveProfile, setReaction, type ProfileInput,
} from "@/lib/supabase/data";

type Tab = "home" | "plaza" | "recommend" | "teams" | "me";

const navItems: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: "home", label: "首页", icon: Home },
  { id: "plaza", label: "公共大厅", icon: Hash },
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
  const [me, setMe] = useState<Profile>(demoCurrentUser);
  const [people, setPeople] = useState<Profile[]>(demoProfiles);
  const [teamList, setTeamList] = useState<Team[]>(demoTeams);
  const [lobbyPosts, setLobbyPosts] = useState<LobbyPost[]>(demoLobbyPosts);
  const [selectedLobbyPost, setSelectedLobbyPost] = useState<LobbyPost | null>(null);
  const [lobbyComments, setLobbyComments] = useState<LobbyComment[]>(demoLobbyComments);
  const [sessionUserId, setSessionUserId] = useState("");
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
    const [otherProfiles, visibleTeams, likedIds, appliedIds, unlocked, notificationRows, publicPosts] = await Promise.all([
      listProfiles(supabase, userId), listTeams(supabase), listLikedProfileIds(supabase, userId),
      listAppliedTeamIds(supabase, userId), listUnlockedContacts(supabase, userId), listNotifications(supabase, userId),
      listLobbyPosts(supabase, userId),
    ]);
    setMe(own);
    setPeople(otherProfiles);
    setTeamList(visibleTeams);
    setLiked(likedIds);
    setApplied(appliedIds);
    setContacts(unlocked);
    setNotices(notificationRows as Array<{ id: string; title: string; body: string; created_at: string }>);
    setLobbyPosts(publicPosts);
    setNeedsProfile(false);
  };

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let currentUserId = "";
    const lobbyChannel = supabase.channel("public-lobby-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "lobby_posts" }, async () => {
        if (!currentUserId) return;
        const posts = await listLobbyPosts(supabase, currentUserId);
        if (active) setLobbyPosts(posts);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "lobby_comments" }, async () => {
        if (!currentUserId) return;
        const posts = await listLobbyPosts(supabase, currentUserId);
        if (active) setLobbyPosts(posts);
      })
      .subscribe();
    (async () => {
      try {
        const session = await ensureAnonymousSession();
        if (!session) throw new Error("暂时没能为你建立浏览器账户");
        currentUserId = session.user.id;
        if (active) setSessionUserId(session.user.id);
        if (active) await refreshLiveData(session.user.id);
      } catch (error) {
        if (active) setConnectionError(error instanceof Error ? error.message : "暂时没能连接到线上资料");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; void supabase.removeChannel(lobbyChannel); };
  // Supabase 客户端在组件生命周期内保持不变。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !selectedLobbyPost || !sessionUserId) return;
    let active = true;
    const refreshComments = async () => {
      const comments = await listLobbyComments(supabase, selectedLobbyPost.id, sessionUserId);
      if (active) setLobbyComments(comments);
    };
    void refreshComments();
    const commentChannel = supabase.channel(`lobby-comments-${selectedLobbyPost.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lobby_comments", filter: `post_id=eq.${selectedLobbyPost.id}` }, refreshComments)
      .subscribe();
    return () => { active = false; void supabase.removeChannel(commentChannel); };
  }, [selectedLobbyPost, sessionUserId, supabase]);

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

  const handlePublishLobby = async (kind: LobbyPostKind, body: string) => {
    if (!supabase) {
      const post: LobbyPost = { id: `demo-${Date.now()}`, kind, body: body.trim(), createdAt: new Date().toISOString(), commentCount: 0, isMine: true, author: me };
      setLobbyPosts([post, ...lobbyPosts]);
      notify(kind === "recruitment" ? "招募信息已经发布" : "消息已经发送到公共大厅");
      return;
    }
    await publishLobbyPost(supabase, kind, body);
    setLobbyPosts(await listLobbyPosts(supabase, sessionUserId));
  };

  const handleOpenLobbyComments = async (post: LobbyPost) => {
    setSelectedLobbyPost(post);
    if (!supabase) setLobbyComments(demoLobbyComments.filter((comment) => comment.postId === post.id));
    else setLobbyComments(await listLobbyComments(supabase, post.id, sessionUserId));
  };

  const handleAddLobbyComment = async (postId: string, body: string) => {
    if (!supabase) {
      const comment: LobbyComment = { id: `demo-comment-${Date.now()}`, postId, body: body.trim(), createdAt: new Date().toISOString(), isMine: true, author: me };
      setLobbyComments([...lobbyComments, comment]);
      setLobbyPosts(lobbyPosts.map((post) => post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post));
      return;
    }
    await addLobbyComment(supabase, postId, body);
    const [comments, posts] = await Promise.all([listLobbyComments(supabase, postId, sessionUserId), listLobbyPosts(supabase, sessionUserId)]);
    setLobbyComments(comments);
    setLobbyPosts(posts);
  };

  const handleDeleteLobbyPost = async (postId: string) => {
    if (!supabase) setLobbyPosts(lobbyPosts.filter((post) => post.id !== postId));
    else {
      await deleteLobbyPost(supabase, postId);
      setLobbyPosts(await listLobbyPosts(supabase, sessionUserId));
    }
    if (selectedLobbyPost?.id === postId) setSelectedLobbyPost(null);
    notify("这条信息已经删除");
  };

  const handleDeleteLobbyComment = async (commentId: string) => {
    if (!selectedLobbyPost) return;
    if (!supabase) setLobbyComments(lobbyComments.filter((comment) => comment.id !== commentId));
    else {
      await deleteLobbyComment(supabase, commentId);
      setLobbyComments(await listLobbyComments(supabase, selectedLobbyPost.id, sessionUserId));
    }
    notify("留言已经删除");
  };

  const handleReportLobbyPost = async (postId: string) => {
    if (supabase) await reportLobbyPost(supabase, postId, "请管理员查看这条公共大厅信息");
    notify("反馈已经收到，管理员会尽快查看");
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
          {tab === "home" && <HomePage me={me} matches={matches} onLobby={() => setTab("plaza")} onPeople={() => setTab("recommend")} onTeams={() => setTab("teams")} onProfile={() => setShowProfile(true)} />}
          {tab === "plaza" && <LobbyPage me={me} posts={lobbyPosts} onPublish={handlePublishLobby} onComments={handleOpenLobbyComments} onDelete={handleDeleteLobbyPost} onReport={handleReportLobbyPost} onProfile={() => setShowProfile(true)} />}
          {tab === "recommend" && <RecommendPage matches={matches} liked={liked} contacts={contacts} onLike={toggleLike} onContact={openContact} />}
          {tab === "teams" && <TeamsPage teams={teamList} applied={applied} onApply={applyTeam} onCreate={() => setShowCreateTeam(true)} />}
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
      {selectedLobbyPost && <LobbyCommentsModal key={selectedLobbyPost.id} post={selectedLobbyPost} comments={lobbyComments} onAdd={handleAddLobbyComment} onDelete={handleDeleteLobbyComment} onClose={() => setSelectedLobbyPost(null)} />}
      {showDisclaimer && <DisclaimerModal onClose={() => setShowDisclaimer(false)} />}
      {menuOpen && <div className="fixed inset-0 z-50 bg-slate-950/25 md:hidden" onClick={() => setMenuOpen(false)}><div className="absolute right-4 top-19 w-48 rounded-2xl bg-white p-2 shadow-xl">{navItems.map(({ id, label }) => <button key={id} onClick={() => { setTab(id); setMenuOpen(false); }} className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium hover:bg-slate-50">{label}</button>)}</div></div>}
    </div>
  );
}

function HomePage({ me, matches, onLobby, onPeople, onTeams, onProfile }: { me: Profile; matches: MatchResult[]; onLobby: () => void; onPeople: () => void; onTeams: () => void; onProfile: () => void }) {
  return <div className="space-y-8">
    <section className="hero-panel overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14"><div className="relative z-10 max-w-2xl"><Badge tone="yellow">2026 新生 · 公共组队大厅</Badge><h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl">在同一个大厅里，<br /><span className="text-amber-300">看看大家在说什么</span></h1><p className="mt-5 max-w-xl text-base leading-7 text-sky-100 sm:text-lg">不再按宿舍楼分开。可以查看实时消息、发布组队招募，也可以只在感兴趣的信息下面留一句话。</p><div className="mt-8 flex flex-wrap gap-3"><button onClick={onLobby} className="button bg-amber-300 px-6 py-3 text-sky-950 hover:bg-amber-200"><Hash className="size-5" />进入公共大厅</button><button onClick={onTeams} className="button border border-white/20 bg-white/10 px-6 py-3 text-white hover:bg-white/15"><Compass className="size-5" />查看小队</button></div><button onClick={onProfile} className="mt-5 text-sm font-semibold text-sky-100 underline decoration-white/30 underline-offset-4 hover:text-white">填写我的介绍 →</button></div><div className="campus-notes hidden lg:block"><span>15号楼｜找2人</span><span>兴趣：羽毛球</span><span>可以直接留言</span></div></section>
    <section className="grid gap-4 sm:grid-cols-2"><button onClick={onLobby} className="path-card group text-left"><span className="path-icon bg-sky-100 text-sky-800"><Radio className="size-6" /></span><span><b>公共大厅实时信息</b><small>聊天、发布招募或查看最新消息</small></span><ChevronRight className="ml-auto size-5 text-slate-300 transition-transform group-hover:translate-x-1" /></button><button onClick={onPeople} className="path-card group text-left"><span className="path-icon bg-amber-100 text-amber-800"><Users className="size-6" /></span><span><b>查看个人介绍</b><small>按作息与兴趣爱好整理相关信息</small></span><ChevronRight className="ml-auto size-5 text-slate-300 transition-transform group-hover:translate-x-1" /></button></section>
    <section><SectionTitle eyebrow="一些个人介绍" title="也可以先安静地看看" action="查看更多" onAction={onPeople} /><div className="grid gap-4 lg:grid-cols-3">{matches.slice(0, 3).map((item) => <MiniMatch key={item.profile.id} result={item} onOpen={onPeople} />)}</div></section>
    <section className="grid gap-4 sm:grid-cols-3"><InfoTile icon={Radio} title="同一个公共大厅" text="所有楼栋的实时消息都在同一条信息流中" /><InfoTile icon={MessageCircle} title="可以聊天，也可以留言" text="不需要进入快速对话，按自己的节奏回复即可" /><InfoTile icon={ShieldCheck} title="住宿条件仍会核对" text={`你目前是${me.building}号楼，申请加入小队时会再次确认条件`} /></section>
  </div>;
}

function InfoTile({ icon: Icon, title, text }: { icon: typeof Home; title: string; text: string }) { return <div className="card flex gap-4 p-5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-800"><Icon className="size-5" /></span><div><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>; }
function MiniMatch({ result, onOpen }: { result: MatchResult; onOpen: () => void }) { return <button onClick={onOpen} className="card group flex items-center gap-4 p-4 text-left"><Avatar profile={result.profile} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong>{result.profile.nickname}</strong><Badge tone="yellow">{result.profile.building}号楼</Badge></div><p className="mt-1 truncate text-xs text-slate-500">{result.profile.major} · {result.profile.interests.slice(0, 2).join(" / ")}</p><p className="mt-2 truncate text-xs text-amber-800">{result.reasons[0]}</p></div><ChevronRight className="size-5 shrink-0 text-slate-300 transition-transform group-hover:translate-x-1" /></button>; }
function SectionTitle({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) { return <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">{eyebrow}</p><h2 className="mt-1 text-2xl font-black text-slate-900">{title}</h2></div>{action && <button onClick={onAction} className="text-sm font-semibold text-sky-700">{action} →</button>}</div>; }

function LobbyPage({ me, posts, onPublish, onComments, onDelete, onReport, onProfile }: { me: Profile; posts: LobbyPost[]; onPublish: (kind: LobbyPostKind, body: string) => Promise<void>; onComments: (post: LobbyPost) => Promise<void>; onDelete: (postId: string) => Promise<void>; onReport: (postId: string) => Promise<void>; onProfile: () => void }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | LobbyPostKind>("all");
  const [kind, setKind] = useState<LobbyPostKind>("chat");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const normalizedQuery = query.trim().toLowerCase();
  const visiblePosts = posts.filter((post) => {
    const searchable = [post.body, post.author.nickname, post.author.major, `${post.author.building}号楼`].join(" ").toLowerCase();
    return (filter === "all" || post.kind === filter) && (!normalizedQuery || searchable.includes(normalizedQuery));
  });
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true);
    setError("");
    try {
      await onPublish(kind, body);
      setBody("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "这次没有发送成功，请稍后再试");
    } finally { setSending(false); }
  };
  const channels = [
    { id: "all" as const, label: "全部消息", icon: Hash, count: posts.length },
    { id: "chat" as const, label: "普通聊天", icon: MessageCircle, count: posts.filter((post) => post.kind === "chat").length },
    { id: "recruitment" as const, label: "组队招募", icon: Megaphone, count: posts.filter((post) => post.kind === "recruitment").length },
  ];
  return <div className="lobby-layout"><aside className="lobby-sidebar card"><div className="border-b border-slate-100 p-4"><p className="text-xs font-bold tracking-[.16em] text-sky-700">线上组队</p><h1 className="mt-1 text-lg font-black text-slate-900">公共大厅</h1><p className="mt-1 text-xs leading-5 text-slate-500">所有楼栋在同一个信息流中</p></div><nav className="space-y-1 p-2">{channels.map(({ id, label, icon: Icon, count }) => <button key={id} onClick={() => setFilter(id)} className={`lobby-channel ${filter === id ? "lobby-channel-active" : ""}`}><Icon className="size-4" /><span>{label}</span><small>{count}</small></button>)}</nav><div className="m-3 rounded-2xl bg-slate-50 p-3"><div className="flex items-center gap-3"><Avatar profile={me} size="sm" /><div className="min-w-0"><b className="block truncate text-sm">{me.nickname}</b><span className="text-[11px] text-slate-400">{me.building}号楼 · 当前身份</span></div></div><button onClick={onProfile} className="mt-3 w-full text-left text-xs font-semibold text-sky-700">调整我的介绍 →</button></div></aside><section className="lobby-stream card overflow-hidden"><header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-800"><Hash className="size-5" /></span><div><div className="flex items-center gap-2"><h2 className="font-black text-slate-900">公共组队大厅</h2><span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700"><span className="size-2 rounded-full bg-emerald-500" />实时</span></div><p className="text-xs text-slate-500">聊天、招募和留言都在这里</p></div></div><label className="search-box sm:max-w-72"><Search className="size-4" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索消息、昵称、专业或楼栋" /></label></header><form onSubmit={submit} className="border-b border-slate-100 bg-[#fbfcfa] p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="segmented compact"><button type="button" onClick={() => setKind("chat")} className={kind === "chat" ? "active" : ""}><MessageCircle className="size-3.5" />普通消息</button><button type="button" onClick={() => setKind("recruitment")} className={kind === "recruitment" ? "active" : ""}><Megaphone className="size-3.5" />组队招募</button></div><span className="text-xs text-slate-400">{body.length}/500</span></div><div className="flex items-end gap-2"><textarea value={body} onChange={(event) => setBody(event.target.value.slice(0, 500))} rows={2} className="lobby-composer" placeholder={kind === "chat" ? "写一条消息；不需要马上回复其他人" : "可以写楼栋、房型、目前人数、作息和兴趣爱好"} /><button type="submit" disabled={sending || !body.trim()} className="button button-primary shrink-0 disabled:opacity-40"><Send className="size-4" /><span className="hidden sm:inline">{sending ? "发送中" : "发布"}</span></button></div>{error && <p className="mt-2 text-xs text-rose-700">{error}</p>}</form><div className="lobby-feed"><div className="flex items-center justify-between px-4 pb-1 pt-4 text-xs text-slate-400"><span>{filter === "all" ? "全部最新消息" : filter === "chat" ? "普通聊天" : "组队招募"}</span><span>{visiblePosts.length} 条</span></div>{visiblePosts.length ? visiblePosts.map((post) => <LobbyPostItem key={post.id} post={post} onComments={() => void onComments(post)} onDelete={() => void onDelete(post.id)} onReport={() => { if (window.confirm("要把这条信息交给管理员查看吗？")) void onReport(post.id); }} />) : <EmptyState text="这里暂时没有符合条件的消息，可以换个关键词或发布第一条" />}</div></section><aside className="lobby-info space-y-4"><div className="card p-5"><div className="flex items-center gap-2"><Radio className="size-4 text-emerald-600" /><h3 className="font-bold">大厅说明</h3></div><div className="mt-4 space-y-3 text-xs leading-5 text-slate-500"><p>所有楼栋都能看到同一条信息流，楼栋与性别只作为信息标签。</p><p>发布招募不代表锁定宿舍；正式加入小队时仍会核对住宿条件。</p><p>只看消息、不参与聊天完全可以，也不需要即时回复。</p></div></div><div className="card p-5"><h3 className="font-bold">交流边界</h3><div className="mt-3 space-y-2 text-xs leading-5 text-slate-500"><p>• 不要在公开消息中留下微信、QQ 或手机号</p><p>• 不发布骚扰、歧视、冒充或虚假招募内容</p><p>• 遇到不合适的内容可以直接反馈</p></div></div></aside></div>;
}

function LobbyPostItem({ post, onComments, onDelete, onReport }: { post: LobbyPost; onComments: () => void; onDelete: () => void; onReport: () => void }) {
  const time = new Date(post.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  return <article className={`lobby-message ${post.kind === "recruitment" ? "lobby-message-recruitment" : ""}`}><Avatar profile={post.author} size="sm" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-slate-900">{post.author.nickname}</b><span className="text-[11px] text-slate-400">{post.author.building}号楼 · {post.author.major}</span>{post.kind === "recruitment" && <Badge tone="yellow">组队招募</Badge>}<time className="text-[10px] text-slate-300">{time}</time></div><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{post.body}</p><div className="mt-2 flex flex-wrap items-center gap-3"><button onClick={onComments} className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700"><MessageCircle className="size-3.5" />{post.commentCount ? `${post.commentCount} 条留言` : "留言"}</button>{post.isMine ? <button onClick={onDelete} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-700"><Trash2 className="size-3.5" />删除</button> : <button onClick={onReport} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-amber-700"><Flag className="size-3.5" />反馈</button>}</div></div></article>;
}

function RecommendPage({ matches, liked, contacts, onLike, onContact }: { matches: MatchResult[]; liked: Set<string>; contacts: Map<string, Profile["contact"]>; onLike: (p: Profile) => void; onContact: (p: Profile) => void }) {
  return <div><SectionTitle eyebrow="相处线索" title="与住宿条件相符的个人介绍" /><div className="mb-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-900"><b>这里不是人物排名。</b>公共大厅向所有人开放；这一页只是在后台核对住宿条件后，优先整理生活节奏和兴趣爱好较接近的介绍。数字不会展示给任何人，结果也不代表谁更好或一定更适合。</div><div className="grid gap-5 lg:grid-cols-2">{matches.length ? matches.map((r) => <ProfileCard key={r.profile.id} result={r} liked={liked.has(r.profile.id)} canContact={contacts.has(r.profile.id)} onLike={() => onLike(r.profile)} onContact={() => onContact(r.profile)} />) : <EmptyState text="等你愿意留下简单介绍后，这里会整理一些住宿条件相符的信息" />}</div></div>;
}

function TeamsPage({ teams, applied, onApply, onCreate }: { teams: Team[]; applied: Set<string>; onApply: (t: Team) => void; onCreate: () => void }) {
  return <div><div className="mb-6 flex items-end justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">公共组队空间</p><h1 className="mt-1 text-2xl font-black text-slate-900">小队与加入意向</h1></div><button onClick={onCreate} className="button button-primary"><UserPlus className="size-4" />发起一个小队</button></div><div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><b>关于提前组队的小提醒：</b>这里会显示所有楼栋的小队，但只有住宿条件相符时才能申请加入。小队不会预留房间，也无法保证最终同住。</div><section className="card mb-8 p-6"><div className="flex items-start gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Users /></span><div className="flex-1"><h2 className="font-bold">加入前可以再确认</h2><p className="mt-1 text-sm text-slate-500">你可以先查看所有小队。留下意向时系统会核对楼栋和住宿安排；队长回应后，是否加入仍由你决定。</p></div></div></section><SectionTitle eyebrow="全部小队" title="正在开放加入的小队" /><div className="grid gap-4 lg:grid-cols-2">{teams.length ? teams.map((t) => <TeamCard key={t.id} team={t} applied={applied.has(t.id)} onApply={() => onApply(t)} />) : <EmptyState text="这里暂时还没有小队。如果你愿意，可以发起一个，也可以之后再来看看" />}</div></div>;
}

function MePage({ me, notices, onProfile }: { me: Profile; notices: Array<{ id: string; title: string; body: string; created_at: string }>; onProfile: () => void }) {
  return <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><section><SectionTitle eyebrow="属于你的空间" title="我的自我介绍" /><div className="card p-6"><div className="flex items-center gap-4"><Avatar profile={me} size="lg" /><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{me.nickname}</h2><Badge tone={me.verified ? "green" : "yellow"}>{me.verified ? "校园身份已确认" : "校园验证稍后开放"}</Badge></div><p className="mt-2 text-sm text-slate-500">{me.building}号楼 · {me.major}</p></div><button onClick={onProfile} className="button button-secondary">调整介绍</button></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Stat label="愿意分享的兴趣" value={`${me.interests.length}/8`} /><Stat label="公开状态" value="愿意被看见" /><Stat label="联系方式" value="由你和对方共同决定" /></div></div><h2 className="mb-3 mt-8 text-lg font-bold">给你的消息</h2><div className="card divide-y divide-slate-100">{notices.length ? notices.map((notice) => <Notice key={notice.id} icon={Bell} title={notice.title} text={notice.body} />) : <Notice icon={ShieldCheck} title="这里暂时很安静" text="认识意愿、小队回应和加入确认会在这里温和地提醒你" />}</div></section><aside className="space-y-4"><div className="card p-5"><h3 className="font-bold">你的隐私选择</h3><div className="mt-4 space-y-3 text-sm"><PrivacyRow icon={LockKeyhole} label="联系方式" value="彼此愿意后可见" /><PrivacyRow icon={ShieldCheck} label="校园身份" value={me.verified ? "已经确认" : "稍后开放确认"} /><PrivacyRow icon={Users} label="介绍可见范围" value="公共大厅中的其他使用者" /></div></div><div className="card p-5"><h3 className="font-bold">账户与数据</h3><p className="mt-2 text-sm leading-6 text-slate-500">目前使用的是仅保存在这个浏览器中的匿名账户。学校邮箱发放后可以选择绑定；本届选寝结束 30 天后，相关资料会自动清理。</p></div></aside></div>;
}

function EmptyState({ text }: { text: string }) { return <div className="card col-span-full grid min-h-40 place-items-center p-6 text-center text-sm text-slate-500">{text}</div>; }
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-50 p-4"><strong className="text-2xl text-sky-900">{value}</strong><span className="mt-1 block text-xs text-slate-500">{label}</span></div>; }
function Notice({ icon: Icon, title, text }: { icon: typeof Home; title: string; text: string }) { return <div className="flex gap-4 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-700"><Icon className="size-4" /></span><div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>; }
function PrivacyRow({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: string }) { return <div className="flex items-center gap-3"><Icon className="size-4 text-sky-700" /><span className="text-slate-500">{label}</span><b className="ml-auto text-xs">{value}</b></div>; }

function ContactModal({ profile, onClose }: { profile: Profile; onClose: () => void }) { return <Modal onClose={onClose}><div className="text-center"><Avatar profile={profile} size="lg" /><h2 className="mt-4 text-xl font-bold">你们都愿意再认识一点</h2><p className="mt-2 text-sm leading-6 text-slate-500">因为彼此都表达了意愿，现在可以交换联系方式。之后聊到什么程度、分享哪些信息，都可以按让自己舒服的节奏来。</p><div className="mt-6 rounded-2xl bg-sky-50 p-5"><span className="text-xs text-sky-700">{profile.contact.type}</span><strong className="mt-1 block text-lg text-sky-950">{profile.contact.value}</strong></div><button onClick={onClose} className="button button-primary mt-5 w-full">好，慢慢认识</button></div></Modal>; }

function LobbyCommentsModal({ post, comments, onAdd, onDelete, onClose }: { post: LobbyPost; comments: LobbyComment[]; onAdd: (postId: string, body: string) => Promise<void>; onDelete: (commentId: string) => Promise<void>; onClose: () => void }) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!body.trim()) return;
    setSaving(true);
    setError("");
    try { await onAdd(post.id, body); setBody(""); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "这次没有发送成功，请稍后再试"); }
    finally { setSaving(false); }
  };
  return <Modal onClose={onClose} wide><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">帖内留言</p><h2 className="mt-1 text-2xl font-black text-slate-900">围绕这条信息慢慢交流</h2></div><button type="button" className="icon-button shrink-0" onClick={onClose} aria-label="关闭留言"><X className="size-5" /></button></div><div className="mt-5 rounded-2xl bg-[#f7f7f2] p-4"><div className="flex items-center gap-3"><Avatar profile={post.author} size="sm" /><div><b className="text-sm">{post.author.nickname}</b><p className="text-xs text-slate-400">{post.author.building}号楼 · {post.author.major}</p></div></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.body}</p></div><div className="mt-5 max-h-72 space-y-1 overflow-y-auto rounded-2xl border border-slate-100 p-2">{comments.length ? comments.map((comment) => <div key={comment.id} className="flex gap-3 rounded-xl p-3 hover:bg-slate-50"><Avatar profile={comment.author} size="sm" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-xs">{comment.author.nickname}</b><span className="text-[10px] text-slate-400">{comment.author.building}号楼 · {new Date(comment.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })}</span>{comment.isMine && <button onClick={() => void onDelete(comment.id)} className="ml-auto text-[10px] text-slate-400 hover:text-rose-700">删除</button>}</div><p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-600">{comment.body}</p></div></div>) : <p className="p-6 text-center text-sm text-slate-400">暂时还没有留言。只查看、不回复也完全可以。</p>}</div><form onSubmit={submit} className="mt-4"><div className="flex items-end gap-2"><textarea value={body} onChange={(event) => setBody(event.target.value.slice(0, 300))} rows={2} className="lobby-composer" placeholder="留下一句话；对方不需要即时回复" /><button type="submit" disabled={saving || !body.trim()} className="button button-primary shrink-0 disabled:opacity-40"><Send className="size-4" />留言</button></div><div className="mt-2 flex items-center justify-between"><span className="text-xs text-slate-400">{body.length}/300</span>{error && <span className="text-xs text-rose-700">{error}</span>}</div></form></Modal>;
}

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
  return <Modal onClose={onClose} wide><form onSubmit={submit}><div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">{required ? "第一次填写" : "你的介绍"}</p><h2 className="mt-1 text-2xl font-black">{required ? "填写一份简单介绍" : "调整我的自我介绍"}</h2></div>{!required && <button type="button" className="icon-button" onClick={onClose}><X className="size-5" /></button>}</div><p className="mt-3 text-sm leading-6 text-slate-500">不用写得很详细，留下你愿意分享的部分就好。联系方式不会出现在公开介绍中，只有彼此都愿意进一步认识，或已经加入同一小队后才会显示。</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="希望大家怎么称呼你（必填）"><input name="nickname" required maxLength={24} defaultValue={profile.nickname} /></Field><Field label="选一个喜欢的头像符号"><input name="avatar" maxLength={4} defaultValue={profile.avatar} /></Field><Field label="住宿安排中的性别信息"><select name="gender" defaultValue={profile.gender}><option value="female">女生</option><option value="male">男生</option></select></Field><Field label="学校分配的宿舍楼"><select name="building" defaultValue={profile.building}>{["13", "14", "15", "19", "23"].map((building) => <option key={building} value={building}>{building}号楼</option>)}</select></Field><Field label="专业大类"><select name="major" defaultValue={profile.major}>{majors.map((major) => <option key={major}>{major}</option>)}</select></Field><Field label="对房间采光的期待"><select name="orientation" defaultValue={profile.orientation}><option>阳面</option><option>阴面</option><option>都可以</option></select></Field><Field label="工作日通常几点准备休息（必填）"><select name="weekdaySleep" defaultValue={profile.weekdaySleep}>{sleepSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></Field><Field label="周末通常几点准备休息（必填）"><select name="weekendSleep" defaultValue={profile.weekendSleep}>{sleepSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></Field><Field label="工作日通常几点开始新一天（必填）"><select name="weekdayWake" defaultValue={profile.weekdayWake}>{wakeSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></Field><Field label="周末通常几点开始新一天（必填）"><select name="weekendWake" defaultValue={profile.weekendWake}>{wakeSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></Field><Field label="希望用哪种方式联系"><select name="contactType" defaultValue={profile.contact.type}><option>微信</option><option>QQ</option></select></Field><Field label="联系方式（仅彼此同意后显示）"><input name="contactValue" required maxLength={64} defaultValue={profile.contact.value} /></Field><div className="sm:col-span-2"><Field label="兴趣爱好（可选，最多8个）"><input name="interests" defaultValue={profile.interests.join("、")} placeholder="例如：羽毛球、摄影、电影；写一两个也可以" /></Field></div><Field label="是否愿意公开介绍"><select name="visible" defaultValue="true"><option value="true">愿意在公共大厅中被看见</option><option value="false">暂时只留给自己</option></select></Field><div className="sm:col-span-2"><Field label="其他想补充的内容（可选，最多200字）"><textarea name="intro" defaultValue={profile.intro} rows={3} maxLength={200} placeholder="可以写生活习惯、对寝室的期待，也可以留空" /><small className="mt-1 block text-xs text-slate-400">真实姓名、手机号、微信号等信息请留在受保护的联系方式中。</small></Field></div></div><div className="mt-5 space-y-2">{["我已了解：这是第三方个人网站，并非学校官方系统", "我已了解：提前组队不会预留房间，也无法保证最终同住", "我愿意只在公开介绍中分享让自己感到安心的内容"].map((label, i) => <label key={label} className="flex items-start gap-3 text-xs leading-5 text-slate-600"><input type="checkbox" checked={checked[i]} onChange={() => setChecked(checked.map((v, j) => j === i ? !v : v))} className="mt-1" />{label}</label>)}</div>{error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<button type="submit" disabled={!checked.every(Boolean) || saving} className="button button-primary mt-6 w-full disabled:opacity-40">{saving ? "正在妥善保存…" : "保存这份介绍"}</button></form></Modal>;
}

function CreateTeamModal({ me, onClose, onSave }: { me: Profile; onClose: () => void; onSave: (input: { name: string; summary: string; orientation: Profile["orientation"] }) => Promise<void> }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <Modal onClose={onClose}><form onSubmit={async (event) => { event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget); try { await onSave({ name: String(form.get("name")), summary: String(form.get("summary")), orientation: form.get("orientation") as Profile["orientation"] }); } catch (cause) { setError(cause instanceof Error ? cause.message : "这次没有创建成功，请稍后再试。"); } finally { setSaving(false); } }}><div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">{me.building}号楼</p><h2 className="mt-1 text-2xl font-black">发起一个小队</h2></div><button type="button" className="icon-button" onClick={onClose}><X className="size-5" /></button></div><p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">这是邀请大家彼此认识的起点，不会预留任何房间。{me.building === "23" ? "小队最多8人；按照住宿安排，同一套间内为同性。" : "小队最多4人。"}</p><div className="mt-5 space-y-4"><Field label="给小队起个名字"><input name="name" required minLength={1} maxLength={32} placeholder="例如：一起看日落的小队" /></Field><Field label="对房间采光的共同期待"><select name="orientation" defaultValue={me.orientation}><option>阳面</option><option>阴面</option><option>都可以</option></select></Field><Field label="想对未来队友说的话"><textarea name="summary" required maxLength={240} rows={4} defaultValue={`我们来自${me.building}号楼，希望在尊重彼此空间的同时，也能自在地沟通。共同兴趣可能有${me.interests.slice(0, 3).join("、") || "一起探索校园"}，也欢迎不一样的你。`} /></Field></div>{error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<button type="submit" disabled={saving} className="button button-primary mt-6 w-full disabled:opacity-40">{saving ? "正在准备小队…" : "发起小队"}</button></form></Modal>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) { return <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}><div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-[2rem] ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}>{children}</div></div>; }
