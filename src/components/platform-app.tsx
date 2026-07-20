"use client";

import {
  AlertTriangle, Check, Clock3, Flag, HeartHandshake, Info, LockKeyhole,
  MessageCircle, Search, Send, Trash2, UserRoundPen, X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { currentUser as demoCurrentUser, lobbyComments as demoLobbyComments, lobbyPosts as demoLobbyPosts } from "@/lib/mock-data";
import type { LobbyComment, LobbyContactLink, LobbyPost, LobbyPostKind, Profile } from "@/lib/types";
import { createClient, ensureAnonymousSession, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  addLobbyComment, deleteLobbyComment, deleteLobbyPost, getMyProfile, listLobbyComments,
  listLobbyContactLinks, listLobbyPosts, publishLobbyPost, reportLobbyPost, requestLobbyContact,
  respondLobbyContact, saveProfile, type ProfileInput,
} from "@/lib/supabase/data";

function Avatar({ profile, size = "md" }: { profile: Pick<Profile, "avatar" | "nickname">; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-10 text-lg", md: "size-12 text-2xl", lg: "size-18 text-3xl" };
  return <div aria-label={`${profile.nickname}的头像`} className={`${sizes[size]} grid shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-100 to-amber-50 ring-1 ring-sky-900/8`}>{profile.avatar}</div>;
}

function Badge({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "yellow" | "green" | "gray" }) {
  const colors = { blue: "bg-sky-50 text-sky-800", yellow: "bg-amber-50 text-amber-800", green: "bg-emerald-50 text-emerald-800", gray: "bg-slate-100 text-slate-600" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${colors[tone]}`}>{children}</span>;
}

export function PlatformApp() {
  const [me, setMe] = useState<Profile>({ ...demoCurrentUser, building: "undecided" });
  const [posts, setPosts] = useState<LobbyPost[]>(demoLobbyPosts);
  const [links, setLinks] = useState<LobbyContactLink[]>([]);
  const [selectedPost, setSelectedPost] = useState<LobbyPost | null>(null);
  const [comments, setComments] = useState<LobbyComment[]>([]);
  const [contactPost, setContactPost] = useState<LobbyPost | null>(null);
  const [contactToShow, setContactToShow] = useState<LobbyContactLink | null>(null);
  const [sessionUserId, setSessionUserId] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [connectionError, setConnectionError] = useState("");
  const [toast, setToast] = useState("");
  const supabase = useMemo(() => isSupabaseConfigured() ? createClient() : null, []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const refresh = async (userId: string) => {
    if (!supabase) return;
    const own = await getMyProfile(supabase, userId);
    if (!own) {
      setNeedsProfile(true);
      setShowProfile(true);
      return;
    }
    const [nextPosts, nextLinks] = await Promise.all([
      listLobbyPosts(supabase, userId),
      listLobbyContactLinks(supabase),
    ]);
    setMe(own);
    setPosts(nextPosts);
    setLinks(nextLinks);
    setNeedsProfile(false);
  };

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    let userId = "";
    const refreshPosts = async () => {
      if (!userId) return;
      const next = await listLobbyPosts(supabase, userId);
      if (active) setPosts(next);
    };
    const refreshLinks = async () => {
      if (!userId) return;
      const next = await listLobbyContactLinks(supabase);
      if (active) setLinks(next);
    };
    const channel = supabase.channel("chat-first-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "lobby_posts" }, refreshPosts)
      .on("postgres_changes", { event: "*", schema: "public", table: "lobby_comments" }, refreshPosts)
      .on("postgres_changes", { event: "*", schema: "public", table: "lobby_contact_requests" }, refreshLinks)
      .subscribe();
    (async () => {
      try {
        const session = await ensureAnonymousSession();
        if (!session) throw new Error("暂时没能建立浏览器账户");
        userId = session.user.id;
        if (active) setSessionUserId(userId);
        if (active) await refresh(userId);
      } catch (error) {
        if (active) setConnectionError(error instanceof Error ? error.message : "暂时没能连接到线上资料");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; void supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !selectedPost || !sessionUserId) return;
    let active = true;
    const refreshComments = async () => {
      const next = await listLobbyComments(supabase, selectedPost.id, sessionUserId);
      if (active) setComments(next);
    };
    void refreshComments();
    const channel = supabase.channel(`comments-${selectedPost.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "lobby_comments", filter: `post_id=eq.${selectedPost.id}` }, refreshComments)
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [selectedPost, sessionUserId, supabase]);

  const saveMyProfile = async (input: ProfileInput) => {
    if (!supabase) {
      setMe({ ...me, nickname: input.nickname, avatar: input.avatar || "🌿", gender: input.gender, weekdaySleep: input.sleep, weekendSleep: input.sleep, interests: input.interests, intro: input.intro, contact: input.contact, building: "undecided", major: "暂不填写" });
      setShowProfile(false);
      setNeedsProfile(false);
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("浏览器账户还在准备中，请稍后再试");
    await saveProfile(supabase, data.session.user.id, input);
    await refresh(data.session.user.id);
    setShowProfile(false);
    notify("简单资料已经保存");
  };

  const publish = async (kind: LobbyPostKind, body: string) => {
    if (!supabase) {
      setPosts([{ id: `demo-${Date.now()}`, kind, body: body.trim(), createdAt: new Date().toISOString(), commentCount: 0, isMine: true, author: me }, ...posts]);
      return;
    }
    await publishLobbyPost(supabase, kind, body);
    setPosts(await listLobbyPosts(supabase, sessionUserId));
  };

  const openComments = async (post: LobbyPost) => {
    setSelectedPost(post);
    if (!supabase) setComments(demoLobbyComments.filter((item) => item.postId === post.id));
    else setComments(await listLobbyComments(supabase, post.id, sessionUserId));
  };

  const addComment = async (postId: string, body: string) => {
    if (!supabase) {
      setComments([...comments, { id: `demo-${Date.now()}`, postId, body: body.trim(), createdAt: new Date().toISOString(), isMine: true, author: me }]);
      setPosts(posts.map((post) => post.id === postId ? { ...post, commentCount: post.commentCount + 1 } : post));
      return;
    }
    await addLobbyComment(supabase, postId, body);
    const [nextComments, nextPosts] = await Promise.all([listLobbyComments(supabase, postId, sessionUserId), listLobbyPosts(supabase, sessionUserId)]);
    setComments(nextComments);
    setPosts(nextPosts);
  };

  const removePost = async (postId: string) => {
    if (supabase) await deleteLobbyPost(supabase, postId);
    setPosts(posts.filter((post) => post.id !== postId));
    notify("这条信息已经删除");
  };

  const removeComment = async (commentId: string) => {
    if (supabase) await deleteLobbyComment(supabase, commentId);
    setComments(comments.filter((comment) => comment.id !== commentId));
  };

  const requestContact = async (post: LobbyPost) => {
    const existing = links.find((link) => link.postId === post.id && link.role === "requester");
    if (existing?.status === "accepted") { setContactToShow(existing); return; }
    if (existing?.status === "pending") { notify("联系意愿已经发给对方了"); return; }
    if (!supabase) {
      setLinks([...links, { requestId: `demo-${Date.now()}`, postId: post.id, role: "requester", status: "pending", createdAt: new Date().toISOString(), other: post.author }]);
    } else {
      await requestLobbyContact(supabase, post.id);
      setLinks(await listLobbyContactLinks(supabase));
    }
    notify("已把联系意愿发给对方，对方同意后会显示联系方式");
  };

  const respondContact = async (requestId: string, accept: boolean) => {
    if (supabase) {
      await respondLobbyContact(supabase, requestId, accept);
      setLinks(await listLobbyContactLinks(supabase));
    } else {
      setLinks(links.map((link) => link.requestId === requestId ? { ...link, status: accept ? "accepted" : "declined", contact: accept ? { type: "微信", value: "demo-contact" } : undefined } : link));
    }
    notify(accept ? "你们现在可以看到彼此的联系方式了" : "已经婉拒这次联系意愿");
  };

  return <div className="min-h-screen bg-[#f7f7f2] text-slate-800">
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/94 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-sky-900 text-xl text-white">伴</span><span><strong className="block leading-4 text-sky-950">线上组队</strong><small className="text-[10px] tracking-widest text-slate-400">UNNC 新生公共聊天区</small></span></div>
        <span className="ml-5 hidden items-center gap-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex"><span className="size-2 rounded-full bg-emerald-500" />实时更新</span>
        <div className="ml-auto flex items-center gap-2"><button onClick={() => setShowDisclaimer(true)} className="icon-button" aria-label="说明与免责"><Info className="size-5" /></button><button onClick={() => setShowProfile(true)} className="flex items-center gap-2 rounded-full bg-slate-50 py-1.5 pl-2 pr-3 text-sm font-semibold"><Avatar profile={me} size="sm" /><span className="hidden sm:inline">{me.nickname || "填写资料"}</span></button></div>
      </div>
    </header>

    <div className="border-b border-sky-100 bg-sky-50/80">
      <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-3 text-xs leading-5 text-sky-950 sm:px-6"><AlertTriangle className="mt-0.5 size-4 shrink-0 text-sky-700" /><p><b>目前只提供找舍友服务：</b>由于今年的新生楼栋信息尚未确定，网站暂不按楼栋或房型分类。大家可以通过作息、生活习惯和兴趣爱好慢慢了解彼此；这里的交流与招募不会预留宿舍或床位。</p></div>
    </div>

    {connectionError && <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-center text-xs text-rose-800">线上内容暂时没有加载出来：{connectionError}</div>}

    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      {loading ? <div className="card grid min-h-72 place-items-center p-8 text-sm text-slate-500">正在进入公共聊天区…</div> : <LobbyPage
        me={me} posts={posts} links={links} onPublish={publish} onComments={openComments}
        onDelete={removePost} onReport={async (id) => { if (supabase) await reportLobbyPost(supabase, id, "请管理员查看这条公共聊天内容"); notify("反馈已经收到"); }}
        onContact={requestContact} onOwnRequests={setContactPost} onProfile={() => setShowProfile(true)}
      />}
    </main>

    <footer className="border-t border-slate-200 bg-white px-4 py-6 text-xs text-slate-500"><div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p>在校生个人制作的第三方网站 · 有问题请联系 scymg5@nottingham.edu.cn</p><button onClick={() => setShowDisclaimer(true)} className="text-left font-semibold text-sky-800">使用说明与免责声明</button></div></footer>

    {showProfile && <ProfileModal profile={me} required={needsProfile} onClose={() => { if (!needsProfile) setShowProfile(false); }} onSave={saveMyProfile} />}
    {selectedPost && <CommentsModal post={selectedPost} comments={comments} onClose={() => setSelectedPost(null)} onSave={addComment} onDelete={removeComment} />}
    {contactPost && <ContactRequestsModal post={contactPost} links={links.filter((link) => link.postId === contactPost.id && link.role === "recipient")} onClose={() => setContactPost(null)} onRespond={respondContact} onShowContact={setContactToShow} />}
    {contactToShow?.contact && <ContactModal link={contactToShow} onClose={() => setContactToShow(null)} />}
    {showDisclaimer && <DisclaimerModal onClose={() => setShowDisclaimer(false)} />}
    {toast && <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-2xl">{toast}</div>}
  </div>;
}

function LobbyPage({ me, posts, links, onPublish, onComments, onDelete, onReport, onContact, onOwnRequests, onProfile }: {
  me: Profile; posts: LobbyPost[]; links: LobbyContactLink[];
  onPublish: (kind: LobbyPostKind, body: string) => Promise<void>; onComments: (post: LobbyPost) => void;
  onDelete: (id: string) => void; onReport: (id: string) => void; onContact: (post: LobbyPost) => void;
  onOwnRequests: (post: LobbyPost) => void; onProfile: () => void;
}) {
  const [kind, setKind] = useState<LobbyPostKind>("chat");
  const [filter, setFilter] = useState<"all" | LobbyPostKind>("all");
  const [query, setQuery] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const visible = posts.filter((post) => (filter === "all" || post.kind === filter) && [post.body, post.author.nickname, post.author.interests.join(" ")].join(" ").toLowerCase().includes(query.trim().toLowerCase()));
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!body.trim()) return; setSending(true); setError("");
    try { await onPublish(kind, body); setBody(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "这次没有发送成功"); } finally { setSending(false); }
  };
  return <div className="chat-first-layout">
    <section className="card chat-stream overflow-hidden">
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-sky-50 text-sky-800"><MessageCircle className="size-5" /></span><div><h1 className="text-lg font-black text-slate-900">公共聊天区</h1><p className="text-xs leading-5 text-slate-500">聊天、招募舍友和留言都在这里</p></div></div><label className="search-box sm:max-w-64"><Search className="size-4" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索消息或兴趣" /></label></header>
      <form onSubmit={submit} className="border-b border-slate-100 bg-[#fbfcfa] p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="segmented compact"><button type="button" onClick={() => setKind("chat")} className={kind === "chat" ? "active" : ""}>普通聊天</button><button type="button" onClick={() => setKind("recruitment")} className={kind === "recruitment" ? "active" : ""}>招募舍友</button></div><span className="text-xs text-slate-400">{body.length}/500</span></div><div className="flex items-end gap-2"><textarea className="lobby-composer" rows={3} value={body} onChange={(e) => setBody(e.target.value.slice(0, 500))} placeholder={kind === "chat" ? "想聊点什么？慢慢写就好。" : "可以简单写作息、生活习惯、兴趣爱好，以及希望找到怎样的舍友。"} /><button className="button button-primary shrink-0" disabled={sending || !body.trim()}><Send className="size-4" /><span className="hidden sm:inline">{sending ? "发送中" : "发布"}</span></button></div>{error && <p className="mt-2 text-xs text-rose-700">{error}</p>}</form>
      <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs"><button onClick={() => setFilter("all")} className={`filter-chip ${filter === "all" ? "filter-chip-active" : ""}`}>全部</button><button onClick={() => setFilter("chat")} className={`filter-chip ${filter === "chat" ? "filter-chip-active" : ""}`}>聊天</button><button onClick={() => setFilter("recruitment")} className={`filter-chip ${filter === "recruitment" ? "filter-chip-active" : ""}`}>只看招募</button><span className="ml-auto text-slate-400">{visible.length} 条</span></div>
      <div className="lobby-feed">{visible.length ? visible.map((post) => <PostItem key={post.id} post={post} links={links} onComments={() => onComments(post)} onDelete={() => onDelete(post.id)} onReport={() => onReport(post.id)} onContact={() => onContact(post)} onOwnRequests={() => onOwnRequests(post)} />) : <p className="p-10 text-center text-sm text-slate-400">这里暂时没有符合条件的消息</p>}</div>
    </section>
    <aside className="chat-side space-y-4"><div className="card p-5"><div className="flex items-center gap-3"><Avatar profile={me} /><div className="min-w-0"><b className="block truncate">{me.nickname}</b><p className="text-xs text-slate-500">通常 {me.weekdaySleep} 休息</p></div></div><div className="mt-3 flex flex-wrap gap-2">{me.interests.slice(0, 4).map((item) => <Badge key={item} tone="gray">{item}</Badge>)}</div><button onClick={onProfile} className="button button-secondary mt-4 w-full"><UserRoundPen className="size-4" />调整简单资料</button></div><div className="card p-5"><h2 className="font-bold">联系会经过双方确认</h2><div className="mt-3 space-y-3 text-xs leading-5 text-slate-500"><p className="flex gap-2"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-sky-700" />微信或 QQ 不会公开出现在聊天区。</p><p className="flex gap-2"><HeartHandshake className="mt-0.5 size-4 shrink-0 text-sky-700" />看到合适的招募，可以表达联系意愿；发布者同意后双方才能查看。</p></div></div></aside>
  </div>;
}

function PostItem({ post, links, onComments, onDelete, onReport, onContact, onOwnRequests }: { post: LobbyPost; links: LobbyContactLink[]; onComments: () => void; onDelete: () => void; onReport: () => void; onContact: () => void; onOwnRequests: () => void }) {
  const link = links.find((item) => item.postId === post.id && item.role === "requester");
  const incoming = links.filter((item) => item.postId === post.id && item.role === "recipient" && item.status !== "declined");
  const time = new Date(post.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  const contactLabel = link?.status === "accepted" ? "查看联系方式" : link?.status === "pending" ? "已表达联系意愿" : link?.status === "declined" ? "再次表达联系意愿" : "想进一步联系";
  return <article className={`lobby-message ${post.kind === "recruitment" ? "lobby-message-recruitment" : ""}`}><Avatar profile={post.author} size="sm" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-sm text-slate-900">{post.author.nickname}</b><Badge tone="gray">{post.author.gender === "female" ? "女生" : "男生"}</Badge>{post.kind === "recruitment" && <Badge tone="yellow">招募舍友</Badge>}<time className="text-[10px] text-slate-300">{time}</time></div>{post.kind === "recruitment" && <div className="mt-2 flex flex-wrap gap-2"><Badge tone="green"><Clock3 className="mr-1 size-3" />{post.author.weekdaySleep}休息</Badge>{post.author.interests.slice(0, 4).map((item) => <Badge key={item} tone="gray">{item}</Badge>)}</div>}<p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{post.body}</p><div className="mt-3 flex flex-wrap items-center gap-3"><button onClick={onComments} className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700"><MessageCircle className="size-3.5" />{post.commentCount ? `${post.commentCount} 条留言` : "留言"}</button>{post.kind === "recruitment" && (post.isMine ? <button onClick={onOwnRequests} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><HeartHandshake className="size-3.5" />{incoming.length ? `${incoming.length} 个联系意愿` : "查看联系意愿"}</button> : <button onClick={onContact} disabled={link?.status === "pending"} className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 disabled:text-slate-400"><HeartHandshake className="size-3.5" />{contactLabel}</button>)}{post.isMine ? <button onClick={onDelete} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-700"><Trash2 className="size-3.5" />删除</button> : <button onClick={() => { if (window.confirm("要把这条信息交给管理员查看吗？")) onReport(); }} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-amber-700"><Flag className="size-3.5" />反馈</button>}</div></div></article>;
}

function ProfileModal({ profile, required, onClose, onSave }: { profile: Profile; required: boolean; onClose: () => void; onSave: (input: ProfileInput) => Promise<void> }) {
  const [saving, setSaving] = useState(false); const [accepted, setAccepted] = useState(!required); const [error, setError] = useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget); const interests = String(form.get("interests") || "").split(/[、,，]/).map((item) => item.trim()).filter(Boolean).slice(0, 8); try { await onSave({ nickname: String(form.get("nickname") || "").trim(), avatar: String(form.get("avatar") || "🌿"), gender: form.get("gender") as Profile["gender"], sleep: form.get("sleep") as Profile["weekdaySleep"], interests: [...new Set(interests)], intro: String(form.get("intro") || "").trim(), contact: { type: form.get("contactType") as "微信" | "QQ", value: String(form.get("contactValue") || "").trim() } }); } catch (cause) { setError(cause instanceof Error ? cause.message : "这次没有保存成功"); } finally { setSaving(false); } };
  const sleepSlots: Profile["weekdaySleep"][] = ["22:30前", "22:30–00:00", "00:00–01:30", "01:30后", "不固定"];
  return <Modal onClose={onClose} wide><form onSubmit={submit}><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold tracking-[.18em] text-sky-700">简单资料</p><h2 className="mt-1 text-2xl font-black">让别人更容易了解你</h2></div>{!required && <button type="button" className="icon-button" onClick={onClose}><X className="size-5" /></button>}</div><p className="mt-3 text-sm leading-6 text-slate-500">只填写聊天和找舍友真正需要的信息。楼栋、房型、专业等暂不收集。</p><div className="mt-6 grid gap-4 sm:grid-cols-2"><Field label="希望大家怎么称呼你"><input name="nickname" required maxLength={24} defaultValue={profile.nickname} /></Field><Field label="头像符号"><input name="avatar" maxLength={4} defaultValue={profile.avatar} /></Field><Field label="性别（舍友联系仅限同性）"><select name="gender" defaultValue={profile.gender}><option value="female">女生</option><option value="male">男生</option></select></Field><Field label="通常几点准备休息"><select name="sleep" defaultValue={profile.weekdaySleep}>{sleepSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></Field><Field label="联系方式类型"><select name="contactType" defaultValue={profile.contact.type}><option>微信</option><option>QQ</option></select></Field><Field label="微信或 QQ（双方同意后显示）"><input name="contactValue" required maxLength={64} defaultValue={profile.contact.value} /></Field><div className="sm:col-span-2"><Field label="兴趣爱好（可选）"><input name="interests" defaultValue={profile.interests.join("、")} placeholder="例如：羽毛球、电影、摄影" /></Field></div><div className="sm:col-span-2"><Field label="生活习惯或简单介绍（可选）"><textarea name="intro" rows={3} maxLength={200} defaultValue={profile.intro} placeholder="写一点你愿意公开分享的内容，也可以留空" /></Field></div></div>{required && <label className="mt-5 flex items-start gap-3 text-xs leading-5 text-slate-600"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" /><span>我了解这是第三方个人网站；公开内容请避免真实姓名、联系方式等敏感信息，联系信息只会在双方同意后显示。</span></label>}{error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}<button disabled={!accepted || saving} className="button button-primary mt-6 w-full disabled:opacity-40">{saving ? "正在保存…" : "保存并进入聊天区"}</button></form></Modal>;
}

function CommentsModal({ post, comments, onClose, onSave, onDelete }: { post: LobbyPost; comments: LobbyComment[]; onClose: () => void; onSave: (postId: string, body: string) => Promise<void>; onDelete: (id: string) => void }) {
  const [body, setBody] = useState(""); const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  return <Modal onClose={onClose} wide><div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.18em] text-sky-700">留言</p><h2 className="mt-1 text-xl font-black">围绕这条信息慢慢交流</h2></div><button className="icon-button" onClick={onClose}><X className="size-5" /></button></div><div className="mt-4 rounded-2xl bg-slate-50 p-4"><b className="text-sm">{post.author.nickname}</b><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">{post.body}</p></div><div className="mt-4 max-h-72 space-y-1 overflow-y-auto">{comments.length ? comments.map((comment) => <div key={comment.id} className="flex gap-3 rounded-xl p-3 hover:bg-slate-50"><Avatar profile={comment.author} size="sm" /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><b className="text-xs">{comment.author.nickname}</b>{comment.isMine && <button onClick={() => onDelete(comment.id)} className="ml-auto text-[10px] text-slate-400">删除</button>}</div><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{comment.body}</p></div></div>) : <p className="p-8 text-center text-sm text-slate-400">暂时还没有留言</p>}</div><form className="mt-4" onSubmit={async (event) => { event.preventDefault(); if (!body.trim()) return; setSaving(true); setError(""); try { await onSave(post.id, body); setBody(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "这次没有发送成功"); } finally { setSaving(false); } }}><div className="flex items-end gap-2"><textarea className="lobby-composer" rows={2} value={body} onChange={(e) => setBody(e.target.value.slice(0, 300))} placeholder="留下一句话；不需要即时回复" /><button disabled={saving || !body.trim()} className="button button-primary shrink-0"><Send className="size-4" />留言</button></div>{error && <p className="mt-2 text-xs text-rose-700">{error}</p>}</form></Modal>;
}

function ContactRequestsModal({ post, links, onClose, onRespond, onShowContact }: { post: LobbyPost; links: LobbyContactLink[]; onClose: () => void; onRespond: (id: string, accept: boolean) => void; onShowContact: (link: LobbyContactLink) => void }) {
  return <Modal onClose={onClose}><div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.18em] text-sky-700">联系意愿</p><h2 className="mt-1 text-xl font-black">对这条招募感兴趣的人</h2></div><button className="icon-button" onClick={onClose}><X className="size-5" /></button></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">{post.body}</p><div className="mt-5 space-y-3">{links.length ? links.map((link) => <div key={link.requestId} className="rounded-2xl border border-slate-100 p-4"><div className="flex items-center gap-3"><Avatar profile={link.other} size="sm" /><div><b>{link.other.nickname}</b><p className="text-xs text-slate-400">{link.other.gender === "female" ? "女生" : "男生"}</p></div></div>{link.status === "pending" ? <div className="mt-4 flex gap-2"><button onClick={() => onRespond(link.requestId, true)} className="button button-primary flex-1"><Check className="size-4" />同意联系</button><button onClick={() => onRespond(link.requestId, false)} className="button button-secondary">暂不联系</button></div> : link.status === "accepted" ? <button onClick={() => onShowContact(link)} className="button button-secondary mt-4 w-full">查看联系方式</button> : <p className="mt-3 text-xs text-slate-400">已婉拒</p>}</div>) : <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-400">暂时还没有联系意愿</p>}</div></Modal>;
}

function ContactModal({ link, onClose }: { link: LobbyContactLink; onClose: () => void }) { return <Modal onClose={onClose}><div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.18em] text-emerald-700">双方已经同意</p><h2 className="mt-1 text-xl font-black">可以进一步联系了</h2></div><button className="icon-button" onClick={onClose}><X className="size-5" /></button></div><div className="mt-5 flex items-center gap-4 rounded-2xl bg-emerald-50 p-4"><Avatar profile={link.other} /><div><b>{link.other.nickname}</b><p className="mt-1 text-sm text-emerald-900">{link.contact?.type}：{link.contact?.value}</p></div></div><p className="mt-4 text-xs leading-5 text-slate-500">是否添加、何时回复、是否继续交流，都由你自己决定。</p></Modal>; }

function DisclaimerModal({ onClose }: { onClose: () => void }) { return <Modal onClose={onClose} wide><div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.18em] text-sky-700">使用说明</p><h2 className="mt-1 text-2xl font-black">关于“线上组队”</h2></div><button className="icon-button" onClick={onClose}><X className="size-5" /></button></div><div className="mt-5 space-y-4 text-sm leading-7 text-slate-600"><p><b className="text-slate-900">网站性质：</b>本网站由宁波诺丁汉大学在校生个人制作与维护，是独立的第三方个人网站，并非学校官方系统。联系邮箱：scymg5@nottingham.edu.cn。</p><p><b className="text-slate-900">当前服务：</b>由于今年的新生楼栋信息尚未确定，网站暂时仅提供找舍友服务。大家可以通过公开分享的作息、生活习惯与兴趣爱好了解彼此；聊天、招募与联系意愿不代表预留宿舍、床位，也不保证最终同住。</p><p><b className="text-slate-900">隐私与交流：</b>请勿在公开聊天中发布真实姓名、手机号、微信号、QQ号等敏感信息。受保护的联系方式只会在双方同意后显示；任何时候都可以停止交流。</p><p><b className="text-slate-900">内容责任：</b>用户应对自己发布内容的真实性与合法性负责。学校安排与选寝信息请以学校正式通知为准；如遇骚扰、歧视、冒充或虚假内容，可使用反馈功能联系管理员处理。</p></div></Modal>; }

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) { return <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-[2rem] ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}>{children}</div></div>; }
