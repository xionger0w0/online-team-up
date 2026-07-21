"use client";

import {
  AlertTriangle, BookOpen, Camera, Check, ChevronDown, Clock3, Flag, HeartHandshake, Info, LockKeyhole,
  Mail, MessageCircle, Search, Send, ShieldCheck, Sparkles, Trash2, UserRoundPen, X,
} from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import unncpaLogo from "../../public/unncpa-logo.png";
import { currentUser as demoCurrentUser, lobbyComments as demoLobbyComments, lobbyPosts as demoLobbyPosts, majors } from "@/lib/mock-data";
import { calculateMatch } from "@/lib/matching";
import type { DirectConversation, DirectMessage, LobbyComment, LobbyContactLink, LobbyPost, LobbyPostKind, MatchResult, Profile } from "@/lib/types";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import {
  addLobbyComment, deleteLobbyComment, deleteLobbyPost, getMyProfile, listLobbyComments,
  listDirectConversations, listDirectMessages, listLobbyContactLinks, listLobbyPosts,
  markDirectMessagesRead, openDirectConversation, publishLobbyPost, reportLobbyPost,
  requestLobbyContact, respondLobbyContact, saveProfile, sendDirectMessage,
  uploadProfileAvatar, type ProfileInput,
} from "@/lib/supabase/data";

function Avatar({ profile, size = "md" }: { profile: Pick<Profile, "avatar" | "nickname">; size?: "sm" | "md" | "lg" }) {
  const sizes = { sm: "size-10 text-lg", md: "size-12 text-2xl", lg: "size-18 text-3xl" };
  const isImage = /^(https?:|data:|blob:)/.test(profile.avatar);
  return <div aria-label={`${profile.nickname}的头像`} className={`${sizes[size]} grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 to-amber-50 ring-1 ring-amber-900/10`}>{isImage
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={profile.avatar} alt="" className="h-full w-full object-cover" />
    : profile.avatar}</div>;
}

function Badge({ children, tone = "blue" }: { children: React.ReactNode; tone?: "blue" | "yellow" | "green" | "gray" }) {
  const colors = { blue: "bg-sky-50 text-sky-800", yellow: "bg-amber-50 text-amber-800", green: "bg-emerald-50 text-emerald-800", gray: "bg-slate-100 text-slate-600" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${colors[tone]}`}>{children}</span>;
}

function AdminBadge() {
  return <span className="admin-badge"><ShieldCheck className="size-3" />管理员</span>;
}

function MatchBadge({ result }: { result: MatchResult }) {
  const tone = result.total >= 82 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : result.total >= 65 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600";
  return <span title="系统根据双方公开资料自动生成，仅供参考" className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-black ${tone}`}><Sparkles className="size-3" />匹配度 {result.total}%</span>;
}

