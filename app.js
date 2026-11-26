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
  let pendientes = []; // { id, texto, hecho, created_at }
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
      .select("id, texto, hecho, created_at")
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
    input.value = "";
    const temporal = { id: "tmp-" + Date.now(), texto, hecho: false, created_at: new Date().toISOString() };
    pendientes.unshift(temporal);
    pintar();
    const { data, error } = await sb.from("pendientes").insert({ texto }).select().single();
    const i = pendientes.findIndex((x) => x.id === temporal.id);
    if (error) {
      if (i >= 0) pendientes.splice(i, 1);
      input.value = texto;
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

  async function borrar(p) {
    const copia = pendientes.slice();
    pendientes = pendientes.filter((x) => x.id !== p.id);
    pintar();
    const { error } = await sb.from("pendientes").delete().eq("id", p.id);
    if (error) { pendientes = copia; pintar(); avisar("No se pudo borrar. " + traducirError(error), true); }
  }

  $("borrar-hechos").addEventListener("click", async () => {
    const hechos = pendientes.filter((x) => x.hecho);
    if (!hechos.length) return;
    const copia = pendientes.slice();
    pendientes = pendientes.filter((x) => !x.hecho);
    pintar();
    const { error } = await sb.from("pendientes").delete().in("id", hechos.map((x) => x.id));
    if (error) { pendientes = copia; pintar(); avisar("No se pudieron borrar. " + traducirError(error), true); }
  });

  // ---------- Pintar ----------
  function avisar(texto, esError) {
    const el = $("estado");
    el.textContent = texto;
    el.className = esError ? "msg error" : "msg";
  }

  function item(p) {
    const li = document.createElement("li");
    li.className = "item" + (p.hecho ? " hecho" : "");
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = p.hecho;
    check.setAttribute("aria-label", "Marcar como hecho");
    check.disabled = String(p.id).startsWith("tmp-");
    check.addEventListener("change", () => alternar(p));
    const span = document.createElement("span");
    span.className = "texto";
    span.textContent = p.texto;
    const del = document.createElement("button");
    del.className = "borrar";
    del.setAttribute("aria-label", "Borrar");
    del.textContent = "×";
    del.disabled = check.disabled;
    del.addEventListener("click", () => borrar(p));
    li.append(check, span, del);
    return li;
  }

  function pintar() {
    const abiertos = pendientes.filter((x) => !x.hecho);
    const hechos = pendientes.filter((x) => x.hecho);
    $("lista").replaceChildren(...abiertos.map(item));
    $("lista-hechos").replaceChildren(...hechos.map(item));
    $("vacio").hidden = abiertos.length > 0;
    $("hechos-wrap").hidden = hechos.length === 0;
    $("hechos-n").textContent = hechos.length;
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
