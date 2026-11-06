// LOOKSY STORE — серверная функция Supabase: API мини-аппа, админка и вебхук Telegram-бота.
// Все пути начинаются с /api/... (имя функции), мини-апп вызывает их по адресу .../functions/v1/api/...
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const BOT_TOKEN = Deno.env.get("BOT_TOKEN") ?? "";
const ADMIN_IDS = new Set((Deno.env.get("ADMIN_IDS") ?? "").split(",").map((s) => Number(s.trim())).filter(Boolean));
const WEBAPP_URL = (Deno.env.get("WEBAPP_URL") ?? "").replace(/\/$/, "");
const SHOP_NAME = Deno.env.get("SHOP_NAME") ?? "LOOKSY STORE";
const SETUP_KEY = Deno.env.get("SETUP_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("WEBHOOK_SECRET") ?? "";
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
let BOT_USERNAME = Deno.env.get("BOT_USERNAME") ?? "";
const GEMINI_KEY = Deno.env.get("GEMINI_API_KEY") ?? "";
const GEMINI_MODELS = [Deno.env.get("GEMINI_IMAGE_MODEL"), "gemini-nano-banana-2.1", "gemini-2.5-flash-image"].filter(Boolean) as string[];

// Модели бренда для нейро-фото. Одни и те же описания — чтобы на всех фото была «наша» модель.
const AI_PRESETS: Record<string, string> = {
  lisa: "a slim young woman about 23 years old with long straight dark-brown hair and natural makeup, standing on a snowy city street in soft daylight, full body, relaxed natural pose",
  lisa_noface: "a slim young woman, framed from chin to knees so the face is not visible, plain light-grey studio wall, soft daylight, front view",
  mila: "a young woman about 25 years old with a blonde bob haircut and natural makeup, in a bright minimalist fitting room with a large mirror, full body, natural pose",
  max: "a young man about 25 years old with short dark hair and light stubble, standing on a winter city street, full body, relaxed natural pose",
};

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-init-data",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8" } });
const err = (status: number, text: string) => new Response(text, { status, headers: CORS });
class HttpError extends Error {
  constructor(public status: number, msg: string) { super(msg); }
}
const now = () => Math.floor(Date.now() / 1000);
const intOrNull = (v: unknown) => {
  const s = String(v ?? "").replace(/\s/g, "");
  return s && /^-?\d+$/.test(s) ? Number(s) : null;
};
const rub = (n: number) => n.toLocaleString("ru-RU").replace(/,/g, " ") + " ₽";
const escHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));
function must<T>(r: { data: T; error: unknown }): T {
  if (r.error) {
    console.error(r.error);
    throw new HttpError(500, "server error");
  }
  return r.data;
}

// ---------------------------------------------------------------- подпись Telegram

type TgUser = { id: number; username?: string; first_name?: string };
const enc = new TextEncoder();
async function hmac(key: ArrayBuffer | Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
async function checkInitData(initData: string): Promise<TgUser | null> {
  if (!initData || !BOT_TOKEN) return null;
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash") ?? "";
    params.delete("hash");
    const dcs = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("\n");
    const secret = await hmac(enc.encode("WebAppData"), BOT_TOKEN);
    const calc = [...await hmac(secret, dcs)].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (calc !== hash) return null;
    if (now() - Number(params.get("auth_date") ?? 0) > 7 * 86400) return null;
    return JSON.parse(params.get("user") ?? "null");
  } catch {
    return null;
  }
}
const isAdmin = (u: TgUser | null) => !!u && ADMIN_IDS.has(u.id);
function requireAdmin(u: TgUser | null) {
  if (!isAdmin(u)) throw new HttpError(403, "admin only");
}
function requireUser(u: TgUser | null): TgUser {
  if (!u?.id) throw new HttpError(401, "open in Telegram");
  return u;
}

// ---------------------------------------------------------------- Telegram API

async function tg(method: string, body: unknown) {
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
  return r.json();
}
const appButton = (text: string, query: string) => ({
  inline_keyboard: [[{ text, web_app: { url: `${WEBAPP_URL}/?${query}` } }]],
});
async function send(chatId: number | null, text: string, opts: { product?: number; review?: number } = {}) {
  if (!chatId || !BOT_TOKEN) return 0;
  const markup = opts.product
    ? appButton("Посмотреть", `src=bot_msg&p=${opts.product}`)
    : opts.review ? appButton("Оставить отзыв", `src=bot_msg&review=${opts.review}`) : undefined;
  const r = await tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", reply_markup: markup });
  return r.ok ? 1 : 0;
}

