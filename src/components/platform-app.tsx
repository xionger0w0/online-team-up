"use client";

import {
  AlertTriangle, Bell, Building2, Check, ChevronRight, CircleUserRound, Clock3,
  Heart, Home, LockKeyhole, Menu, Search, ShieldCheck, Sparkles, UserPlus,
  Users, X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { currentUser, profiles, teams } from "@/lib/mock-data";
import { rankMatches } from "@/lib/matching";
import type { MatchResult, Profile, Team } from "@/lib/types";

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

function ProfileCard({ result, liked, onLike, onContact }: { result: MatchResult; liked: boolean; onLike: () => void; onContact: () => void }) {
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
        {liked && p.id === "p1" && <button onClick={onContact} className="button button-secondary">查看联系</button>}
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
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");
  const [showContact, setShowContact] = useState<Profile | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const matches = useMemo(() => rankMatches(currentUser, profiles), []);

  const notify = (message: string) => { setToast(message); window.setTimeout(() => setToast(""), 3200); };
  const toggleLike = (profile: Profile) => {
    const next = new Set(liked);
    if (next.has(profile.id)) next.delete(profile.id); else next.add(profile.id);
    setLiked(next);
    if (profile.id === "p1" && !liked.has(profile.id)) notify("你和小满互相感兴趣，联系方式已解锁");
  };
  const applyTeam = (team: Team) => {
    setApplied(new Set(applied).add(team.id));
    notify(`已向「${team.name}」提交申请，等待队长审批`);
  };

  return (
    <div className="min-h-screen bg-[#f7fafb] text-slate-800">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/92 backdrop-blur-xl">
        <div className="mx-auto flex h-17 max-w-7xl items-center gap-8 px-4 sm:px-6">
          <button onClick={() => setTab("home")} className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-sky-900 text-xl text-white">伴</span><span className="text-left"><strong className="block leading-4 text-sky-950">线上组队</strong><small className="text-[10px] tracking-widest text-slate-400">第三方个人网站</small></span></button>
          <nav className="hidden flex-1 items-center gap-1 md:flex">{navItems.map(({ id, label }) => <button key={id} onClick={() => setTab(id)} className={`nav-link ${tab === id ? "nav-link-active" : ""}`}>{label}</button>)}</nav>
          <div className="ml-auto flex items-center gap-2"><button onClick={() => setTab("me")} className="icon-button relative" aria-label="通知"><Bell className="size-5" /><span className="absolute right-2 top-2 size-2 rounded-full bg-amber-400 ring-2 ring-white" /></button><button onClick={() => setShowProfile(true)} className="hidden items-center gap-2 rounded-full bg-slate-50 py-1.5 pl-2 pr-3 text-sm font-semibold sm:flex"><Avatar profile={currentUser} size="sm" />{currentUser.nickname}</button><button onClick={() => setMenuOpen(!menuOpen)} className="icon-button md:hidden"><Menu className="size-5" /></button></div>
        </div>
      </header>

      <div className="border-b border-amber-200 bg-amber-50">
        <div className="mx-auto flex max-w-7xl items-start gap-2 px-4 py-2.5 text-xs leading-5 text-amber-900 sm:px-6"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p><b>重要提醒：</b>提前组队不等于锁定房源，也不能保证入住同一宿舍。低层、阳面等热门位置可能更难抢到。</p></div>
      </div>

      <main className="mx-auto max-w-7xl px-4 pb-28 pt-6 sm:px-6 md:pb-12 md:pt-9">
        {tab === "home" && <HomePage matches={matches} onExplore={() => setTab("recommend")} onProfile={() => setShowProfile(true)} />}
        {tab === "plaza" && <PlazaPage type={plazaType} setType={setPlazaType} matches={matches} liked={liked} applied={applied} onLike={toggleLike} onContact={setShowContact} onApply={applyTeam} />}
        {tab === "recommend" && <RecommendPage matches={matches} liked={liked} onLike={toggleLike} onContact={setShowContact} />}
        {tab === "teams" && <TeamsPage applied={applied} onApply={applyTeam} onNotify={notify} />}
        {tab === "me" && <MePage onProfile={() => setShowProfile(true)} />}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">{navItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`flex flex-col items-center gap-1 py-1 text-[10px] font-semibold ${tab === id ? "text-sky-800" : "text-slate-400"}`}><Icon className="size-5" />{label}</button>)}</nav>

      {toast && <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-full bg-sky-950 px-5 py-3 text-sm font-medium text-white shadow-xl md:bottom-8">{toast}</div>}
      {showContact && <ContactModal profile={showContact} onClose={() => setShowContact(null)} />}
      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} onSave={() => { setShowProfile(false); notify("资料已保存到当前设备（演示模式）"); }} />}
      {menuOpen && <div className="fixed inset-0 z-50 bg-slate-950/25 md:hidden" onClick={() => setMenuOpen(false)}><div className="absolute right-4 top-19 w-48 rounded-2xl bg-white p-2 shadow-xl">{navItems.map(({ id, label }) => <button key={id} onClick={() => { setTab(id); setMenuOpen(false); }} className="block w-full rounded-xl px-4 py-3 text-left text-sm font-medium hover:bg-slate-50">{label}</button>)}</div></div>}
    </div>
  );
}

