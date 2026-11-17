// SelfClub — прогревочный бот @selfclub_manbot.
// /selfclub/webhook — апдейты Telegram; /selfclub/setup — вебхук и команды; /selfclub/cron — напоминания.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import * as T from "./texts.ts";

const TOKEN = Deno.env.get("SELFCLUB_BOT_TOKEN") ?? "";
const SETUP_KEY = Deno.env.get("SETUP_KEY") ?? "";
const SECRET = (Deno.env.get("WEBHOOK_SECRET") ?? "") + "sc";
const ADMINS = new Set((Deno.env.get("ADMIN_IDS") ?? "").split(",").map((s) => Number(s.trim())).filter(Boolean));
const WEBAPP_URL = (Deno.env.get("WEBAPP_URL") ?? "").replace(/\/$/, "");
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const now = () => Math.floor(Date.now() / 1000);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { "Content-Type": "application/json; charset=utf-8" } });

type Btn = { text: string; callback_data?: string; url?: string };
type Row = Record<string, any>;
type TgResp = { ok: boolean; result?: any; description?: string; error_code?: number };
const kb = (...rows: Btn[][]) => ({ inline_keyboard: rows });
const payKb = (text: string) => kb([{ text, url: T.PAY_URL }]);

async function tg(method: string, body: unknown): Promise<TgResp> {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return await r.json();
}
async function say(chat: number, text: string, markup?: unknown) {
  const r = await tg("sendMessage", { chat_id: chat, text, parse_mode: "HTML", reply_markup: markup, disable_web_page_preview: true });
  if (!r.ok && r.error_code === 403) await db.from("sc_users").update({ blocked: true }).eq("user_id", chat);
  return r;
}
async function typing(chat: number, ms = 1500) {
  await tg("sendChatAction", { chat_id: chat, action: "typing" });
  await sleep(ms);
}
async function kv(key: string): Promise<string | null> {
  return (await db.from("sc_kv").select("value").eq("key", key).maybeSingle()).data?.value ?? null;
}
async function setKv(key: string, value: string) {
  await db.from("sc_kv").upsert({ key, value });
}
async function user(id: number): Promise<Row | null> {
  return (await db.from("sc_users").select("*").eq("user_id", id).maybeSingle()).data;
}
async function upd(id: number, patch: Record<string, unknown>) {
  await db.from("sc_users").update(patch).eq("user_id", id);
}

// ---------------------------------------------------------------- состоит ли человек в закрытой группе
async function isMember(uid: number): Promise<boolean> {
  const group = await kv("group_id");
  if (!group) return false;
  const r = await tg("getChatMember", { chat_id: Number(group), user_id: uid });
  return r.ok && ["member", "administrator", "creator", "restricted"].includes(r.result?.status);
}

// ---------------------------------------------------------------- шаги воронки
// Весь тест — одно сообщение: вопрос меняется на месте, чат не засоряется.
const qText = (n: number) => `<b>Вопрос ${n + 1} из ${T.QUESTIONS.length}</b>\n\n${T.QUESTIONS[n]}`;
const qKb = (n: number) => kb([{ text: "Да", callback_data: `q:${n}:1` }, { text: "Нет", callback_data: `q:${n}:0` }]);
async function askQuestion(chat: number, n: number, editId?: number) {
  if (editId) {
    const r = await tg("editMessageText", { chat_id: chat, message_id: editId, text: qText(n), parse_mode: "HTML", reply_markup: qKb(n) });
    if (r.ok) return;
  }
  await say(chat, qText(n), qKb(n));
}
async function sendOffer(chat: number) {
  const cached = await kv("video_file_id");
  const video = cached ?? `${WEBAPP_URL}/${T.VIDEO_FILE}`;
  const r = await tg("sendVideo", {
    chat_id: chat, video, caption: T.OFFER, parse_mode: "HTML", supports_streaming: true,
    width: 1080, height: 1920, reply_markup: payKb(T.OFFER_BTN),
  });
  if (r.ok && !cached && r.result?.video?.file_id) await setKv("video_file_id", r.result.video.file_id);
  if (!r.ok) { // видео не ушло — продаём текстом, чтобы воронка не сломалась
    console.error("sendVideo", r.description);
    await say(chat, T.OFFER, payKb(T.OFFER_BTN));
  }
  await upd(chat, { offer_at: now() });
}

async function onStart(from: any, payload: string) {
  const id = from.id;
  const u = await user(id);
  if (!u) {
    await db.from("sc_users").insert({
      user_id: id, username: from.username ?? null, first_name: from.first_name ?? null,
      src: payload ? payload.slice(0, 40) : null, started_at: now(),
    });
  } else {
    await upd(id, { blocked: false, username: from.username ?? null });
    if (u.member_at && !u.left_at) return void await say(id, T.ALREADY);
    if (u.offer_at) return void await sendOffer(id); // уже всё видел — сразу оффер
  }
  await say(id, T.START, kb([{ text: T.START_BTN, callback_data: "go" }]));
}