// ---------------------------------------------------------------- фото

async function savePhotos(files: File[]): Promise<string[]> {
  const out: string[] = [];
  for (const f of files) {
    if (!f || !f.size) continue;
    if (f.size > 8 * 1024 * 1024) throw new HttpError(413, "photo too large");
    const ext = (f.type.split("/")[1] || "jpg").replace("jpeg", "jpg").slice(0, 4);
    const name = `${crypto.randomUUID().replace(/-/g, "")}.${ext}`;
    must(await db.storage.from("uploads").upload(name, f, { contentType: f.type || "image/jpeg", upsert: false }));
    out.push(name);
  }
  return out;
}
async function removePhotos(names: string[]) {
  if (names.length) await db.storage.from("uploads").remove(names);
}

// ---------------------------------------------------------------- данные

type Product = Record<string, unknown> & { id: number; photos: string[]; sizes: string; colors: string; cost: number | null; promo: string };
function productOut(p: Product, admin: boolean) {
  const q: Record<string, unknown> = { ...p };
  q.sizes = String(p.sizes || "").split(",").map((s) => s.trim()).filter(Boolean);
  q.colors = String(p.colors || "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!admin) {
    delete q.cost;
    if (p.promo === "margin") q.promo = "top"; // покупатель не видит причину продвижения
  }
  return q;
}
const PROMO = new Set(["hit", "fast", "margin"]);
const formStr = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const formFiles = (f: FormData, k: string) => f.getAll(k).filter((x): x is File => x instanceof File);

// ---------------------------------------------------------------- маршруты