function HomePage({ matches, onExplore, onProfile }: { matches: MatchResult[]; onExplore: () => void; onProfile: () => void }) {
  return <div className="space-y-8">
    <section className="hero-panel overflow-hidden rounded-[2rem] px-6 py-10 sm:px-10 sm:py-14"><div className="relative z-10 max-w-2xl"><Badge tone="yellow">2026 新生 · 13号楼</Badge><h1 className="mt-5 text-4xl font-black tracking-tight text-white sm:text-6xl">选寝前，先找到<br /><span className="text-amber-300">合拍的人</span></h1><p className="mt-5 max-w-xl text-base leading-7 text-sky-100 sm:text-lg">按楼栋、作息和兴趣认识未来室友。联系方式只有双方互相感兴趣后才会解锁。</p><div className="mt-8 flex flex-wrap gap-3"><button onClick={onExplore} className="button bg-amber-300 px-6 py-3 text-sky-950 hover:bg-amber-200"><Sparkles className="size-5" />查看推荐</button><button onClick={onProfile} className="button border border-white/20 bg-white/10 px-6 py-3 text-white hover:bg-white/15">完善资料</button></div></div><div className="hero-orbit hidden lg:block"><span>13</span><span>14</span><span>15</span><span>19</span><span>23</span></div></section>
    <section className="grid gap-4 sm:grid-cols-3"><InfoTile icon={ShieldCheck} title="隐私优先" text="资料最小化收集，联系方式双向同意后解锁" /><InfoTile icon={Sparkles} title="透明匹配" text="作息 55% · 兴趣 40% · 朝向 5%" /><InfoTile icon={Building2} title="按楼组队" text="楼栋与性别硬筛选，不混入无效推荐" /></section>
    <section><SectionTitle eyebrow="为你推荐" title="也许会合拍的室友" action="查看全部" onAction={onExplore} /><div className="grid gap-4 lg:grid-cols-3">{matches.slice(0, 3).map((item) => <MiniMatch key={item.profile.id} result={item} />)}</div></section>
    <section className="card grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center"><div><h2 className="text-xl font-bold text-slate-900">你还没有加入队伍</h2><p className="mt-2 text-sm leading-6 text-slate-500">可以先认识同学，也可以浏览匿名化的小队特点。每人同一时间只能加入一个队伍。</p></div><button className="button button-secondary" onClick={onExplore}>先看看推荐<ChevronRight className="size-4" /></button></section>
  </div>;
}