async function onCallback(cq: any) {
  const id = cq.from.id;
  const data: string = cq.data ?? "";
  await tg("answerCallbackQuery", { callback_query_id: cq.id });
  const u = await user(id);
  if (!u) return onStart(cq.from, "");
  const msg = cq.message;
  const dropButtons = () => msg && tg("editMessageReplyMarkup", { chat_id: id, message_id: msg.message_id });

  if (data === "go") {
    if (u.q >= T.QUESTIONS.length) {
      await dropButtons();
      return void await sendOffer(id);
    }
    await upd(id, { q: 0, yes: 0 });
    return void await askQuestion(id, 0, msg?.message_id); // приветствие превращается в первый вопрос
  }
  if (data === "resume") {
    await dropButtons();
    if (u.q < T.QUESTIONS.length) return void await askQuestion(id, u.q, msg?.message_id);
    return void await sendOffer(id);
  }
  if (data.startsWith("q:")) {
    const [, nS, aS] = data.split(":");
    const n = Number(nS), yes = aS === "1";
    if (n !== u.q) return; // старая кнопка — игнор
    const q = n + 1, total = u.yes + (yes ? 1 : 0);
    await upd(id, { q, yes: total });
    if (q < T.QUESTIONS.length) return void await askQuestion(id, q, msg?.message_id);
    // тест пройден — то же сообщение превращается в результат с крючком
    const text = `<b>Твой результат: ${total} из ${T.QUESTIONS.length}</b>\n\n${T.result(total)}\n\n${T.HOOK}`;
    const markup = kb([{ text: T.HOOK_BTN, callback_data: "why" }]);
    const r = msg ? await tg("editMessageText", { chat_id: id, message_id: msg.message_id, text, parse_mode: "HTML", reply_markup: markup }) : { ok: false };
    if (!r.ok) await say(id, text, markup);
    return;
  }
  if (data === "why") {
    await dropButtons();
    await typing(id, 1500);
    return void await say(id, T.WHY, kb([{ text: T.WHY_BTN, callback_data: "watch" }]));
  }
  if (data === "watch") {
    await dropButtons();
    await tg("sendChatAction", { chat_id: id, action: "upload_video" });
    return void await sendOffer(id);
  }
}

// ---------------------------------------------------------------- админ
async function stats(): Promise<string> {
  const all = ((await db.from("sc_users").select("started_at,q,offer_at,member_at,left_at,src")).data ?? []) as Row[];
  const day = now() - 86400;
  const c = (f: (u: Row) => unknown) => all.filter(f).length;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0) + "%";
  const started = all.length;
  const tested = c((u) => u.q >= T.QUESTIONS.length);
  const offered = c((u) => u.offer_at);
  const members = c((u) => u.member_at && !u.left_at);
  const bySrc: Record<string, [number, number]> = {};
  for (const u of all) {
    const k = u.src || "без метки";
    bySrc[k] ??= [0, 0];
    bySrc[k][0]++;
    if (u.member_at && !u.left_at) bySrc[k][1]++;
  }
  const src = Object.entries(bySrc).sort((a, b) => b[1][0] - a[1][0]).slice(0, 10)
    .map(([k, [s, m]]) => `• ${esc(k)}: ${s} → ${m} в клубе`).join("\n");
  return `<b>SelfClub — воронка</b>
Запустили бота: ${started} (за сутки ${c((u) => u.started_at > day)})
Прошли тест: ${tested} (${pct(tested, started)})
Дошли до видео: ${offered} (${pct(offered, started)})
В клубе сейчас: ${members} (${pct(members, started)} от запустивших)
Вышли из клуба: ${c((u) => u.left_at)}

<b>Источники</b> (метка из ссылки ?start=…)
${src || "—"}`;
}