async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v1/, "").replace(/\/$/, "");
  const m = req.method;
  if (m === "OPTIONS") return new Response(null, { headers: CORS });

  // вебхук бота — Telegram стучится сюда сам
  if (path === "/api/tg-webhook" && m === "POST") {
    if (WEBHOOK_SECRET && req.headers.get("x-telegram-bot-api-secret-token") !== WEBHOOK_SECRET) return err(403, "bad secret");
    await onUpdate(await req.json());
    return json({ ok: true });
  }
  // разовая настройка вебхука и кнопки меню (вызывает автодеплой)
  if (path === "/api/setup" && m === "POST") {
    if (!SETUP_KEY || url.searchParams.get("key") !== SETUP_KEY) return err(403, "bad key");
    const self = `${Deno.env.get("SUPABASE_URL")}/functions/v1/api/tg-webhook`;
    const a = await tg("setWebhook", { url: self, secret_token: WEBHOOK_SECRET || undefined, allowed_updates: ["message"] });
    const b = await tg("setChatMenuButton", { menu_button: { type: "web_app", text: "Каталог", web_app: { url: `${WEBAPP_URL}/?src=menu` } } });
    return json({ webhook: a, menu: b });
  }

  const user = await checkInitData(req.headers.get("x-init-data") ?? "");
  const admin = isAdmin(user);
  let mm: RegExpMatchArray | null;

  if (path === "/api/me" && m === "GET") {
    if (!BOT_USERNAME && BOT_TOKEN) {
      try { BOT_USERNAME = (await tg("getMe", {})).result?.username ?? ""; } catch { /* имя бота не критично */ }
    }
    return json({ shop: SHOP_NAME, is_admin: admin, bot: BOT_USERNAME, ai: admin && !!GEMINI_KEY });
  }

  if (path === "/api/catalog" && m === "GET") {
    const [cats, prods, summ] = await Promise.all([
      db.from("categories").select("*").order("sort").order("id"),
      db.from("products").select("*").order("sort").order("id", { ascending: false }),
      db.rpc("review_summary"),
    ]);
    const s = new Map((must(summ) as Array<Record<string, number>>).map((r) => [Number(r.product_id), r]));
    const products = (must(prods) as Product[]).map((p) => {
      const r = s.get(p.id);
      return { ...productOut(p, admin), rating: r ? { n: Number(r.n), avg: Number(r.avg), small: Number(r.small), ok: Number(r.ok), big: Number(r.big) } : null };
    });
    return json({ categories: must(cats), products });
  }

  if (path === "/api/event" && m === "POST") {
    const d = await req.json();
    if (!["open", "view", "order_click"].includes(d.type)) return err(400, "bad type");
    await db.from("events").insert({ type: d.type, product_id: intOrNull(d.product_id), user_id: user?.id ?? null, source: String(d.source || "direct").slice(0, 40) });
    return json({ ok: true });
  }

  if (path === "/api/order" && m === "POST") {
    const d = await req.json();
    const name = String(d.name || "").trim().slice(0, 80);
    const phone = String(d.phone || "").trim().slice(0, 40);
    const contact = d.contact === "phone" ? "phone" : "tg";
    if (!name || (contact === "phone" && !phone) || (contact === "tg" && !user?.id)) return err(400, "name and contact required");
    const p = must(await db.from("products").select("*").eq("id", intOrNull(d.product_id)).maybeSingle()) as Product | null;
    if (!p) return err(404, "no product");
    const source = String(d.source || "direct").slice(0, 40);
    const o = must(await db.from("orders").insert({
      product_id: p.id, product_title: p.title, price: p.price, cost: p.cost,
      size: String(d.size || "").slice(0, 20), color: String(d.color || "").slice(0, 40),
      name, phone, contact, city: String(d.city || "").slice(0, 120), comment: String(d.comment || "").slice(0, 500),
      user_id: user?.id ?? null, username: user?.username ?? null, source,
    }).select().single()) as Record<string, unknown>;
    await db.from("events").insert({ type: "order", product_id: p.id, user_id: user?.id ?? null, source });
    await notifyAdmins(o);
    return json({ ok: true, order_id: o.id });
  }

  // избранное
  if (path === "/api/favs" && m === "GET") {
    if (!user?.id) return json([]);
    const r = must(await db.from("favorites").select("product_id").eq("user_id", user.id).order("created_at", { ascending: false })) as Array<{ product_id: number }>;
    return json(r.map((x) => x.product_id));
  }
  if (path === "/api/fav" && m === "POST") {
    const u = requireUser(user);
    const d = await req.json();
    const pid = intOrNull(d.product_id);
    if (d.on) must(await db.from("favorites").upsert({ user_id: u.id, product_id: pid, created_at: now() }));
    else must(await db.from("favorites").delete().eq("user_id", u.id).eq("product_id", pid));
    return json({ ok: true });
  }

  // отзывы
  if (path === "/api/reviews" && m === "GET") {
    const r = must(await db.from("reviews").select("id,name,rating,fit,text,photos,created_at")
      .eq("product_id", intOrNull(url.searchParams.get("product_id"))).eq("status", "ok").order("id", { ascending: false }).limit(50)) as Array<Record<string, unknown>>;
    return json(r.map((v) => ({ ...v, photos: JSON.stringify(v.photos ?? []) })));
  }
  if ((mm = path.match(/^\/api\/review\/order\/(\d+)$/)) && m === "GET") {
    const u = requireUser(user);
    const o = must(await db.from("orders").select("id,product_id,product_title,size,color,status,user_id").eq("id", Number(mm[1])).maybeSingle()) as Record<string, unknown> | null;
    if (!o || o.user_id !== u.id) return err(404, "not found");
    const done = must(await db.from("reviews").select("id").eq("order_id", o.id).maybeSingle());
    return json({ ...o, reviewed: !!done });
  }
  if (path === "/api/review" && m === "POST") {
    const u = requireUser(user);
    const f = await req.formData();
    const oid = intOrNull(formStr(f, "order_id"));
    const rating = intOrNull(formStr(f, "rating")) ?? 0;
    if (rating < 1 || rating > 5) return err(400, "rating 1-5");
    const o = must(await db.from("orders").select("*").eq("id", oid).maybeSingle()) as Record<string, unknown> | null;
    if (!o || o.user_id !== u.id || !["sent", "done"].includes(String(o.status))) return err(403, "review only after delivery");
    if (must(await db.from("reviews").select("id").eq("order_id", oid).maybeSingle())) return err(409, "already reviewed");
    const fit = formStr(f, "fit");
    const photos = await savePhotos(formFiles(f, "photos").slice(0, 5));
    must(await db.from("reviews").insert({
      product_id: o.product_id, order_id: oid, user_id: u.id, name: String(o.name || u.first_name || "Покупатель").slice(0, 40),
      rating, fit: ["small", "ok", "big"].includes(fit) ? fit : null, text: formStr(f, "text").slice(0, 1000), photos,
    }));
    for (const aid of ADMIN_IDS) await send(aid, `⭐️ Новый отзыв (${rating}/5) на «${escHtml(String(o.product_title))}» — проверьте во вкладке «Отзывы» в админке.`);
    return json({ ok: true });
  }

  // ---------------- админка
  if (path.startsWith("/api/admin/")) requireAdmin(user);

  if (path === "/api/admin/product" && m === "POST") {
    const f = await req.formData();
    const price = intOrNull(formStr(f, "price"));
    if (!formStr(f, "title") || price === null) return err(400, "title and price required");
    const photos = await savePhotos(formFiles(f, "photos"));
    const r = must(await db.from("products").insert({
      category_id: intOrNull(formStr(f, "category_id")), title: formStr(f, "title"), description: formStr(f, "description"), price,
      old_price: intOrNull(formStr(f, "old_price")), cost: intOrNull(formStr(f, "cost")),
      promo: PROMO.has(formStr(f, "promo")) ? formStr(f, "promo") : "", sizes: formStr(f, "sizes"), colors: formStr(f, "colors"),
      photos, in_stock: formStr(f, "in_stock") !== "0",
    }).select("id").single()) as { id: number };
    return json({ ok: true, id: r.id });
  }
  if ((mm = path.match(/^\/api\/admin\/product\/(\d+)$/))) {
    const pid = Number(mm[1]);
    const old = must(await db.from("products").select("*").eq("id", pid).maybeSingle()) as Product | null;
    if (!old) return err(404, "no product");
    if (m === "DELETE") {
      await removePhotos(old.photos);
      must(await db.from("products").delete().eq("id", pid));
      return json({ ok: true });
    }
    if (m === "PUT") {
      const f = await req.formData();
      const price = intOrNull(formStr(f, "price"));
      const title = formStr(f, "title");
      if (!title || price === null) return err(400, "title and price required");
      let keep: string[] = [];
      try { keep = JSON.parse(formStr(f, "keep_photos") || "[]"); } catch { /* пусто */ }
      keep = keep.filter((x) => old.photos.includes(x));
      await removePhotos(old.photos.filter((x) => !keep.includes(x)));
      const added = await savePhotos(formFiles(f, "photos"));
      const inStock = formStr(f, "in_stock") !== "0";
      must(await db.from("products").update({
        category_id: intOrNull(formStr(f, "category_id")), title, description: formStr(f, "description"), price,
        old_price: intOrNull(formStr(f, "old_price")), cost: intOrNull(formStr(f, "cost")),
        promo: PROMO.has(formStr(f, "promo")) ? formStr(f, "promo") : "", sizes: formStr(f, "sizes"), colors: formStr(f, "colors"),
        photos: [...keep, ...added], in_stock: inStock,
      }).eq("id", pid));
      // уведомления из избранного
      let msg = "";
      if (inStock && !old.in_stock) msg = `🔔 «${escHtml(title)}» снова в наличии — ${rub(price)}`;
      else if (inStock && price < Number(old.price)) msg = `🔔 Подешевело: «${escHtml(title)}»\n${rub(Number(old.price))} → <b>${rub(price)}</b>`;
      let notified = 0;
      if (msg) {
        const fans = must(await db.from("favorites").select("user_id").eq("product_id", pid)) as Array<{ user_id: number }>;
        for (const fan of fans) notified += await send(fan.user_id, msg, { product: pid });
      }
      return json({ ok: true, notified });
    }
  }
  // нейро-фото: надеть вещь с фото товара на модель бренда
  if (path === "/api/admin/ai-photo" && m === "POST") {
    if (!GEMINI_KEY) return err(501, "no ai key");
    const d = await req.json();
    const pid = Number(d.product_id);
    const p = must(await db.from("products").select("*").eq("id", pid).maybeSingle()) as Product | null;
    if (!p) return err(404, "no product");
    const src = String(d.photo || p.photos[0] || "");
    if (!p.photos.includes(src)) return err(400, "photo not in product");
    const scene = AI_PRESETS[d.preset] ?? AI_PRESETS.lisa;
    const srcUrl = /^https?:/.test(src) ? src : `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/uploads/${src}`;
    const imgRes = await fetch(srcUrl);
    if (!imgRes.ok) return err(502, "source photo unavailable");
    const bytes = new Uint8Array(await imgRes.arrayBuffer());
    let b64 = "";
    for (let i = 0; i < bytes.length; i += 0x8000) b64 += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    b64 = btoa(b64);
    const prompt =
      `Product photo for an online clothing store. Take the garment from the reference image and dress ${scene} in it. ` +
      `Keep the garment exactly identical to the reference: same color and shade, material and texture, fur, collar, closures, buttons, zippers, pockets, belt, length, cut and proportions. ` +
      `Do not add or remove any details of the garment. Simple neutral outfit underneath (plain top, straight jeans or trousers, simple shoes). ` +
      `Realistic photo like a good smartphone shot, natural light, vertical 3:4 frame, the garment fully visible. No text, no logos, no watermarks, no brand names.` +
      (d.extra ? ` Additional wishes: ${String(d.extra).slice(0, 300)}` : "");
    let out: { data: string; mime: string } | null = null;
    let lastErr = "";
    for (const model of GEMINI_MODELS) {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": GEMINI_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: imgRes.headers.get("content-type") || "image/jpeg", data: b64 } }] }],
          generationConfig: { responseModalities: ["IMAGE"] },
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { lastErr = j?.error?.message ?? `HTTP ${r.status}`; if (r.status === 404) continue; break; }
      for (const part of j?.candidates?.[0]?.content?.parts ?? []) {
        const inl = part.inlineData ?? part.inline_data;
        if (inl?.data) { out = { data: inl.data, mime: inl.mimeType ?? inl.mime_type ?? "image/png" }; break; }
      }
      if (out) break;
      lastErr = "model returned no image";
      break;
    }
    if (!out) { console.error("ai-photo:", lastErr); return err(502, `Нейросеть не вернула фото: ${lastErr}`.slice(0, 300)); }
    const bin = Uint8Array.from(atob(out.data), (c) => c.charCodeAt(0));
    const ext = out.mime.includes("png") ? "png" : "jpg";
    const name = `ai_${crypto.randomUUID().replace(/-/g, "")}.${ext}`;
    must(await db.storage.from("uploads").upload(name, bin, { contentType: out.mime }));
    const photos = [...p.photos, name];
    must(await db.from("products").update({ photos }).eq("id", pid));
    return json({ ok: true, name, photos });
  }

  if (path === "/api/admin/category" && m === "POST") {
    const d = await req.json();
    const name = String(d.name || "").trim().slice(0, 60);
    const grp = d.grp === "m" ? "m" : "w";
    if (!name) return err(400, "name required");
    if (d.id) must(await db.from("categories").update({ name, grp }).eq("id", Number(d.id)));
    else {
      const last = must(await db.from("categories").select("sort").order("sort", { ascending: false }).limit(1)) as Array<{ sort: number }>;
      must(await db.from("categories").insert({ name, grp, sort: (last[0]?.sort ?? 0) + 1 }));
    }
    return json({ ok: true });
  }
  if ((mm = path.match(/^\/api\/admin\/category\/(\d+)$/)) && m === "DELETE") {
    must(await db.from("categories").delete().eq("id", Number(mm[1])));
    return json({ ok: true });
  }
  if (path === "/api/admin/orders" && m === "GET") {
    return json(must(await db.from("orders").select("*").order("id", { ascending: false }).limit(200)));
  }
  if ((mm = path.match(/^\/api\/admin\/order\/(\d+)\/status$/)) && m === "POST") {
    const d = await req.json();
    if (!["new", "paid", "sent", "done", "cancel"].includes(d.status)) return err(400, "bad status");
    const oid = Number(mm[1]);
    const o = must(await db.from("orders").select("*").eq("id", oid).maybeSingle()) as Record<string, unknown> | null;
    must(await db.from("orders").update({ status: d.status }).eq("id", oid));
    let asked = false;
    if (d.status === "done" && o && o.status !== "done" && o.user_id) {
      asked = !!(await send(Number(o.user_id),
        `Как вам «${escHtml(String(o.product_title))}»? 🤍\n\nОставьте короткий отзыв и, если не сложно, фото — это очень помогает другим с выбором размера.`,
        { review: oid }));
    }
    return json({ ok: true, review_asked: asked });
  }
  if (path === "/api/admin/reviews" && m === "GET") {
    const r = must(await db.from("reviews").select("*, products(title)").order("id", { ascending: false }).limit(200)) as Array<Record<string, unknown>>;
    const out: Array<Record<string, unknown>> = r.map((v) => ({ ...v, product_title: (v.products as { title?: string } | null)?.title ?? null, photos: JSON.stringify(v.photos ?? []) }));
    out.sort((a, b) => Number(b.status === "pending") - Number(a.status === "pending"));
    return json(out);
  }
  if ((mm = path.match(/^\/api\/admin\/review\/(\d+)$/)) && m === "POST") {
    const d = await req.json();
    const rid = Number(mm[1]);
    if (d.status === "delete") {
      const r = must(await db.from("reviews").select("photos").eq("id", rid).maybeSingle()) as { photos: string[] } | null;
      await removePhotos(r?.photos ?? []);
      must(await db.from("reviews").delete().eq("id", rid));
    } else if (["ok", "hidden", "pending"].includes(d.status)) {
      must(await db.from("reviews").update({ status: d.status }).eq("id", rid));
    } else return err(400, "bad status");
    return json({ ok: true });
  }
  if (path === "/api/admin/stats" && m === "GET") {
    const days = Number(url.searchParams.get("days") || 7);
    return json(must(await db.rpc("shop_stats", { since: now() - days * 86400 })));
  }

  return err(404, "not found");
}