function InfoTile({ icon: Icon, title, text }: { icon: typeof Home; title: string; text: string }) { return <div className="card flex gap-4 p-5"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-800"><Icon className="size-5" /></span><div><h3 className="font-bold text-slate-900">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>; }
function MiniMatch({ result }: { result: MatchResult }) { return <div className="card flex items-center gap-4 p-4"><Avatar profile={result.profile} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><strong>{result.profile.nickname}</strong><Badge tone="yellow">未验证</Badge></div><p className="mt-1 truncate text-xs text-slate-500">{result.profile.major} · {result.profile.interests.slice(0, 2).join(" / ")}</p></div><div className="text-center"><strong className="text-xl text-sky-900">{result.total}</strong><span className="block text-[9px] text-slate-400">匹配度</span></div></div>; }
function SectionTitle({ eyebrow, title, action, onAction }: { eyebrow: string; title: string; action?: string; onAction?: () => void }) { return <div className="mb-4 flex items-end justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">{eyebrow}</p><h2 className="mt-1 text-2xl font-black text-slate-900">{title}</h2></div>{action && <button onClick={onAction} className="text-sm font-semibold text-sky-700">{action} →</button>}</div>; }

function PlazaPage({ type, setType, matches, liked, applied, onLike, onContact, onApply }: { type: "people" | "teams"; setType: (v: "people" | "teams") => void; matches: MatchResult[]; liked: Set<string>; applied: Set<string>; onLike: (p: Profile) => void; onContact: (p: Profile) => void; onApply: (t: Team) => void }) {
  return <div><SectionTitle eyebrow="13号楼广场" title="找到同楼的新同学" /><div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div className="segmented"><button onClick={() => setType("people")} className={type === "people" ? "active" : ""}>找舍友</button><button onClick={() => setType("teams")} className={type === "teams" ? "active" : ""}>找队伍</button></div><div className="flex gap-2"><label className="search-box"><Search className="size-4" /><input placeholder="搜索昵称、专业或兴趣" /></label><button className="icon-button border border-slate-200"><Clock3 className="size-4" /></button></div></div>{type === "people" ? <div className="grid gap-4 lg:grid-cols-2">{matches.map((r) => <ProfileCard key={r.profile.id} result={r} liked={liked.has(r.profile.id)} onLike={() => onLike(r.profile)} onContact={() => onContact(r.profile)} />)}</div> : <div className="grid gap-4 lg:grid-cols-2">{teams.filter((t) => t.building === currentUser.building).map((t) => <TeamCard key={t.id} team={t} applied={applied.has(t.id)} onApply={() => onApply(t)} />)}</div>}</div>;
}

function RecommendPage({ matches, liked, onLike, onContact }: { matches: MatchResult[]; liked: Set<string>; onLike: (p: Profile) => void; onContact: (p: Profile) => void }) {
  return <div><SectionTitle eyebrow="双向匹配算法" title="为你推荐" /><div className="mb-6 rounded-2xl border border-sky-100 bg-sky-50 p-4 text-sm leading-6 text-sky-900"><b>算法说明：</b>只比较同楼、同性别资料。作息占 55%，兴趣占 40%，朝向占 5%；不使用隐藏画像，也不会把公开介绍交给第三方 AI。</div><div className="grid gap-5 lg:grid-cols-2">{matches.map((r) => <ProfileCard key={r.profile.id} result={r} liked={liked.has(r.profile.id)} onLike={() => onLike(r.profile)} onContact={() => onContact(r.profile)} />)}</div></div>;
}

function TeamsPage({ applied, onApply, onNotify }: { applied: Set<string>; onApply: (t: Team) => void; onNotify: (m: string) => void }) {
  return <div><div className="mb-6 flex items-end justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">组队中心</p><h1 className="mt-1 text-2xl font-black text-slate-900">我的队伍与申请</h1></div><button onClick={() => onNotify("建队功能已打开，正式接入数据库后即可发布")} className="button button-primary"><UserPlus className="size-4" />创建队伍</button></div><div className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"><b>组队不是选寝。</b> 队伍只是帮助大家相约注册同一宿舍号下的不同床位，无法锁定房间，也不保证最终同住。</div><section className="card mb-8 p-6"><div className="flex items-start gap-4"><span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-400"><Users /></span><div className="flex-1"><h2 className="font-bold">当前未加入队伍</h2><p className="mt-1 text-sm text-slate-500">可同时申请多个队伍；确认加入一个队伍后，其他申请自动撤销。</p></div></div></section><SectionTitle eyebrow="招募中" title="适合你的队伍" /><div className="grid gap-4 lg:grid-cols-2">{teams.filter((t) => t.building === currentUser.building).map((t) => <TeamCard key={t.id} team={t} applied={applied.has(t.id)} onApply={() => onApply(t)} />)}</div></div>;
}

function MePage({ onProfile }: { onProfile: () => void }) {
  return <div className="grid gap-6 lg:grid-cols-[1fr_360px]"><section><SectionTitle eyebrow="个人中心" title="我的资料" /><div className="card p-6"><div className="flex items-center gap-4"><Avatar profile={currentUser} size="lg" /><div className="flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold">{currentUser.nickname}</h2><Badge tone="yellow">身份未验证</Badge></div><p className="mt-2 text-sm text-slate-500">{currentUser.building}号楼 · {currentUser.major}</p></div><button onClick={onProfile} className="button button-secondary">编辑资料</button></div><div className="mt-6 grid gap-3 sm:grid-cols-3"><Stat label="资料完整度" value="86%" /><Stat label="收到兴趣" value="2" /><Stat label="待处理申请" value="0" /></div></div><h2 className="mb-3 mt-8 text-lg font-bold">站内通知</h2><div className="card divide-y divide-slate-100"><Notice icon={Heart} title="有人对你感兴趣" text="对方身份未验证，互相感兴趣后才会解锁联系信息" /><Notice icon={ShieldCheck} title="校园认证尚未开放" text="学校邮箱发放后，将提供 7 天绑定期" /><Notice icon={Bell} title="资料保存成功" text="你的公开资料已更新" /></div></section><aside className="space-y-4"><div className="card p-5"><h3 className="font-bold">隐私状态</h3><div className="mt-4 space-y-3 text-sm"><PrivacyRow icon={LockKeyhole} label="联系方式" value="双方同意后可见" /><PrivacyRow icon={ShieldCheck} label="校园身份" value="尚未验证" /><PrivacyRow icon={Users} label="展示状态" value="正在展示" /></div></div><div className="card p-5"><h3 className="font-bold">账户与数据</h3><p className="mt-2 text-sm leading-6 text-slate-500">当前账号绑定在本浏览器。更换设备时可使用迁移码；选寝结束 30 天后自动删除本届数据。</p><button className="button button-secondary mt-4 w-full">生成账户迁移码</button></div></aside></div>;
}
function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-slate-50 p-4"><strong className="text-2xl text-sky-900">{value}</strong><span className="mt-1 block text-xs text-slate-500">{label}</span></div>; }
function Notice({ icon: Icon, title, text }: { icon: typeof Home; title: string; text: string }) { return <div className="flex gap-4 p-5"><span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-sky-50 text-sky-700"><Icon className="size-4" /></span><div><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{text}</p></div></div>; }
function PrivacyRow({ icon: Icon, label, value }: { icon: typeof Home; label: string; value: string }) { return <div className="flex items-center gap-3"><Icon className="size-4 text-sky-700" /><span className="text-slate-500">{label}</span><b className="ml-auto text-xs">{value}</b></div>; }

function ContactModal({ profile, onClose }: { profile: Profile; onClose: () => void }) { return <Modal onClose={onClose}><div className="text-center"><Avatar profile={profile} size="lg" /><h2 className="mt-4 text-xl font-bold">你们互相感兴趣</h2><p className="mt-2 text-sm leading-6 text-slate-500">双方均已同意交换联系方式。离开平台后的沟通请注意保护个人信息。</p><div className="mt-6 rounded-2xl bg-sky-50 p-5"><span className="text-xs text-sky-700">{profile.contact.type}</span><strong className="mt-1 block text-lg text-sky-950">{profile.contact.value}</strong></div><button onClick={onClose} className="button button-primary mt-5 w-full">我知道了</button></div></Modal>; }

function ProfileModal({ onClose, onSave }: { onClose: () => void; onSave: () => void }) { const [checked, setChecked] = useState([true, true, true]); return <Modal onClose={onClose} wide><div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.2em] text-sky-700">公开资料</p><h2 className="mt-1 text-2xl font-black">完善我的资料</h2></div><button className="icon-button" onClick={onClose}><X className="size-5" /></button></div><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="昵称"><input defaultValue={currentUser.nickname} /></Field><Field label="宿舍楼"><select defaultValue="13"><option>13号楼</option><option>14号楼</option><option>15号楼</option><option>19号楼</option><option>23号楼</option></select></Field><Field label="专业大类"><select defaultValue={currentUser.major}><option>国际商务</option><option>财务管理</option><option>传播学</option><option>经济学</option><option>计算机科学与技术</option></select></Field><Field label="朝向偏好"><select defaultValue="阳面"><option>阳面</option><option>阴面</option><option>都可以</option></select></Field><Field label="工作日入睡"><select defaultValue="22:30–00:00"><option>22:30前</option><option>22:30–00:00</option><option>00:00–01:30</option><option>01:30后</option><option>不固定</option></select></Field><Field label="周末入睡"><select defaultValue="00:00–01:30"><option>22:30前</option><option>22:30–00:00</option><option>00:00–01:30</option><option>01:30后</option><option>不固定</option></select></Field><Field label="微信或QQ（至少一项）"><input defaultValue="unnc-demo" /></Field><Field label="公开状态"><select><option>正在展示</option><option>暂停展示</option></select></Field><div className="sm:col-span-2"><Field label="个人介绍（最多200字）"><textarea defaultValue={currentUser.intro} rows={3} /><small className="mt-1 block text-xs text-slate-400">请勿填写真实姓名、手机号、微信号等敏感信息。</small></Field></div></div><div className="mt-5 space-y-2">{["我知道这是第三方个人网站，并非学校官方系统", "我知道组队不代表锁定房源或保证同住", "我不会在公开介绍中填写联系方式等敏感信息"].map((label, i) => <label key={label} className="flex items-start gap-3 text-xs leading-5 text-slate-600"><input type="checkbox" checked={checked[i]} onChange={() => setChecked(checked.map((v, j) => j === i ? !v : v))} className="mt-1" />{label}</label>)}</div><button onClick={onSave} disabled={!checked.every(Boolean)} className="button button-primary mt-6 w-full disabled:opacity-40">保存资料</button></Modal>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) { return <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}><div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-[2rem] ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}>{children}</div></div>; }