async function onMessage(m: any) {
  const from = m.from;
  if (!from || m.chat?.type !== "private") return;
  const text: string = m.text ?? "";
  if (text.startsWith("/start")) return onStart(from, text.split(" ")[1] ?? "");
  if (ADMINS.has(from.id)) {
    if (text === "/stats") return void await say(from.id, await stats());
    // ответ на пересланный вопрос: reply на сообщение бота с #u<id>
    const ref = m.reply_to_message?.text?.match(/#u(\d+)/);
    if (ref && text) {
      const r = await say(Number(ref[1]), esc(text));
      return void await say(from.id, r.ok ? "Отправил ✅" : `Не дошло: ${esc(r.description ?? "")}`);
    }
    if (text === "/help" || text === "/admin") return void await say(from.id,
      "/stats — воронка и источники\nОтветить человеку — сделай reply на его пересланное сообщение.");
  }
  if (!text) return;
  const name = esc([from.first_name, from.username ? "@" + from.username : ""].filter(Boolean).join(" "));
  for (const a of ADMINS) {
    await say(a, `💬 <b>${name}</b> #u${from.id}\n\n${esc(text)}\n\n<i>Ответь reply на это сообщение — бот перешлёт.</i>`);
  }
  await say(from.id, T.GOT_TEXT);
}

// бота добавили в группу / люди вступают и выходят
async function onChatMember(cm: any, mine: boolean) {
  const chat = cm.chat;
  if (!chat || (chat.type !== "supergroup" && chat.type !== "group")) return;
  const st: string = cm.new_chat_member?.status ?? "";
  if (mine) {
    if (st === "administrator") await setKv("group_id", String(chat.id));
    return;
  }
  const member = cm.new_chat_member?.user;
  if (!member?.id || member.is_bot) return;
  const u = await user(member.id);
  if (["member", "administrator", "restricted"].includes(st)) {
    if (u) {
      const first = !u.member_at;
      await upd(member.id, { member_at: u.member_at ?? now(), left_at: null });
      if (first) await say(member.id, T.WELCOME);
    }
  } else if (["left", "kicked"].includes(st) && u?.member_at) {
    await upd(member.id, { left_at: now() });
  }
}

// ---------------------------------------------------------------- напоминания
async function sweep(force = false) {
  const t = now();
  const last = Number(await kv("sweep_at") ?? 0);
  if (!force && t - last < 600) return { skipped: true };
  await setKv("sweep_at", String(t));
  let sent = 0;
  // 1) начал, но не дошёл до видео
  const stuck = ((await db.from("sc_users").select("*").is("offer_at", null).is("nudge_at", null).eq("blocked", false)
    .lt("started_at", t - T.NUDGE_HOURS * 3600).gt("started_at", t - 7 * 86400).limit(50)).data ?? []) as Row[];
  for (const u of stuck) {
    await upd(u.user_id, { nudge_at: t });
    const r = await say(u.user_id, T.NUDGE, kb([{ text: T.NUDGE_BTN, callback_data: u.q > 0 ? "resume" : "go" }]));
    if (r.ok) sent++;
  }
  // 2) видел оффер, не вступил
  const steps = [
    { field: "remind1_at", hours: T.REMIND1_HOURS, text: T.REMIND1, btn: T.REMIND1_BTN },
    { field: "remind2_at", hours: T.REMIND2_HOURS, text: T.REMIND2, btn: T.REMIND2_BTN },
  ];
  for (const s of steps) {
    let q = db.from("sc_users").select("*").is("member_at", null).is(s.field, null).eq("blocked", false)
      .lt("offer_at", t - s.hours * 3600).gt("offer_at", t - 14 * 86400);
    if (s.field === "remind2_at") q = q.not("remind1_at", "is", null);
    const due = ((await q.limit(50)).data ?? []) as Row[];
    for (const u of due) {
      if (await isMember(u.user_id)) {
        await upd(u.user_id, { member_at: t });
        continue;
      }
      await upd(u.user_id, { [s.field]: t });
      const r = await say(u.user_id, s.text, payKb(s.btn));
      if (r.ok) sent++;
    }
  }
  return { sent };
}

// ---------------------------------------------------------------- маршруты
Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v1/, "").replace(/\/$/, "");
  try {
    if (path === "/selfclub/webhook" && req.method === "POST") {
      if (req.headers.get("x-telegram-bot-api-secret-token") !== SECRET) return new Response("bad secret", { status: 403 });
      const u = await req.json();
      try {
        if (u.message) await onMessage(u.message);
        else if (u.callback_query) await onCallback(u.callback_query);
        else if (u.my_chat_member) await onChatMember(u.my_chat_member, true);
        else if (u.chat_member) await onChatMember(u.chat_member, false);
      } catch (e) {
        console.error(e);
      }
      try {
        await sweep(); // заодно напоминания (не чаще раза в 10 минут)
      } catch (e) {
        console.error("sweep", e);
      }
      return json({ ok: true });
    }
    if (!SETUP_KEY || url.searchParams.get("key") !== SETUP_KEY) return new Response("bad key", { status: 403 });
    if (path === "/selfclub/setup") {
      if (!TOKEN) return json({ error: "SELFCLUB_BOT_TOKEN не задан" }, 500);
      const self = `${Deno.env.get("SUPABASE_URL")}/functions/v1/selfclub/webhook`;
      const a = await tg("setWebhook", {
        url: self, secret_token: SECRET,
        allowed_updates: ["message", "callback_query", "my_chat_member", "chat_member"],
      });
      const b = await tg("setMyCommands", { commands: [{ command: "start", description: "Начать" }] });
      return json({ webhook: a, commands: b });
    }
    if (path === "/selfclub/cron") return json(await sweep(true));
    if (path === "/selfclub/stats") return json({ text: await stats() });
    return new Response("not found", { status: 404 });
  } catch (e) {
    console.error(e);
    return json({ error: String(e) }, 500);
  }
});