// ---------------------------------------------------------------- бот

async function notifyAdmins(o: Record<string, unknown>) {
  const who = o.contact === "phone" ? `по телефону ${escHtml(String(o.phone))}`
    : o.username ? `в Telegram: @${o.username}` : `в Telegram: <a href="tg://user?id=${o.user_id}">написать</a>`;
  const text = `🛍 <b>Новый заказ #${o.id}</b>\n\n<b>${escHtml(String(o.product_title))}</b> — ${rub(Number(o.price))}\n` +
    `Размер: ${escHtml(String(o.size || "—"))}   Цвет: ${escHtml(String(o.color || "—"))}\n\n` +
    `Имя: ${escHtml(String(o.name))}\nСвязь: ${who}\nГород: ${escHtml(String(o.city || "—"))}\n` +
    `Комментарий: ${escHtml(String(o.comment || "—"))}\n\nИсточник: ${escHtml(String(o.source))}`;
  for (const aid of ADMIN_IDS) await send(aid, text);
}

async function onUpdate(u: { message?: { text?: string; chat: { id: number }; from?: { id: number } } }) {
  const msg = u.message;
  if (!msg?.text) return;
  const chat = msg.chat.id;
  const [cmd, arg = ""] = msg.text.trim().split(/\s+/, 2);
  if (cmd === "/id") {
    await tg("sendMessage", { chat_id: chat, text: `Твой Telegram ID: <code>${msg.from?.id}</code>`, parse_mode: "HTML" });
  } else if (cmd === "/admin" && ADMIN_IDS.has(msg.from?.id ?? 0)) {
    await tg("sendMessage", { chat_id: chat, text: "Админка открывается в мини-аппе — значок настроек в шапке.", reply_markup: appButton("⚙️ Открыть", "src=admin") });
  } else if (cmd === "/start") {
    if (/^p_\d+$/.test(arg)) {
      const p = must(await db.from("products").select("id,title,price").eq("id", Number(arg.slice(2))).maybeSingle()) as { id: number; title: string; price: number } | null;
      if (p) {
        await tg("sendMessage", { chat_id: chat, text: `<b>${escHtml(p.title)}</b> — ${rub(p.price)}`, parse_mode: "HTML", reply_markup: appButton("👀 Посмотреть", `src=share&p=${p.id}`) });
        return;
      }
    }
    const src = encodeURIComponent((arg || "bot").slice(0, 40));
    await tg("sendMessage", {
      chat_id: chat, parse_mode: "HTML",
      text: `Привет! Это <b>${escHtml(SHOP_NAME)}</b> 👋\n\nЖенская и мужская одежда напрямую с производства — без наценки маркетплейсов.\n\n` +
        "Открой каталог, выбери вещь и размер — менеджер свяжется с тобой, подтвердит наличие и поможет с доставкой.",
      reply_markup: appButton("🛍 Открыть каталог", `src=${src}`),
    });
  }
}

Deno.serve(async (req) => {
  try {
    return await handle(req);
  } catch (e) {
    if (e instanceof HttpError) return err(e.status, e.message);
    console.error(e);
    return err(500, "server error");
  }
});
