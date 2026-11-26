// Pendientes: lista sincronizada entre celular y escritorio con Supabase.
(function () {
  "use strict";

  const cfg = window.PENDIENTES_CONFIG;
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });

  const $ = (id) => document.getElementById(id);
  const vistaLogin = $("vista-login");
  const vistaLista = $("vista-lista");
  const btnSalir = $("salir");

  let usuario = null;
  let pendientes = []; // { id, texto, hecho, urgencia, created_at }
  let filtro = 0; // 0 = todos, 1..3 = solo esa urgencia
  const NOMBRE_URG = { 1: "Baja", 2: "Media", 3: "Alta" };
  const expandidos = new Set(); // ids de pendientes con la descripción abierta

  // Minimizar la columna de Hechos (se recuerda en este dispositivo).
  let hechosMin = false;
  try { hechosMin = localStorage.getItem("hechosMin") === "1"; } catch (_) {}
  function aplicarHechosMin() {
    document.querySelector(".columnas").classList.toggle("hechos-min", hechosMin);
    $("hechos-cuerpo").hidden = hechosMin;
    $("min-hechos").setAttribute("aria-expanded", String(!hechosMin));
    $("min-hechos-texto").textContent = hechosMin ? "Mostrar" : "Minimizar";
  }
  function alternarHechos() {
    hechosMin = !hechosMin;
    try { localStorage.setItem("hechosMin", hechosMin ? "1" : "0"); } catch (_) {}
    aplicarHechosMin();
  }
  $("min-hechos").addEventListener("click", alternarHechos);
  $("tab-hechos").addEventListener("click", alternarHechos);

  // Tema claro / oscuro: sigue al sistema hasta que eliges uno; la elección se recuerda.
  const raiz = document.documentElement;
  const sistemaOscuro = window.matchMedia("(prefers-color-scheme: dark)");
  function temaActual() { return raiz.dataset.theme || (sistemaOscuro.matches ? "dark" : "light"); }
  function pintarTema() {
    const t = temaActual();
    raiz.dataset.temaActual = t;
    $("tema").setAttribute("aria-label", t === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro");
    document.querySelector('meta[name="theme-color"]').setAttribute("content", t === "dark" ? "#17110d" : "#f76707");
  }
  $("tema").addEventListener("click", () => {
    const nuevo = temaActual() === "dark" ? "light" : "dark";
    raiz.dataset.theme = nuevo;
    try { localStorage.setItem("tema", nuevo); } catch (_) {}
    pintarTema();
  });
  sistemaOscuro.addEventListener("change", pintarTema);
  pintarTema();
  aplicarHechosMin();
  let canal = null;
  let modoRegistro = false;

  // ---------- Ingreso ----------
  function pintarModoLogin() {
    $("btn-login").textContent = modoRegistro ? "Crear cuenta" : "Entrar";
    $("btn-cambiar-modo").textContent = modoRegistro
      ? "¿Ya tienes cuenta? Entrar"
      : "¿No tienes cuenta? Crear una";
    $("password").autocomplete = modoRegistro ? "new-password" : "current-password";
    $("login-msg").textContent = "";
  }

  $("btn-cambiar-modo").addEventListener("click", () => {
    modoRegistro = !modoRegistro;
    pintarModoLogin();
  });

  $("form-login").addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = $("email").value.trim();
    const password = $("password").value;
    const msg = $("login-msg");
    const btn = $("btn-login");
    btn.disabled = true;
    msg.className = "msg";
    msg.textContent = modoRegistro ? "Creando cuenta…" : "Entrando…";

    try {
      if (modoRegistro) {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: location.origin + location.pathname },
        });
        if (error) throw error;
        if (!data.session) {
          msg.textContent =
            "Te enviamos un correo para confirmar tu cuenta. Ábrelo, toca el enlace y luego vuelve aquí para entrar.";
          modoRegistro = false;
          $("btn-login").textContent = "Entrar";
          $("btn-cambiar-modo").textContent = "¿No tienes cuenta? Crear una";
        }
      } else {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      msg.className = "msg error";
      msg.textContent = traducirError(err);
    } finally {
      btn.disabled = false;
    }
  });

  btnSalir.addEventListener("click", () => sb.auth.signOut());

  function traducirError(err) {
    const m = (err && err.message) || String(err);
    if (/invalid login credentials/i.test(m)) return "Correo o contraseña incorrectos.";
    if (/email not confirmed/i.test(m)) return "Primero confirma tu correo con el enlace que te enviamos.";
    if (/already registered/i.test(m)) return "Ese correo ya tiene cuenta. Entra con tu contraseña.";
    if (/at least 6 characters/i.test(m)) return "La contraseña debe tener al menos 6 caracteres.";
    if (/rate limit/i.test(m)) return "Demasiados intentos. Espera un rato y prueba de nuevo.";
    if (/fetch|network/i.test(m)) return "Sin conexión. Revisa tu internet.";
    return m;
  }

  // ---------- Sesión ----------
  sb.auth.onAuthStateChange((_evento, session) => {
    const nuevo = session ? session.user : null;
    if ((nuevo && nuevo.id) === (usuario && usuario.id)) return;
    usuario = nuevo;
    // Salir del callback antes de llamar a Supabase (evita bloqueos internos).
    setTimeout(mostrarVista, 0);
  });

  function mostrarVista() {
    if (usuario) {
      vistaLogin.hidden = true;
      vistaLista.hidden = false;
      btnSalir.hidden = false;
      cargar();
      suscribir();
    } else {
      vistaLista.hidden = true;
      vistaLogin.hidden = false;
      btnSalir.hidden = true;
      pendientes = [];
      pintar();
      if (canal) { sb.removeChannel(canal); canal = null; }
      pintarModoLogin();
    }
  }

  // ---------- Datos ----------
  async function cargar() {
    const { data, error } = await sb
      .from("pendientes")
      .select("id, texto, descripcion, hecho, urgencia, created_at")
      .order("created_at", { ascending: false });
    if (error) return avisar("No se pudieron cargar los pendientes. " + traducirError(error), true);
    pendientes = data;
    avisar("");
    pintar();
  }

  function suscribir() {
    if (canal) sb.removeChannel(canal);
    canal = sb
      .channel("pendientes-" + usuario.id)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pendientes", filter: "user_id=eq." + usuario.id },
        (p) => {
          if (p.eventType === "DELETE") {
            pendientes = pendientes.filter((x) => x.id !== p.old.id);
          } else {
            const fila = p.new;
            const i = pendientes.findIndex((x) => x.id === fila.id);
            if (i >= 0) pendientes[i] = fila;
            else pendientes.unshift(fila);
          }
          pintar();
        }
      )
      .subscribe((estado) => {
        // Si se cortó la conexión y volvió, recargar por si nos perdimos algo.
        if (estado === "SUBSCRIBED") cargar();
      });
  }

  // Al volver a la app (por ejemplo, desbloquear el celular), refrescar.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && usuario) cargar();
  });
  window.addEventListener("online", () => usuario && cargar());

  $("form-nuevo").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("nuevo-texto");
    const texto = input.value.trim();
    if (!texto) return;
    const descInput = $("nuevo-desc");
    const descripcion = descInput.value.trim() || null;
    input.value = "";
    descInput.value = "";
    const urgencia = Number(document.querySelector('input[name="urgencia"]:checked').value);
    const temporal = { id: "tmp-" + Date.now(), texto, descripcion, hecho: false, urgencia, created_at: new Date().toISOString() };
    pendientes.unshift(temporal);
    pintar();
    const { data, error } = await sb.from("pendientes").insert({ texto, descripcion, urgencia }).select().single();
    const i = pendientes.findIndex((x) => x.id === temporal.id);
    if (error) {
      if (i >= 0) pendientes.splice(i, 1);
      input.value = texto;
      descInput.value = descripcion || "";
      avisar("No se pudo guardar. " + traducirError(error), true);
    } else {
      // Puede que el tiempo real ya lo haya agregado.
      if (pendientes.some((x) => x.id === data.id)) { if (i >= 0) pendientes.splice(i, 1); }
      else if (i >= 0) pendientes[i] = data;
      avisar("");
    }
    pintar();
  });

  async function alternar(p) {
    const antes = p.hecho;
    p.hecho = !antes;
    pintar();
    const { error } = await sb.from("pendientes").update({ hecho: p.hecho }).eq("id", p.id);
    if (error) { p.hecho = antes; pintar(); avisar("No se pudo actualizar. " + traducirError(error), true); }
  }

  async function cambiarUrgencia(p) {
    const antes = p.urgencia;
    p.urgencia = antes >= 3 ? 1 : antes + 1;
    pintar();
    const { error } = await sb.from("pendientes").update({ urgencia: p.urgencia }).eq("id", p.id);
    if (error) { p.urgencia = antes; pintar(); avisar("No se pudo cambiar la urgencia. " + traducirError(error), true); }
  }

  document.querySelectorAll(".filtro").forEach((b) =>
    b.addEventListener("click", () => {
      filtro = Number(b.dataset.filtro);
      document.querySelectorAll(".filtro").forEach((x) => x.classList.toggle("activo", x === b));
      pintar();
    })
  );

  async function borrar(p) {
    const copia = pendientes.slice();
    pendientes = pendientes.filter((x) => x.id !== p.id);
    pintar();
    const { error } = await sb.from("pendientes").delete().eq("id", p.id);
    if (error) { pendientes = copia; pintar(); avisar("No se pudo borrar. " + traducirError(error), true); }
  }

  function confirmar(n) {
    const dlg = $("confirmar");
    $("conf-titulo").textContent = n === 1 ? "¿Borrar 1 pendiente hecho?" : "¿Borrar " + n + " pendientes hechos?";
    $("conf-si").textContent = n === 1 ? "Borrar 1" : "Borrar " + n;
    if (typeof dlg.showModal !== "function") return Promise.resolve(window.confirm($("conf-titulo").textContent));
    return new Promise((resolve) => {
      dlg.returnValue = "";
      dlg.addEventListener("close", () => resolve(dlg.returnValue === "si"), { once: true });
      dlg.showModal();
    });
  }

  // Tocar fuera del cuadro lo cierra sin borrar.
  $("confirmar").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close("no"); });

  $("borrar-hechos").addEventListener("click", async () => {
    // Respeta el filtro de urgencia: borra solo los hechos que se están viendo.
    const hechos = pendientes.filter(
      (x) => x.hecho && !String(x.id).startsWith("tmp-") && (!filtro || (x.urgencia || 2) === filtro)
    );
    if (!hechos.length) return;
    if (!(await confirmar(hechos.length))) return;
    const ids = new Set(hechos.map((x) => x.id));
    const copia = pendientes.slice();
    pendientes = pendientes.filter((x) => !ids.has(x.id));
    pintar();
    const { error } = await sb.from("pendientes").delete().in("id", [...ids]);
    if (error) { pendientes = copia; pintar(); avisar("No se pudieron borrar. " + traducirError(error), true); }
  });

  // ---------- Pintar ----------
  function avisar(texto, esError) {
    const el = $("estado");
    el.textContent = texto;
    el.className = esError ? "msg error" : "msg";
  }

  function cuando(fecha) {
    const d = new Date(fecha);
    const hoy = new Date();
    const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
    const mismoDia = (x, y) => x.toDateString() === y.toDateString();
    if (mismoDia(d, hoy)) return "Hoy " + d.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
    if (mismoDia(d, ayer)) return "Ayer";
    return d.toLocaleDateString("es", { day: "numeric", month: "short" });
  }

  function item(p) {
    const u = p.urgencia || 2;
    const temporal = String(p.id).startsWith("tmp-");
    const li = document.createElement("li");
    li.className = "item u" + u + (p.hecho ? " hecho" : "");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.className = "check";
    check.checked = p.hecho;
    check.setAttribute("aria-label", "Marcar como hecho");
    check.disabled = temporal;
    check.addEventListener("change", () => alternar(p));

    const cuerpo = document.createElement("div");
    cuerpo.className = "cuerpo";
    const span = document.createElement("span");
    span.className = "texto";
    span.textContent = p.texto;
    const meta = document.createElement("div");
    meta.className = "meta";
    const badge = document.createElement("button");
    badge.className = "badge";
    badge.textContent = NOMBRE_URG[u];
    badge.title = "Toca para cambiar la urgencia";
    badge.setAttribute("aria-label", "Urgencia " + NOMBRE_URG[u] + ". Toca para cambiarla");
    badge.disabled = temporal;
    badge.addEventListener("click", () => cambiarUrgencia(p));
    const fecha = document.createElement("span");
    fecha.textContent = cuando(p.created_at);
    meta.append(badge, fecha);
    cuerpo.append(span, meta);

    if (p.descripcion) {
      const abierto = expandidos.has(p.id);
      const desc = document.createElement("p");
      desc.className = "descripcion";
      desc.id = "desc-" + p.id;
      desc.textContent = p.descripcion;
      desc.hidden = !abierto;
      const ver = document.createElement("button");
      ver.className = "ver-mas";
      ver.textContent = abierto ? "Ver menos" : "Ver más";
      ver.setAttribute("aria-expanded", String(abierto));
      ver.setAttribute("aria-controls", desc.id);
      ver.addEventListener("click", () => {
        const ahora = !expandidos.has(p.id);
        if (ahora) expandidos.add(p.id); else expandidos.delete(p.id);
        desc.hidden = !ahora;
        ver.textContent = ahora ? "Ver menos" : "Ver más";
        ver.setAttribute("aria-expanded", String(ahora));
      });
      meta.append(ver);
      cuerpo.append(desc);
    }

    const del = document.createElement("button");
    del.className = "borrar";
    del.setAttribute("aria-label", "Borrar");
    del.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
    del.disabled = temporal;
    del.addEventListener("click", () => borrar(p));
    li.append(check, cuerpo, del);
    return li;
  }

  // Más urgentes primero; dentro de la misma urgencia, los más nuevos primero.
  function ordenar(a, b) {
    return (b.urgencia || 2) - (a.urgencia || 2) || String(b.created_at).localeCompare(String(a.created_at));
  }

  function pintar() {
    const abiertos = pendientes.filter((x) => !x.hecho).sort(ordenar);
    const hechos = pendientes.filter((x) => x.hecho).sort(ordenar);
    const porFiltro = (x) => !filtro || (x.urgencia || 2) === filtro;
    const visibles = abiertos.filter(porFiltro);
    const hechosVisibles = hechos.filter(porFiltro);
    $("lista").replaceChildren(...visibles.map(item));
    $("lista-hechos").replaceChildren(...hechosVisibles.map(item));
    $("pend-n").textContent = visibles.length;
    $("hechos-vacio").hidden = hechosVisibles.length > 0;
    $("hechos-vacio").textContent = filtro && hechos.length
      ? "No hay hechos de urgencia " + NOMBRE_URG[filtro].toLowerCase() + "."
      : "Lo que marques como hecho aparecerá aquí.";
    $("borrar-hechos").hidden = hechosVisibles.length === 0;
    $("vacio").hidden = visibles.length > 0;
    $("vacio-texto").textContent = filtro && abiertos.length
      ? "No hay pendientes de urgencia " + NOMBRE_URG[filtro].toLowerCase() + "."
      : "No tienes pendientes. ¡Bien hecho!";
    $("hechos-n").textContent = hechosVisibles.length;
    $("tab-hechos-n").textContent = hechosVisibles.length;
    $("n-0").textContent = abiertos.length;
    [1, 2, 3].forEach((u) => ($("n-" + u).textContent = abiertos.filter((x) => (x.urgencia || 2) === u).length));
    const altas = abiertos.filter((x) => x.urgencia === 3).length;
    const resumen = $("resumen");
    if (!usuario) resumen.textContent = "";
    else if (!abiertos.length) resumen.textContent = "Todo al día";
    else {
      resumen.textContent = abiertos.length + (abiertos.length === 1 ? " pendiente" : " pendientes");
      if (altas) {
        const b = document.createElement("b");
        b.textContent = " · " + altas + (altas === 1 ? " urgente" : " urgentes");
        resumen.append(b);
      }
    }
  }

  // ---------- Instalable / offline ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }

  // Arranque: si no hay sesión guardada, mostrar el ingreso.
  sb.auth.getSession().then(({ data }) => {
    if (!data.session) mostrarVista();
  });
})();