function MatchPanel({ result }: { result: MatchResult }) {
  return <section className="mt-5 rounded-2xl border border-emerald-100 bg-gradient-to-br from-emerald-50/80 to-amber-50/70 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><p className="text-xs font-bold tracking-[.14em] text-emerald-800">资料匹配参考</p><p className="mt-1 max-w-md text-xs leading-5 text-slate-500">由系统根据双方公开资料自动生成，仅作为认识彼此的参考；页面不会展示具体计算方式。</p></div>
      <div className="text-right"><b className="text-3xl font-black text-emerald-800">{result.total}%</b><p className="text-[10px] text-slate-400">综合匹配度</p></div>
    </div>
    {result.buildingHint && <p className={`mt-3 rounded-xl p-3 text-xs font-semibold ${result.buildingHint.startsWith("不同") ? "bg-rose-50 text-rose-800" : "bg-emerald-100/70 text-emerald-900"}`}>{result.buildingHint}</p>}
    {result.caution && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">{result.caution}</p>}
  </section>;
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "邮箱已绑定";
  return `${name.slice(0, Math.min(2, name.length))}${name.length > 2 ? "***" : "*"}@${domain}`;
}

export function PlatformApp() {
  const configured = isSupabaseConfigured();
  const emptyProfile: Profile = { ...demoCurrentUser, nickname: "", realName: "", contact: { type: "微信", value: "" }, building: "undecided" };
  const [me, setMe] = useState<Profile>(configured ? emptyProfile : { ...demoCurrentUser, building: "undecided" });
  const [posts, setPosts] = useState<LobbyPost[]>(configured ? [] : demoLobbyPosts);
  const [links, setLinks] = useState<LobbyContactLink[]>([]);
  const [selectedPost, setSelectedPost] = useState<LobbyPost | null>(null);
  const [comments, setComments] = useState<LobbyComment[]>([]);
  const [contactPost, setContactPost] = useState<LobbyPost | null>(null);
  const [profilePost, setProfilePost] = useState<LobbyPost | null>(null);
  const [contactToShow, setContactToShow] = useState<LobbyContactLink | null>(null);
  const [conversations, setConversations] = useState<DirectConversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<DirectConversation | null>(null);
  const [directMessages, setDirectMessages] = useState<DirectMessage[]>([]);
  const [showInbox, setShowInbox] = useState(false);
  const [showEmailAuth, setShowEmailAuth] = useState(false);
  const [emailAuthMode, setEmailAuthMode] = useState<"signin" | "link">("signin");
  const [accountEmail, setAccountEmail] = useState("");
  const [sessionUserId, setSessionUserId] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [showWelcome, setShowWelcome] = useState(true);
  const [showDisclaimer, setShowDisclaimer] = useState(false);
  const [needsProfile, setNeedsProfile] = useState(false);
  const [loading, setLoading] = useState(isSupabaseConfigured());
  const [connectionError, setConnectionError] = useState("");
  const [toast, setToast] = useState("");
  const sessionUserIdRef = useRef("");
  const supabase = useMemo(() => configured ? createClient() : null, [configured]);

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
    if (own.major === "暂不填写" || !own.smoking || own.smoking === "未选择" || !own.realName) {
      setMe(own);
      setNeedsProfile(true);
      setShowProfile(true);
      return;
    }
    const [nextPosts, nextLinks, nextConversations] = await Promise.all([
      listLobbyPosts(supabase, userId),
      listLobbyContactLinks(supabase),
      listDirectConversations(supabase),
    ]);
    setMe(own);
    setPosts(nextPosts);
    setLinks(nextLinks);
    setConversations(nextConversations);
    setNeedsProfile(false);
  };

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    const refreshPosts = async () => {
      const userId = sessionUserIdRef.current;
      if (!userId) return;
      const next = await listLobbyPosts(supabase, userId);
      if (active) setPosts(next);
    };
    const refreshLinks = async () => {
      const userId = sessionUserIdRef.current;
      if (!userId) return;
      const next = await listLobbyContactLinks(supabase);
      if (active) setLinks(next);
    };
    const refreshConversations = async () => {
      const userId = sessionUserIdRef.current;
      if (!userId) return;
      const next = await listDirectConversations(supabase);
      if (active) setConversations(next);
    };
    const channel = supabase.channel("chat-first-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "lobby_posts" }, refreshPosts)
      .on("postgres_changes", { event: "*", schema: "public", table: "lobby_comments" }, refreshPosts)
      .on("postgres_changes", { event: "*", schema: "public", table: "lobby_contact_requests" }, refreshLinks)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        void refreshConversations();
        const senderId = (payload.new as { sender_id?: string }).sender_id;
        const userId = sessionUserIdRef.current;
        if (senderId && userId && senderId !== userId) notify("信箱里收到一条新私信");
      })
      .subscribe();
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const session = data.session;
        if (!session) {
          if (active) {
            setEmailAuthMode("signin");
            setShowEmailAuth(true);
          }
          return;
        }
        sessionUserIdRef.current = session.user.id;
        if (active) {
          setSessionUserId(session.user.id);
          setAccountEmail(session.user.email || "");
        }
        if (session.user.is_anonymous) {
          if (active) {
            setEmailAuthMode("link");
            setShowEmailAuth(true);
          }
          return;
        }
        if (active) await refresh(session.user.id);
      } catch (error) {
        if (active) setConnectionError(error instanceof Error ? error.message : "暂时没能连接到线上资料");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; void supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const requestEmailCode = async (email: string, mode: "signin" | "link") => {
    if (!supabase) throw new Error("邮箱登录尚未配置");
    if (mode === "link") {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user.is_anonymous) throw new Error("当前账号已经绑定邮箱，请直接登录");
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
      return "email_change" as const;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) throw error;
    return "email" as const;
  };

  const verifyEmailCode = async (email: string, token: string, type: "email" | "email_change") => {
    if (!supabase) throw new Error("邮箱登录尚未配置");
    const { data, error } = await supabase.auth.verifyOtp({ email, token, type });
    if (error) throw error;
    const session = data.session || (await supabase.auth.getSession()).data.session;
    if (!session || session.user.is_anonymous) throw new Error("邮箱还没有完成绑定，请重新获取验证码");
    sessionUserIdRef.current = session.user.id;
    setSessionUserId(session.user.id);
    setAccountEmail(session.user.email || email);
    setShowEmailAuth(false);
    setLoading(true);
    try {
      await refresh(session.user.id);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    sessionUserIdRef.current = "";
    setSessionUserId("");
    setAccountEmail("");
    setMe(emptyProfile);
    setPosts([]);
    setLinks([]);
    setConversations([]);
    setShowInbox(false);
    setShowProfile(false);
    setEmailAuthMode("signin");
    setShowEmailAuth(true);
  };

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

  useEffect(() => {
    if (!supabase || !activeConversation || !sessionUserId) return;
    let active = true;
    const refreshMessages = async () => {
      const next = await listDirectMessages(supabase, activeConversation.id);
      if (!active) return;
      setDirectMessages(next);
      await markDirectMessagesRead(supabase, activeConversation.id);
      setConversations(await listDirectConversations(supabase));
    };
    void refreshMessages();
    const channel = supabase.channel(`direct-${activeConversation.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `conversation_id=eq.${activeConversation.id}` }, refreshMessages)
      .subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [activeConversation, sessionUserId, supabase]);

  const saveMyProfile = async (input: ProfileInput) => {
    if (!supabase) {
      setMe({ ...me, nickname: input.nickname, avatar: input.avatar || "🌿", gender: input.gender, major: input.major, smoking: input.smoking, realName: input.realName, weekdaySleep: input.sleep, weekendSleep: input.sleep, interests: input.interests, intro: input.intro, contact: input.contact, building: "undecided" });
      setShowProfile(false);
      setNeedsProfile(false);
      return;
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("浏览器账户还在准备中，请稍后再试");
    await saveProfile(supabase, data.session.user.id, input);
    await refresh(data.session.user.id);
    setShowProfile(false);
    notify("个人资料已经保存");
  };

  const uploadAvatar = async (file: File) => {
    if (!supabase) {
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("这张图片暂时没有读取成功"));
        reader.readAsDataURL(file);
      });
    }
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw new Error("浏览器账户还在准备中，请稍后再试");
    return uploadProfileAvatar(supabase, data.session.user.id, file);
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
    if (selectedPost?.id === post.id) {
      setSelectedPost(null);
      setComments([]);
      return;
    }
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
    notify("已把进一步联系意愿发给对方，对方同意后会显示真实姓名与联系方式");
  };

  const respondContact = async (requestId: string, accept: boolean) => {
    if (supabase) {
      await respondLobbyContact(supabase, requestId, accept);
      setLinks(await listLobbyContactLinks(supabase));
    } else {
      setLinks(links.map((link) => link.requestId === requestId ? { ...link, status: accept ? "accepted" : "declined", contact: accept ? { type: "微信", value: "demo-contact" } : undefined } : link));
    }
    notify(accept ? "你们现在可以看到彼此的真实姓名与联系方式了" : "已经婉拒这次进一步联系意愿");
  };

  const openChat = async (conversation: DirectConversation) => {
    try {
      setShowInbox(false);
      setActiveConversation(conversation);
      if (!supabase) return;
      setDirectMessages(await listDirectMessages(supabase, conversation.id));
      await markDirectMessagesRead(supabase, conversation.id);
      setConversations(await listDirectConversations(supabase));
    } catch (cause) {
      setActiveConversation(null);
      notify(cause instanceof Error ? cause.message : "这段私聊暂时没有打开，请稍后再试");
    }
  };

  const startChatFromProfile = async (post: LobbyPost) => {
    try {
      if (!supabase) {
        setProfilePost(null);
        await openChat({ id: `demo-${post.author.id}`, other: post.author, lastMessage: "还没有消息", lastMessageAt: new Date().toISOString(), unreadCount: 0 });
        return;
      }
      const conversationId = await openDirectConversation(supabase, post.author.id);
      const next = await listDirectConversations(supabase);
      setConversations(next);
      const conversation = next.find((item) => item.id === conversationId) || {
        id: conversationId,
        other: post.author,
        lastMessage: "还没有消息",
        lastMessageAt: new Date().toISOString(),
        unreadCount: 0,
      };
      setProfilePost(null);
      await openChat(conversation);
    } catch (cause) {
      notify(cause instanceof Error ? cause.message : "私聊暂时没有打开，请稍后再试");
    }
  };

  const sendPrivate = async (conversationId: string, body: string) => {
    if (!supabase) {
      setDirectMessages([...directMessages, { id: `demo-${Date.now()}`, conversationId, body: body.trim(), createdAt: new Date().toISOString(), isMine: true, sender: me }]);
      return;
    }
    await sendDirectMessage(supabase, conversationId, body);
    setDirectMessages(await listDirectMessages(supabase, conversationId));
    setConversations(await listDirectConversations(supabase));
  };

  const unreadMessages = conversations.reduce((total, conversation) => total + conversation.unreadCount, 0);

  return <div className="min-h-screen bg-transparent text-slate-800">
    <header className="sticky top-0 z-40 border-b border-amber-100/80 bg-[#fffdf9]/94 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
        <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-2xl bg-sky-900 text-xl text-white">伴</span><span><strong className="block leading-4 text-sky-950">线上组队</strong><small className="text-[10px] tracking-widest text-slate-400">UNNC 新生公共聊天区</small></span></div>
        <span className="ml-5 hidden items-center gap-1.5 text-xs font-semibold text-emerald-700 sm:inline-flex"><span className="size-2 rounded-full bg-emerald-500" />实时更新</span>
        <div className="ml-auto flex items-center gap-2"><button onClick={() => setShowDisclaimer(true)} className="icon-button" aria-label="说明与免责"><Info className="size-5" /></button><button onClick={() => setShowInbox(true)} disabled={!sessionUserId || showEmailAuth} className="icon-button relative disabled:opacity-40" aria-label="打开私信信箱"><Mail className="size-5" />{unreadMessages > 0 && <span className="inbox-count">{unreadMessages > 99 ? "99+" : unreadMessages}</span>}</button><button onClick={() => { if (!showEmailAuth) setShowProfile(true); }} className="flex items-center gap-2 rounded-full bg-slate-50 py-1.5 pl-2 pr-3 text-sm font-semibold"><Avatar profile={me} size="sm" /><span className="hidden sm:inline">{loading || showEmailAuth ? "正在识别账号" : me.nickname || "填写资料"}</span>{me.isAdmin && <AdminBadge />}</button></div>
      </div>
    </header>

    <div className="border-b border-sky-100 bg-sky-50/80">
      <div className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-3 text-xs leading-5 text-sky-950 sm:px-6">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-sky-700" />
        <div className="space-y-1">
          <p>由于今年的新生楼栋信息尚未确定，网站暂不按楼栋或房型分类，在聊天大区，大家可以通过简单的生活习惯、作息、兴趣爱好等慢慢了解彼此。后续新生楼栋明确后，将会开放更多功能，更准确的服务大家！（鞠躬</p>
          <p><b>欢迎在聊天大区畅所欲言（正常聊嗷！）</b>目前仅提供找舍友服务，找不成也可以当交朋友了。</p>
          <p className="font-bold text-rose-700">安全提醒：不要相信第三方代抢，也不要轻信“内部床位”“付费锁房”“先交定金”等说法，谨防诈骗。</p>
        </div>
      </div>
    </div>

    {connectionError && <div className="border-b border-rose-200 bg-rose-50 px-4 py-3 text-center text-xs text-rose-800">线上内容暂时没有加载出来：{connectionError}</div>}

    <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
      {loading || showEmailAuth ? <div className="card grid min-h-72 place-items-center p-8 text-sm text-slate-500">{showEmailAuth ? "完成邮箱验证后进入公共聊天区" : "正在识别账号…"}</div> : <LobbyPage
        me={me} posts={posts} links={links} accountEmail={accountEmail} expandedPostId={selectedPost?.id} comments={comments} onPublish={publish} onComments={openComments} onSaveComment={addComment} onDeleteComment={removeComment}
        onDelete={removePost} onReport={async (id) => { if (supabase) await reportLobbyPost(supabase, id, "请管理员查看这条公共聊天内容"); notify("反馈已经收到"); }}
        onContact={requestContact} onOwnRequests={setContactPost} onOpenProfile={setProfilePost} onProfile={() => setShowProfile(true)} onSignOut={signOut}
      />}
    </main>

    <footer className="border-t border-slate-200 bg-white px-4 py-6 text-xs text-slate-500"><div className="mx-auto flex max-w-6xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"><p>在校生个人制作的第三方网站 · 宁波诺丁汉大学心理协会大力支持 · 有问题请联系 scymg5@nottingham.edu.cn</p><button onClick={() => setShowDisclaimer(true)} className="text-left font-semibold text-sky-800">使用说明与免责声明</button></div></footer>

    {showEmailAuth && <EmailAuthModal mode={emailAuthMode} onRequestCode={requestEmailCode} onVerifyCode={verifyEmailCode} />}
    {showWelcome && !showEmailAuth && <WelcomeModal onClose={() => setShowWelcome(false)} />}
    {showProfile && !showWelcome && !showEmailAuth && <ProfileModal profile={me} required={needsProfile} onClose={() => { if (!needsProfile) setShowProfile(false); }} onSave={saveMyProfile} onUploadAvatar={uploadAvatar} />}
    {profilePost && <PublicProfileModal
      me={me}
      post={profilePost}
      link={links.find((link) => link.postId === profilePost.id && link.role === "requester")}
      onClose={() => setProfilePost(null)}
      onContact={() => requestContact(profilePost)}
      onMessage={() => startChatFromProfile(profilePost)}
      onShowContact={setContactToShow}
      onEdit={() => { setProfilePost(null); setShowProfile(true); }}
      sameGender={me.gender === profilePost.author.gender}
    />}
    {contactPost && <ContactRequestsModal post={contactPost} links={links.filter((link) => link.postId === contactPost.id && link.role === "recipient")} onClose={() => setContactPost(null)} onRespond={respondContact} onShowContact={setContactToShow} />}
    {contactToShow?.contact && <ContactModal link={contactToShow} onClose={() => setContactToShow(null)} />}
    {showInbox && <InboxModal conversations={conversations} onClose={() => setShowInbox(false)} onOpen={openChat} />}
    {activeConversation && <DirectChatModal conversation={activeConversation} messages={directMessages} onClose={() => setActiveConversation(null)} onSend={sendPrivate} />}
    {showDisclaimer && <DisclaimerModal onClose={() => setShowDisclaimer(false)} />}
    {toast && <div className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-2xl">{toast}</div>}
  </div>;
}

function LobbyPage({ me, posts, links, accountEmail, expandedPostId, comments, onPublish, onComments, onSaveComment, onDeleteComment, onDelete, onReport, onContact, onOwnRequests, onOpenProfile, onProfile, onSignOut }: {
  me: Profile; posts: LobbyPost[]; links: LobbyContactLink[]; accountEmail: string; expandedPostId?: string; comments: LobbyComment[];
  onPublish: (kind: LobbyPostKind, body: string) => Promise<void>; onComments: (post: LobbyPost) => void;
  onSaveComment: (postId: string, body: string) => Promise<void>; onDeleteComment: (id: string) => void;
  onDelete: (id: string) => void; onReport: (id: string) => void; onContact: (post: LobbyPost) => void;
  onOwnRequests: (post: LobbyPost) => void; onOpenProfile: (post: LobbyPost) => void; onProfile: () => void; onSignOut: () => Promise<void>;
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
      <header className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><span className="grid size-11 place-items-center rounded-2xl bg-sky-50 text-sky-800"><MessageCircle className="size-5" /></span><div><h1 className="text-lg font-black text-slate-900">公共聊天区</h1><p className="text-xs leading-5 text-slate-500">聊天、招募舍友和评论都在这里</p></div></div><label className="search-box sm:max-w-64"><Search className="size-4" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索消息或兴趣" /></label></header>
      <form onSubmit={submit} className="border-b border-amber-100 bg-[#fffdf8] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="segmented compact">
            <button type="button" onClick={() => setKind("chat")} className={kind === "chat" ? "active" : ""}>公共聊天</button>
            <button type="button" onClick={() => setKind("recruitment")} className={kind === "recruitment" ? "active" : ""}>编辑高亮招募</button>
          </div>
          <span className="text-xs text-slate-400">{body.length}/500</span>
        </div>
        {kind === "recruitment" && <div className="recruitment-guide"><HeartHandshake className="size-4 shrink-0" /><p><b>这是广播招募功能。</b>发布后会展示你的作息与兴趣；同学可以评论或表达联系意愿，你同意后双方才会看到联系方式。招募信息会高亮显示。</p></div>}
        <div className="mt-3 flex items-end gap-2">
          <textarea className="lobby-composer" rows={3} value={body} onChange={(e) => setBody(e.target.value.slice(0, 500))} placeholder={kind === "chat" ? "想聊点什么？慢慢写就好。" : "可以简单写作息、生活习惯、兴趣爱好，以及希望找到怎样的舍友。"} />
          <button className="button button-primary shrink-0" disabled={sending || !body.trim()}><Send className="size-4" /><span className="hidden sm:inline">{sending ? "发送中" : kind === "chat" ? "发送" : "发布招募"}</span></button>
        </div>
        {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
      </form>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-3 text-xs"><button onClick={() => setFilter("all")} className={`filter-chip ${filter === "all" ? "filter-chip-active" : ""}`}>全部</button><button onClick={() => setFilter("chat")} className={`filter-chip ${filter === "chat" ? "filter-chip-active" : ""}`}>聊天</button><button onClick={() => setFilter("recruitment")} className={`filter-chip ${filter === "recruitment" ? "filter-chip-active" : ""}`}>只看招募</button><span className="ml-auto text-slate-400">{visible.length} 条</span></div>
      <div className="lobby-feed">{visible.length ? visible.map((post) => <PostItem key={post.id} me={me} post={post} links={links} expanded={expandedPostId === post.id} comments={expandedPostId === post.id ? comments : []} onComments={() => onComments(post)} onSaveComment={onSaveComment} onDeleteComment={onDeleteComment} onDelete={() => onDelete(post.id)} onReport={() => onReport(post.id)} onContact={() => onContact(post)} onOwnRequests={() => onOwnRequests(post)} onOpenProfile={() => onOpenProfile(post)} />) : <p className="p-10 text-center text-sm text-slate-400">这里暂时没有符合条件的消息</p>}</div>
    </section>
    <aside className="chat-side space-y-4">
      <div className="card p-5">
        <div className="flex items-center gap-3"><Avatar profile={me} /><div className="min-w-0"><b className="block truncate">{me.nickname}</b><p className="text-xs text-slate-500">通常 {me.weekdaySleep} 休息 · {me.smoking}</p></div></div>
        <div className="mt-3 flex flex-wrap gap-2">{me.interests.slice(0, 4).map((item) => <Badge key={item} tone="gray">{item}</Badge>)}</div>
        <button onClick={onProfile} className="button button-secondary mt-4 w-full"><UserRoundPen className="size-4" />编辑个人资料</button>
        <div className="mt-4 border-t border-slate-100 pt-4"><p className="text-[11px] text-slate-400">登录邮箱仅自己可见</p><p className="mt-1 truncate text-xs font-semibold text-slate-600">{maskEmail(accountEmail)}</p><button type="button" onClick={() => void onSignOut()} className="mt-3 text-xs font-semibold text-sky-800">退出 / 切换账号</button></div>
      </div>
      <div className="card warm-guide p-5">
        <div className="flex items-center gap-2"><BookOpen className="size-4 text-amber-700" /><h2 className="font-bold">简单实用教程</h2></div>
        <ol className="mt-3 space-y-3 text-xs leading-5 text-slate-600">
          <li><b>1 · 公共聊天：</b>可以随意聊聊、认识同学；想了解谁时，点击头像进入个人主页。</li>
          <li><b>2 · 广播招募：</b>发布后会在聊天区高亮显示，并带有明显的进一步联系意愿按钮。</li>
          <li><b>3 · 慢慢联系：</b>评论适合公开回复，私聊只对双方可见；进一步联系意愿需要双方确认。</li>
        </ol>
      </div>
      <div className="card p-5">
        <h2 className="font-bold">联系会经过双方确认</h2>
        <div className="mt-3 space-y-3 text-xs leading-5 text-slate-500">
          <p className="flex gap-2"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-sky-700" />微信或 QQ 默认不会公开显示；你也可以自行发布，但请留意隐私风险。</p>
          <p className="flex gap-2"><HeartHandshake className="mt-0.5 size-4 shrink-0 text-sky-700" />更建议使用“进一步联系意愿”：双方同意后，再查看彼此留下的真实姓名和联系方式。</p>
        </div>
      </div>
    </aside>
  </div>;
}

function PostItem({ me, post, links, expanded, comments, onComments, onSaveComment, onDeleteComment, onDelete, onReport, onContact, onOwnRequests, onOpenProfile }: { me: Profile; post: LobbyPost; links: LobbyContactLink[]; expanded: boolean; comments: LobbyComment[]; onComments: () => void; onSaveComment: (postId: string, body: string) => Promise<void>; onDeleteComment: (id: string) => void; onDelete: () => void; onReport: () => void; onContact: () => void; onOwnRequests: () => void; onOpenProfile: () => void }) {
  const link = links.find((item) => item.postId === post.id && item.role === "requester");
  const incoming = links.filter((item) => item.postId === post.id && item.role === "recipient" && item.status !== "declined");
  const match = calculateMatch(me, post.author, post.body);
  const time = new Date(post.createdAt).toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
  const contactLabel = link?.status === "accepted" ? "查看联系方式" : link?.status === "pending" ? "已发送，等待回应" : link?.status === "declined" ? "再次发送进一步联系意愿" : "发送进一步联系意愿";
  return <article className={`lobby-message ${post.kind === "recruitment" ? "lobby-message-recruitment" : ""}`}>
    <button type="button" onClick={onOpenProfile} className="profile-author-button profile-author-with-tip self-start rounded-2xl" aria-label={`查看${post.author.nickname}的个人主页`} data-tip={`${post.author.gender === "female" ? "女生" : "男生"} · ${post.author.major} · ${post.author.smoking}`}><Avatar profile={post.author} size="sm" /></button>
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-slate-900">{post.author.nickname}</span>
        {post.author.isAdmin && <AdminBadge />}
        {match && <MatchBadge result={match} />}
        {post.isExample && <Badge tone="blue">示例</Badge>}
        <Badge tone="gray">{post.author.gender === "female" ? "女生" : "男生"}</Badge>
        {post.kind === "recruitment" && <Badge tone="yellow">高亮招募</Badge>}
        {match?.buildingHint && <Badge tone={match.buildingHint.startsWith("不同") ? "yellow" : "green"}>{match.buildingHint.startsWith("不同") ? "不同楼栋" : "同楼栋"}</Badge>}
        <time className="text-[10px] text-slate-300">{time}</time>
      </div>
      {post.kind === "recruitment" && <div className="mt-2 flex flex-wrap gap-2"><Badge tone="green"><Clock3 className="mr-1 size-3" />{post.author.weekdaySleep}休息</Badge><Badge tone="gray">{post.author.major}</Badge><Badge tone="gray">{post.author.smoking}</Badge>{post.author.interests.slice(0, 4).map((item) => <Badge key={item} tone="gray">{item}</Badge>)}</div>}
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{post.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button onClick={onComments} aria-expanded={expanded} className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700"><MessageCircle className="size-3.5" />{post.commentCount ? `${post.commentCount} 条评论` : "评论"}<ChevronDown className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} /></button>
        {post.isMine ? ((post.kind === "recruitment" || incoming.length > 0) && <button onClick={onOwnRequests} className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700"><HeartHandshake className="size-3.5" />{incoming.length ? `${incoming.length} 个联系意愿` : "查看联系意愿"}</button>) : post.kind === "recruitment" && <button onClick={onContact} disabled={link?.status === "pending"} className="recruitment-contact-button"><HeartHandshake className="size-4" />{contactLabel}</button>}
        {post.isMine ? <button onClick={onDelete} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-rose-700"><Trash2 className="size-3.5" />删除</button> : <button onClick={() => { if (window.confirm("要把这条信息交给管理员查看吗？")) onReport(); }} className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-amber-700"><Flag className="size-3.5" />反馈</button>}
      </div>
      {expanded && <InlineComments post={post} comments={comments} onSave={onSaveComment} onDelete={onDeleteComment} />}
    </div>
  </article>;
}

function EmailAuthModal({ mode, onRequestCode, onVerifyCode }: {
  mode: "signin" | "link";
  onRequestCode: (email: string, mode: "signin" | "link") => Promise<"email" | "email_change">;
  onVerifyCode: (email: string, token: string, type: "email" | "email_change") => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verificationType, setVerificationType] = useState<"email" | "email_change">("email");
  const [step, setStep] = useState<"email" | "code">("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestCode = async () => {
    const normalized = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
      setError("请填写可以正常收信的邮箱地址");
      return;
    }
    setBusy(true); setError("");
    try {
      const type = await onRequestCode(normalized, mode);
      setEmail(normalized);
      setVerificationType(type);
      setStep("code");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "验证码暂时没有发送成功";
      setError(message.includes("rate") ? "验证码请求有些频繁，请稍后再试" : message);
    } finally {
      setBusy(false);
    }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (code.length < 6) { setError("请输入邮件中的完整验证码"); return; }
    setBusy(true); setError("");
    try {
      await onVerifyCode(email, code, verificationType);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "验证码暂时没有通过";
      setError(message.toLowerCase().includes("expired") || message.toLowerCase().includes("invalid") ? "验证码不正确或已经失效，请重新获取" : message);
    } finally {
      setBusy(false);
    }
  };
  return <Modal onClose={() => {}} wide>
    <div className="email-auth-panel">
      <div className="welcome-mark"><Mail className="size-6" /></div>
      <p className="mt-5 text-xs font-bold tracking-[.18em] text-amber-700">个人邮箱和学校邮箱都支持</p>
      <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">{mode === "link" ? "绑定邮箱，保留当前账号" : "邮箱验证码登录"}</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">{mode === "link" ? "验证后会保留当前的个人资料、消息和管理员身份，以后换设备也能回到同一个账号。" : "无需设置密码。输入邮箱与邮件验证码，就能进入自己的账号。"}</p>
      <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm leading-6 text-amber-950">
        <p className="font-bold">发送额度说明</p>
        <p className="mt-1">由于个人经费有限，网站每天最多发送 300 封注册验证邮件，每小时最多发送 25 封。如暂时没有收到，可稍后再试或等待额度刷新，感谢理解！</p>
        <p className="mt-2 text-xs leading-5 text-amber-800">PS：验证邮件有时会被邮箱归入垃圾邮件；若收件箱中没有，建议先到垃圾邮件中检查一下。请勿频繁申请发送验证码 qaq</p>
      </div>
      {step === "email" ? <div className="mt-6">
        <label className="field"><span>登录邮箱（仅自己可见）</span><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value.slice(0, 160))} placeholder="name@example.com" onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void requestCode(); } }} /></label>
        <button type="button" onClick={() => void requestCode()} disabled={busy} className="button button-primary mt-4 w-full"><Mail className="size-4" />{busy ? "正在发送…" : "发送邮箱验证码"}</button>
      </div> : <form className="mt-6" onSubmit={verify}>
        <div className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-900"><p>验证码已发送至</p><b className="mt-1 block break-all">{maskEmail(email)}</b></div>
        <label className="field mt-4"><span>邮件验证码</span><input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 8))} placeholder="请输入验证码" /></label>
        <button disabled={busy || code.length < 6} className="button button-primary mt-4 w-full"><Check className="size-4" />{busy ? "正在验证…" : mode === "link" ? "验证并保留当前账号" : "验证并登录"}</button>
        <div className="mt-4 flex items-center justify-between text-xs"><button type="button" onClick={() => { setStep("email"); setCode(""); setError(""); }} className="font-semibold text-sky-800">更换邮箱</button><button type="button" disabled={busy} onClick={() => void requestCode()} className="font-semibold text-sky-800 disabled:opacity-40">重新发送</button></div>
      </form>}
      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs leading-5 text-rose-700">{error}</p>}
      <div className="mt-5 flex items-start gap-2 rounded-2xl bg-white/75 p-4 text-xs leading-5 text-slate-500"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-sky-700" /><p>邮箱只用于登录和找回账号，不会出现在个人主页、聊天区或公开仓库中。</p></div>
    </div>
  </Modal>;
}

function WelcomeModal({ onClose }: { onClose: () => void }) {
  return <Modal onClose={() => {}} wide>
    <div className="welcome-panel">
      <div className="welcome-mark"><Sparkles className="size-6" /></div>
      <p className="mt-5 text-xs font-bold tracking-[.18em] text-amber-700">欢迎在聊天区搞抽象，交朋友，网站粗糙，多多包容～</p>
      <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">欢迎来到线上组队网站～</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">这是面向 UNNC 新生的第三方找舍友公共聊天区。今年楼栋尚未确定，因此这里暂时只帮助大家认识可能合适的舍友。若新生楼栋确定，本网站也会立刻更新！</p>
      <div className="mt-5 rounded-2xl border border-sky-100 bg-sky-50/80 p-4 text-sm leading-6 text-sky-950">
        <p className="font-bold">组队前先了解</p>
        <p className="mt-1">宁诺的新生宿舍楼栋通常由学校根据学院和专业统一分配，只有被分到同一楼栋的同学，才有机会提前组队并抢同一间宿舍。同专业同学被分到同一楼栋的概率更高，跨学院则几乎不可能同楼。即使没能和心仪的室友抢到同一间寝室，也不必灰心；入校后仍可按学校流程提出换宿申请，是否批准及具体安排以学校规定和实际床位情况为准。</p>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <div className="welcome-step"><b>1 · 编辑个人资料</b><p>填写代号、专业、是否吸烟、一般作息和兴趣；资料越完整，匹配度参考越准确。</p></div>
        <div className="welcome-step"><b>2 · 公共聊天</b><p>可以轻松聊聊、认识同学；点击头像还能预览并进入个人主页。</p></div>
        <div className="welcome-step"><b>3 · 广播招募</b><p>招募信息会在聊天区高亮显示，也会提供明显的进一步联系意愿按钮。</p></div>
        <div className="welcome-step"><b>4 · 评论与私聊</b><p>评论适合公开回复，私聊只对双方可见；联系方式更建议经过双方确认后查看。</p></div>
      </div>
      <div className="mt-5 flex items-start gap-2 rounded-2xl bg-white/70 p-4 text-xs leading-5 text-slate-500"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-sky-700" /><p>真实姓名、微信或 QQ 默认不会公开。你也可以自行发布，但请留意隐私风险。不要相信第三方代抢，不要提供验证码或先行转账，谨防诈骗。只看不发言、晚一点回复，也完全没关系。</p></div>
      <div className="mt-5 flex flex-col items-start gap-4 rounded-2xl border border-sky-100 bg-white/80 p-4 sm:flex-row sm:items-center">
        <Image src={unncpaLogo} alt="宁波诺丁汉大学心理协会 UNNCPA Logo" className="h-auto w-44 max-w-full shrink-0" priority />
        <div>
          <p className="text-xs font-bold tracking-[.16em] text-amber-700">心协支持</p>
          <p className="mt-1 text-sm font-semibold leading-6 text-sky-950">本网站由宁波诺丁汉大学心理协会大力支持，欢迎加入心理协会（UNNCPA）～</p>
        </div>
      </div>
      <button onClick={onClose} className="button button-primary mt-6 w-full">我知道了，去聊天区看看</button>
    </div>
  </Modal>;
}

function PublicProfileModal({ me, post, link, onClose, onContact, onMessage, onShowContact, onEdit, sameGender }: {
  me: Profile;
  post: LobbyPost;
  link?: LobbyContactLink;
  onClose: () => void;
  onContact: () => Promise<void>;
  onMessage: () => Promise<void>;
  onShowContact: (link: LobbyContactLink) => void;
  onEdit: () => void;
  sameGender: boolean;
}) {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const match = calculateMatch(me, post.author, post.body);
  const actionLabel = link?.status === "pending" ? "已发送，等待对方回应" : link?.status === "declined" ? "再次发送进一步联系意愿" : "发送进一步联系意愿";
  const send = async () => {
    setSending(true); setError("");
    try { await onContact(); } catch (cause) { setError(cause instanceof Error ? cause.message : "这次暂时没有发送成功"); } finally { setSending(false); }
  };
  return <Modal onClose={onClose} wide>
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 items-center gap-4">
        <Avatar profile={post.author} size="lg" />
        <div className="min-w-0">
          <p className="text-xs font-bold tracking-[.18em] text-amber-700">个人主页</p>
          <div className="mt-1 flex flex-wrap items-center gap-2"><h2 className="truncate text-2xl font-black text-slate-900">{post.author.nickname}</h2>{post.author.isAdmin && <AdminBadge />}</div>
          <p className="mt-1 text-xs text-slate-400">{post.author.gender === "female" ? "女生" : "男生"}</p>
        </div>
      </div>
      <button type="button" className="icon-button" onClick={onClose}><X className="size-5" /></button>
    </div>
    {match && <MatchPanel result={match} />}
    <div className="profile-preview mt-6">
      <div><span>专业</span><b>{post.author.major}</b></div>
      <div><span>是否吸烟</span><b>{post.author.smoking}</b></div>
      <div><span>一般作息</span><b>{post.author.weekdaySleep}</b></div>
      <div><span>兴趣爱好</span>{post.author.interests.length ? <p className="mt-2 flex flex-wrap gap-2">{post.author.interests.slice(0, 8).map((item) => <Badge key={item} tone="gray">{item}</Badge>)}</p> : <b>暂时没有填写</b>}</div>
      <div><span>生活习惯或简单介绍</span><p>{post.author.intro || "暂时没有填写；也可以从聊天慢慢了解。"}</p></div>
    </div>
    <div className="mt-5 rounded-2xl bg-sky-50/70 p-4">
      <p className="text-xs font-semibold text-sky-900">你是从这条{post.kind === "recruitment" ? "招募" : "聊天"}来到主页的</p>
      <p className="mt-2 line-clamp-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{post.body}</p>
    </div>
    {post.isMine ? <div className="mt-5">
      <p className="text-xs leading-5 text-slate-500">这是别人看到的你的公开主页。联系方式不会出现在这里。</p>
      <button type="button" onClick={onEdit} className="button button-secondary mt-3 w-full"><UserRoundPen className="size-4" />调整我的简单资料</button>
    </div> : <div className="mt-5">
      <div className="flex items-start gap-2 text-xs leading-5 text-slate-500"><LockKeyhole className="mt-0.5 size-4 shrink-0 text-sky-700" /><p>表达意愿不会直接显示真实姓名与联系方式。对方同意后，双方才能看到彼此留下的真实姓名、微信或 QQ 等联系信息。</p></div>
      {!sameGender && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">不同性别之间无法组队选寝，但欢迎互相交朋友</p>}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button type="button" onClick={() => void onMessage()} className="button button-secondary"><Mail className="size-4" />发私信</button>
        {link?.status === "accepted" ? <button type="button" onClick={() => onShowContact(link)} className="button button-primary"><HeartHandshake className="size-4" />查看联系方式</button> : <button type="button" onClick={() => void send()} disabled={sending || link?.status === "pending"} className="button button-primary disabled:opacity-50"><HeartHandshake className="size-4" />{sending ? "正在发送…" : actionLabel}</button>}
      </div>
      {error && <p className="mt-3 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
    </div>}
  </Modal>;
}

function ProfileModal({ profile, required, onClose, onSave, onUploadAvatar }: { profile: Profile; required: boolean; onClose: () => void; onSave: (input: ProfileInput) => Promise<void>; onUploadAvatar: (file: File) => Promise<string> }) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [accepted, setAccepted] = useState(!required);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const interests = String(form.get("interests") || "").split(/[、,，]/).map((item) => item.trim()).filter(Boolean).slice(0, 8);
    try {
      await onSave({
        nickname: String(form.get("nickname") || "").trim(),
        avatar: avatar || "🌿",
        gender: form.get("gender") as Profile["gender"],
        major: String(form.get("major") || ""),
        smoking: form.get("smoking") as ProfileInput["smoking"],
        realName: String(form.get("realName") || "").trim(),
        sleep: form.get("sleep") as Profile["weekdaySleep"],
        interests: [...new Set(interests)],
        intro: String(form.get("intro") || "").trim(),
        contact: { type: form.get("contactType") as "微信" | "QQ", value: String(form.get("contactValue") || "").trim() },
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "这次没有保存成功");
    } finally {
      setSaving(false);
    }
  };
  const sleepSlots: Profile["weekdaySleep"][] = ["22:30前", "22:30–00:00", "00:00–01:30", "01:30后", "不固定"];
  return <Modal onClose={onClose} wide>
    <form onSubmit={submit}>
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-bold tracking-[.18em] text-amber-700">简单介绍一下自己吧</p><h2 className="mt-1 text-2xl font-black">个人简介</h2></div>
        {!required && <button type="button" className="icon-button" onClick={onClose}><X className="size-5" /></button>}
      </div>
      <p className="mt-3 text-sm leading-6 text-slate-500">只填写聊天和找舍友真正需要的信息。楼栋与房型暂不收集，专业会公开展示。微信或 QQ 等隐私信息，只有双方同意后才可见。</p>
      <div className="avatar-upload mt-5">
        <Avatar profile={{ nickname: profile.nickname, avatar }} size="lg" />
        <div>
          <label className="button button-secondary cursor-pointer"><Camera className="size-4" />{uploading ? "正在上传…" : "上传自己的头像"}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={uploading} onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; setUploading(true); setError(""); try { setAvatar(await onUploadAvatar(file)); } catch (cause) { setError(cause instanceof Error ? cause.message : "这张图片暂时没有上传成功"); } finally { setUploading(false); } }} /></label>
          <p className="mt-2 text-xs leading-5 text-slate-400">支持 JPG、PNG、WebP，最大 2MB。头像会公开显示。</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field label="取个“代号”"><input name="nickname" required maxLength={24} defaultValue={profile.nickname} /></Field>
        <Field label="真实姓名（双方同意后才可见）"><input name="realName" required maxLength={32} defaultValue={profile.realName || ""} /></Field>
        <Field label="性别"><select name="gender" defaultValue={profile.gender}><option value="female">女生</option><option value="male">男生</option></select></Field>
        <Field label="专业"><select name="major" required defaultValue={majors.includes(profile.major) ? profile.major : ""}><option value="" disabled>请选择专业</option>{majors.map((major) => <option key={major}>{major}</option>)}</select></Field>
        <Field label="是否吸烟"><select name="smoking" required defaultValue={profile.smoking === "未选择" ? "" : profile.smoking}><option value="" disabled>请选择</option><option value="不吸烟">不吸烟</option><option value="吸烟">吸烟</option></select></Field>
        <Field label="一般作息"><select name="sleep" defaultValue={profile.weekdaySleep}>{sleepSlots.map((slot) => <option key={slot}>{slot}</option>)}</select></Field>
        <Field label="联系方式类型"><select name="contactType" defaultValue={profile.contact.type}><option>微信</option><option>QQ</option></select></Field>
        <div className="sm:col-span-2"><Field label="微信或 QQ（双方同意后显示）"><input name="contactValue" required maxLength={64} defaultValue={profile.contact.value} /></Field></div>
        <div className="sm:col-span-2"><Field label="兴趣爱好（建议填）"><input name="interests" defaultValue={profile.interests.join("、")} placeholder="例如：羽毛球、电影、摄影" /></Field></div>
        <div className="sm:col-span-2"><Field label="生活习惯或简单介绍（建议填）"><textarea name="intro" rows={3} maxLength={200} defaultValue={profile.intro} placeholder="尽情描述你自己，有助于别人更方便地认识你，当然也支持留空喔" /></Field></div>
      </div>
      {required && <label className="mt-5 flex items-start gap-3 text-xs leading-5 text-slate-600"><input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" /><span>我了解这是第三方个人网站；公开内容请避免真实姓名、联系方式等敏感信息，联系信息只会在双方同意后显示。</span></label>}
      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}
      <button disabled={!accepted || saving || uploading} className="button button-primary mt-6 w-full disabled:opacity-40">{saving ? "正在保存…" : "保存并进入聊天区"}</button>
    </form>
  </Modal>;
}

function InboxModal({ conversations, onClose, onOpen }: { conversations: DirectConversation[]; onClose: () => void; onOpen: (conversation: DirectConversation) => Promise<void> }) {
  return <Modal onClose={onClose} wide><div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.18em] text-sky-700">私聊信箱</p><h2 className="mt-1 text-2xl font-black">你的私信</h2><p className="mt-2 text-sm text-slate-500">点开一封信，就可以继续聊天。</p></div><button className="icon-button" onClick={onClose}><X className="size-5" /></button></div><div className="mt-5 space-y-2">{conversations.length ? conversations.map((conversation) => <button type="button" key={conversation.id} onClick={() => void onOpen(conversation)} className="inbox-row"><Avatar profile={conversation.other} size="sm" /><div className="min-w-0 flex-1 text-left"><div className="flex flex-wrap items-center gap-2"><b className="truncate text-sm text-slate-900">{conversation.other.nickname}</b>{conversation.other.isAdmin && <AdminBadge />}<span className="text-[10px] text-slate-400">{conversation.other.major}</span></div><p className="mt-1 truncate text-xs text-slate-500">{conversation.lastMessage}</p></div>{conversation.unreadCount > 0 && <span className="message-unread">{conversation.unreadCount}</span>}</button>) : <div className="rounded-2xl bg-slate-50 p-10 text-center"><Mail className="mx-auto size-6 text-slate-300" /><p className="mt-3 text-sm text-slate-400">信箱暂时是空的</p><p className="mt-1 text-xs text-slate-400">可以从任意同学的个人主页发起私聊。</p></div>}</div></Modal>;
}

function DirectChatModal({ conversation, messages, onClose, onSend }: { conversation: DirectConversation; messages: DirectMessage[]; onClose: () => void; onSend: (conversationId: string, body: string) => Promise<void> }) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (!body.trim()) return; setSending(true); setError("");
    try { await onSend(conversation.id, body); setBody(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "这条私信暂时没有发出去"); } finally { setSending(false); }
  };
  return <Modal onClose={onClose} wide><div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4"><div className="flex min-w-0 items-center gap-3"><Avatar profile={conversation.other} size="sm" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate font-black text-slate-900">{conversation.other.nickname}</h2>{conversation.other.isAdmin && <AdminBadge />}</div><p className="text-xs text-slate-400">{conversation.other.major} · 私聊</p></div></div><button className="icon-button" onClick={onClose}><X className="size-5" /></button></div><div className="direct-message-list mt-4">{messages.length ? messages.map((message) => <div key={message.id} className={`direct-message ${message.isMine ? "direct-message-mine" : ""}`}><div className="direct-message-meta"><span>{message.sender.nickname}</span>{message.sender.isAdmin && <AdminBadge />}</div><p>{message.body}</p></div>) : <div className="p-10 text-center text-sm text-slate-400">还没有消息，想说什么都可以慢慢写。</div>}</div><form onSubmit={submit} className="mt-4"><div className="flex items-end gap-2"><textarea className="lobby-composer" rows={2} value={body} onChange={(event) => setBody(event.target.value.slice(0, 500))} placeholder="随便打个招呼吧～" /><button disabled={sending || !body.trim()} className="button button-primary shrink-0"><Send className="size-4" />发送</button></div>{error && <p className="mt-2 text-xs text-rose-700">{error}</p>}<p className="mt-2 text-[11px] leading-5 text-slate-400">不同性别也可以自由聊天、交朋友；组队选寝仍只支持同性。</p></form></Modal>;
}

function InlineComments({ post, comments, onSave, onDelete }: { post: LobbyPost; comments: LobbyComment[]; onSave: (postId: string, body: string) => Promise<void>; onDelete: (id: string) => void }) {
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  return <div className="inline-comments">
    <div className="max-h-72 space-y-1 overflow-y-auto">{comments.length ? comments.map((comment) => <div key={comment.id} className="flex gap-3 rounded-xl p-3 hover:bg-white/70"><Avatar profile={comment.author} size="sm" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="text-xs">{comment.author.nickname}</b>{comment.author.id === post.author.id && <span className="owner-badge">楼主</span>}{comment.author.isAdmin && <AdminBadge />}{comment.isMine && <button onClick={() => onDelete(comment.id)} className="ml-auto text-[10px] text-slate-400">删除</button>}</div><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-600">{comment.body}</p></div></div>) : <p className="p-6 text-center text-sm text-slate-400">暂时还没有评论</p>}</div>
    <form className="mt-4" onSubmit={async (event) => { event.preventDefault(); if (!body.trim()) return; setSaving(true); setError(""); try { await onSave(post.id, body); setBody(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "这次没有发送成功"); } finally { setSaving(false); } }}>
      <div className="flex items-end gap-2"><textarea className="lobby-composer" rows={2} value={body} onChange={(e) => setBody(e.target.value.slice(0, 300))} placeholder="鳝鱼结善缘，鳄鱼伤人心" /><button disabled={saving || !body.trim()} className="button button-primary shrink-0"><Send className="size-4" />评论</button></div>
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
    </form>
  </div>;
}

function ContactRequestsModal({ post, links, onClose, onRespond, onShowContact }: { post: LobbyPost; links: LobbyContactLink[]; onClose: () => void; onRespond: (id: string, accept: boolean) => void; onShowContact: (link: LobbyContactLink) => void }) {
  return <Modal onClose={onClose}><div className="flex items-start justify-between"><div><p className="text-xs font-bold tracking-[.18em] text-sky-700">联系意愿</p><h2 className="mt-1 text-xl font-black">想进一步认识你的人</h2></div><button className="icon-button" onClick={onClose}><X className="size-5" /></button></div><p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-500">对方是从这条{post.kind === "recruitment" ? "招募" : "聊天"}看到你的：{post.body}</p><div className="mt-5 space-y-3">{links.length ? links.map((link) => <div key={link.requestId} className="rounded-2xl border border-slate-100 p-4"><div className="flex items-center gap-3"><Avatar profile={link.other} size="sm" /><div><div className="flex items-center gap-2"><b>{link.other.nickname}</b>{link.other.isAdmin && <AdminBadge />}</div><p className="text-xs text-slate-400">{link.other.gender === "female" ? "女生" : "男生"}</p></div></div>{link.other.gender !== post.author.gender && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">不同性别之间无法组队选寝，但欢迎互相交朋友</p>}{link.status === "pending" ? <div className="mt-4 flex gap-2"><button onClick={() => onRespond(link.requestId, true)} className="button button-primary flex-1"><Check className="size-4" />同意联系</button><button onClick={() => onRespond(link.requestId, false)} className="button button-secondary">暂不联系</button></div> : link.status === "accepted" ? <button onClick={() => onShowContact(link)} className="button button-secondary mt-4 w-full">查看联系方式</button> : <p className="mt-3 text-xs text-slate-400">已婉拒</p>}</div>) : <p className="rounded-2xl bg-slate-50 p-8 text-center text-sm text-slate-400">暂时还没有联系意愿</p>}</div></Modal>;
}

function ContactModal({ link, onClose }: { link: LobbyContactLink; onClose: () => void }) {
  return <Modal onClose={onClose}>
    <div className="flex items-start justify-between">
      <div><div className="match-celebration"><Sparkles className="size-5" /><span>Match！</span><Sparkles className="size-4" /></div><h2 className="mt-1 text-xl font-black">可以进一步联系了</h2></div>
      <button className="icon-button" onClick={onClose}><X className="size-5" /></button>
    </div>
    <div className="mt-5 flex items-center gap-4 rounded-2xl bg-emerald-50 p-4">
      <Avatar profile={link.other} />
      <div><div className="flex items-center gap-2"><b>{link.other.nickname}</b>{link.other.isAdmin && <AdminBadge />}</div>{link.realName && <p className="mt-1 text-sm text-emerald-900">真实姓名：{link.realName}</p>}<p className="mt-1 text-sm text-emerald-900">{link.contact?.type}：{link.contact?.value}</p></div>
    </div>
    <p className="mt-4 text-xs leading-5 text-slate-500">是否添加、何时回复、是否继续交流，都由你自己决定。</p>
    <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900"><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>不要相信第三方代抢；遇到付费锁房、内部床位、索要验证码或要求转账时，请立即停止交流并谨防诈骗。</p></div>
  </Modal>;
}

function DisclaimerModal({ onClose }: { onClose: () => void }) {
  return <Modal onClose={onClose} wide>
    <div className="flex items-start justify-between">
      <div><p className="text-xs font-bold tracking-[.18em] text-sky-700">使用说明</p><h2 className="mt-1 text-2xl font-black">关于“线上组队”</h2></div>
      <button className="icon-button" onClick={onClose}><X className="size-5" /></button>
    </div>
    <div className="mt-5 space-y-4 text-sm leading-7 text-slate-600">
      <p><b className="text-slate-900">网站性质：</b>本网站由宁波诺丁汉大学在校生个人制作与维护，是独立的第三方个人网站，并非学校官方系统。联系邮箱：scymg5@nottingham.edu.cn。</p>
      <p><b className="text-slate-900">当前服务：</b>目前新生楼栋信息尚未确定，本站仅提供找舍友和提前组队服务。建立联系后，建议通过微信、QQ 等个人联系方式进一步商讨抢宿舍与选寝安排。本站不提供床位预留、代抢或选寝结果保证，不能保证成员最终入住同一宿舍。</p>
      <p><b className="text-slate-900">隐私与交流：</b>真实姓名、微信或 QQ 等信息默认不会公开。用户可以自行选择公开，但应自行判断并承担相应隐私风险；更建议使用进一步联系意愿，在双方同意后查看彼此留下的信息。任何时候都可以停止交流。</p>
      <p><b className="text-slate-900">内容责任与社区规范：</b>用户应对自己发布内容的真实性、合法性与适当性负责，并遵守法律法规、学校相关规定及基本交流礼仪。骚扰、冒充、侮辱、歧视、威胁、恶意刷屏、虚假招募、泄露他人隐私等不文明或不当行为将被制止和处理，包括删除相关内容、限制相关账号继续使用；情节严重时，建议当事人及时向学校相关部门或公安机关求助。</p>
      <p><b className="text-slate-900">安全与反诈提醒：</b>楼栋、选寝时间和规则请以学校正式通知为准。不要相信第三方代抢，也不要轻信“内部床位”“付费锁房”“床位转让”“先交定金”等说法。请勿向他人提供验证码、证件照片等敏感信息；涉及转账或线下见面时务必核实对方身份，发现异常请立即停止交流并谨防诈骗。</p>
    </div>
  </Modal>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="field"><span>{label}</span>{children}</label>; }
function Modal({ children, onClose, wide = false }: { children: React.ReactNode; onClose: () => void; wide?: boolean }) { return <div className="fixed inset-0 z-50 grid place-items-end bg-slate-950/35 p-0 backdrop-blur-sm sm:place-items-center sm:p-4" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose(); }}><div className={`max-h-[92vh] w-full overflow-y-auto rounded-t-[2rem] bg-white p-6 shadow-2xl sm:rounded-[2rem] ${wide ? "sm:max-w-2xl" : "sm:max-w-md"}`}>{children}</div></div>; }
