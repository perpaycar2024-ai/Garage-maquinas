/* ==========================================================================
   MANTRESI PREMIUM - v2 (app.js)
   Hecho hoy + intervalos, km, historial de intervenciones, plantillas
   y edición directa desde la ficha.
   ========================================================================== */

// ==========================================================================
// 1. CONSTANTES Y ESTADO
// ==========================================================================
const UMBRAL_DIAS = 30;      // aviso "próximo" por fecha
const UMBRAL_KM = 1000;      // aviso "próximo" por kilómetros
const RANGO = { ok: 0, revision: 1, taller: 2 };
const INTERVALO_DEFECTO = { fecha: 12, km: 15000 };  // meses / km
const OPCIONES_INTERVALO = {
    fecha: [1, 3, 6, 12, 24, 36, 48],
    km: [5000, 10000, 15000, 20000, 30000, 40000, 60000]
};
const PALABRAS_FECHA = ['fecha', 'vence', 'itv', 'revisi', 'seguro', 'próxim', 'proxim', 'últim', 'ultim',
    'cambio', 'afilad', 'engrase', 'limpieza', 'mantenimiento'];

const PLANTILLAS = {
    vehiculo: {
        etiqueta: 'Vehículo', icono: 'car', tipo: 'vehiculo',
        campos: [
            { nombre: 'ITV (vence)', tipo: 'fecha', alerta: true, intervalo: 12 },
            { nombre: 'Seguro (vence)', tipo: 'fecha', alerta: true, intervalo: 12 },
            { nombre: 'Cambio aceite (fecha)', tipo: 'fecha', alerta: true, intervalo: 12 },
            { nombre: 'Cambio aceite (km)', tipo: 'km', alerta: true, intervalo: 15000 },
            { nombre: 'Neumáticos (km)', tipo: 'km', alerta: true, intervalo: 40000 },
            { nombre: 'Presión ruedas', tipo: 'texto', alerta: false }
        ]
    },
    herramienta: {
        etiqueta: 'Herramienta a motor', icono: 'wrench', tipo: 'maquinaria',
        campos: [
            { nombre: 'Afilado cadena / cuchilla', tipo: 'fecha', alerta: true, intervalo: 6 },
            { nombre: 'Bujía y filtro de aire', tipo: 'fecha', alerta: true, intervalo: 12 },
            { nombre: 'Revisión general', tipo: 'fecha', alerta: true, intervalo: 12 },
            { nombre: 'Mezcla gasolina/aceite', tipo: 'texto', alerta: false }
        ]
    },
    maquina: {
        etiqueta: 'Máquina grande', icono: 'settings', tipo: 'maquinaria',
        campos: [
            { nombre: 'Revisión general', tipo: 'fecha', alerta: true, intervalo: 12 },
            { nombre: 'Cambio aceite motor', tipo: 'fecha', alerta: true, intervalo: 12 },
            { nombre: 'Cuchillas y filtros', tipo: 'fecha', alerta: true, intervalo: 6 }
        ]
    },
    blanco: {
        etiqueta: 'En blanco', icono: 'file', tipo: null,
        campos: [
            { nombre: 'Última Revisión', tipo: 'fecha', alerta: false },
            { nombre: 'Próxima Revisión', tipo: 'fecha', alerta: true, intervalo: 12 }
        ]
    }
};

let appState = {
    equipos: [],
    equipoSeleccionadoId: null,
    filtroActivo: "all"
};

let fichaSucia = false;     // hay un cambio guardado pendiente de repintar la ficha
let toastTimer = null;

const $ = (id) => document.getElementById(id);

// ==========================================================================
// 2. UTILIDADES
// ==========================================================================
function nuevoId(prefijo) {
    return prefijo + Math.random().toString(36).slice(2, 11);
}

function esc(valor) {
    return String(valor == null ? '' : valor)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function aNumeroOnull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : null;
}

function fechaAISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hoyISO() {
    return fechaAISO(new Date());
}

function parsearFechaISO(s) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    const f = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    return isNaN(f.getTime()) ? null : f;
}

function sumarMeses(fecha, meses) {
    const d = new Date(fecha.getFullYear(), fecha.getMonth() + meses, 1);
    const ultimoDia = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(fecha.getDate(), ultimoDia));
    return d;
}

function formatearFechaAMostrar(fechaStr) {
    if (!fechaStr) return "Sin fecha";
    const partes = fechaStr.split("-");
    if (partes.length === 3) return `${partes[2]}/${partes[1]}/${partes[0]}`;
    return fechaStr;
}

function formatearKm(n) {
    return Number(n).toLocaleString('es-ES');
}

function capitalizar(t) {
    return t.charAt(0).toUpperCase() + t.slice(1);
}

function limpiarNombre(nombre) {
    return nombre.replace(/\s*\(.*?\)\s*$/, '').trim() || nombre;
}

function etiquetaIntervalo(tipo, v) {
    if (tipo === 'km') return `${formatearKm(v)} km`;
    if (v % 12 === 0) return `${v / 12} ${v === 12 ? 'año' : 'años'}`;
    return `${v} ${v === 1 ? 'mes' : 'meses'}`;
}

function esCampoPasado(dato) {
    const n = dato.nombre.toLowerCase();
    return n.includes('última') || n.includes('ultima') || n.includes('pasada');
}

function inferirTipo(dato) {
    if (parsearFechaISO(dato.valor)) return 'fecha';
    const n = dato.nombre.toLowerCase();
    if (n.includes('km') && (dato.valor === '' || Number.isFinite(Number(dato.valor)))) return 'km';
    if (dato.valor !== '') return 'texto';
    return PALABRAS_FECHA.some(p => n.includes(p)) ? 'fecha' : 'texto';
}

// ==========================================================================
// 3. NORMALIZACIÓN Y PERSISTENCIA (compatible con datos y backups antiguos)
// ==========================================================================
function normalizarDato(d) {
    const dato = {
        nombre: String((d && d.nombre) || '').trim(),
        valor: (d && d.valor != null) ? String(d.valor) : '',
        alerta: !!(d && d.alerta),
        intervalo: Number(d && d.intervalo) || 0,
        tipo: d && d.tipo
    };
    if (!['fecha', 'km', 'texto'].includes(dato.tipo)) dato.tipo = inferirTipo(dato);
    return dato;
}

function normalizarHistorial(h) {
    return {
        id: (h && h.id) || nuevoId('h_'),
        fecha: (h && h.fecha) || hoyISO(),
        texto: String((h && h.texto) || ''),
        km: aNumeroOnull(h && h.km)
    };
}

function normalizarEquipo(e) {
    return {
        id: e.id || nuevoId('eq_'),
        nombre: e.nombre || e.name || 'Sin nombre',
        tipo: e.tipo || e.type || 'vehiculo',
        estado: e.estado || e.status || 'ok',
        notas: e.notas || '',
        telefono: e.telefono || '',
        km: aNumeroOnull(e.km),
        historial: Array.isArray(e.historial) ? e.historial.map(normalizarHistorial) : [],
        datos: Array.isArray(e.datos) ? e.datos.map(normalizarDato) : []
    };
}

try {
    const datosGuardados = localStorage.getItem('mycar_data');
    if (datosGuardados) {
        const parseados = JSON.parse(datosGuardados);
        if (Array.isArray(parseados)) {
            appState.equipos = parseados.map(normalizarEquipo);
        }
    }
} catch (error) {
    console.warn("No se pudo cargar LocalStorage. Iniciando vacío.", error);
}

function guardarEnLocalStorage() {
    try {
        localStorage.setItem('mycar_data', JSON.stringify(appState.equipos));
    } catch (e) {
        console.error("Error al guardar en LocalStorage", e);
    }
}

function equipoActual() {
    return appState.equipos.find(e => e.id === appState.equipoSeleccionadoId);
}

// ==========================================================================
// 4. INICIALIZACIÓN Y NAVEGACIÓN
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    try {
        renderDashboard();
        configurarEventosGlobales();
        configurarEventosFicha();
        lucide.createIcons();
    } catch (error) {
        console.error("Error crítico en la inicialización:", error);
    }
});

function navegarA(idVistaDestino) {
    const vistas = document.querySelectorAll('.app-view');
    const vistaDestino = $(idVistaDestino);
    if (!vistaDestino) return;
    vistas.forEach(vista => vista.classList.remove('active'));
    vistaDestino.classList.add('active');
    window.scrollTo(0, 0);
}

// ==========================================================================
// 5. MOTOR DE ALERTAS (fecha y kilómetros)
// ==========================================================================
function evaluarDato(equipo, dato) {
    if (!dato.alerta || dato.valor === '' || esCampoPasado(dato)) return null;

    if (dato.tipo === 'fecha') {
        const f = parsearFechaISO(dato.valor);
        if (!f) return null;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const dias = Math.round((f - hoy) / 86400000);
        if (dias < 0) {
            return { nivel: 'taller', urgencia: dias, texto: `vencido hace ${-dias} ${-dias === 1 ? 'día' : 'días'}` };
        }
        if (dias <= UMBRAL_DIAS) {
            const texto = dias === 0 ? 'vence hoy' : dias === 1 ? 'vence mañana' : `vence en ${dias} días`;
            return { nivel: 'revision', urgencia: dias, texto };
        }
        return { nivel: 'ok', urgencia: dias, texto: `faltan ${dias} días` };
    }

    if (dato.tipo === 'km') {
        if (equipo.km === null) return null;
        const resto = Number(dato.valor) - equipo.km;
        if (!Number.isFinite(resto)) return null;
        const urgencia = resto / 50; // aprox. 50 km/día, solo para ordenar junto a las fechas
        if (resto < 0) return { nivel: 'taller', urgencia, texto: `pasado por ${formatearKm(-resto)} km` };
        if (resto <= UMBRAL_KM) return { nivel: 'revision', urgencia, texto: `faltan ${formatearKm(resto)} km` };
        return { nivel: 'ok', urgencia, texto: `faltan ${formatearKm(resto)} km` };
    }

    return null;
}

function obtenerPeorEstadoEquipo(equipo) {
    let peor = equipo.estado || 'ok';
    for (const dato of equipo.datos) {
        const ev = evaluarDato(equipo, dato);
        if (ev && RANGO[ev.nivel] > RANGO[peor]) peor = ev.nivel;
    }
    return peor;
}

function etiquetaEstado(equipo, peor) {
    if (peor === 'ok') return 'Operativo';
    if (peor === 'revision') return 'Revisión pronto';
    const hayVencido = equipo.datos.some(d => {
        const ev = evaluarDato(equipo, d);
        return ev && ev.nivel === 'taller';
    });
    return hayVencido ? 'Alerta vencida' : 'En taller';
}

function alertaMasUrgente(equipo) {
    let mejor = null;
    equipo.datos.forEach(dato => {
        const ev = evaluarDato(equipo, dato);
        if (!ev || ev.nivel === 'ok') return;
        if (!mejor || RANGO[ev.nivel] > RANGO[mejor.ev.nivel] ||
            (ev.nivel === mejor.ev.nivel && ev.urgencia < mejor.ev.urgencia)) {
            mejor = { dato, ev };
        }
    });
    return mejor;
}

// ==========================================================================
// 6. DASHBOARD
// ==========================================================================
function renderDashboard() {
    const contenedor = $("inventory-grid");
    if (!contenedor) return;
    contenedor.innerHTML = "";

    const filas = appState.equipos
        .filter(eq => appState.filtroActivo === "all" || eq.tipo === appState.filtroActivo)
        .map(eq => ({ eq, estado: obtenerPeorEstadoEquipo(eq), urg: alertaMasUrgente(eq) }))
        .sort((a, b) =>
            RANGO[b.estado] - RANGO[a.estado] ||
            (a.urg ? a.urg.ev.urgencia : 1e9) - (b.urg ? b.urg.ev.urgencia : 1e9) ||
            a.eq.nombre.localeCompare(b.eq.nombre, 'es'));

    if (filas.length === 0) {
        contenedor.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <p style="font-size: 1.1rem; margin-bottom: 0.5rem; font-weight: bold;">No hay elementos para mostrar</p>
                <p style="font-size: 0.85rem; opacity: 0.7;">Pulsa el botón "+" de arriba para empezar.</p>
            </div>`;
    } else {
        filas.forEach(({ eq, estado, urg }) => {
            const card = document.createElement("div");
            card.className = `premium-item-card ${estado}`;

            const icono = eq.tipo === "vehiculo" ? "car" : "wrench";
            let subtitulo;
            if (urg) subtitulo = `${limpiarNombre(urg.dato.nombre)} · ${urg.ev.texto}`;
            else if (eq.tipo === "vehiculo") subtitulo = eq.km !== null ? `Vehículo · ${formatearKm(eq.km)} km` : "Vehículo";
            else subtitulo = "Maquinaria / Herramienta";

            card.innerHTML = `
                <div class="card-title-block">
                    <div class="avatar-wrapper-3d"><i data-lucide="${icono}"></i></div>
                    <div>
                        <h3>${esc(eq.nombre)}</h3>
                        <span class="subtitle">${esc(subtitulo)}</span>
                    </div>
                </div>
                <div><span class="status-badge-3d ${estado}">${etiquetaEstado(eq, estado)}</span></div>`;

            card.addEventListener("click", () => verDetalleEquipo(eq.id));
            contenedor.appendChild(card);
        });
    }

    actualizarAlertasGlobales();
    lucide.createIcons();
}

function actualizarAlertasGlobales() {
    const cont = $("alerts-container");
    if (!cont) return;
    cont.innerHTML = "";

    if (appState.equipos.length === 0) {
        cont.innerHTML = `<div style="color: var(--text-secondary); font-size: 0.9rem; text-align: center; padding: 1rem 0;">Aún no hay equipos. Pulsa "+" para dar de alta el primero.</div>`;
        return;
    }

    const lista = [];
    appState.equipos.forEach(eq => {
        eq.datos.forEach(dato => {
            const ev = evaluarDato(eq, dato);
            if (ev && ev.nivel !== 'ok') lista.push({ eq, dato, ev });
        });
    });
    lista.sort((a, b) => RANGO[b.ev.nivel] - RANGO[a.ev.nivel] || a.ev.urgencia - b.ev.urgencia);

    const vencidos = lista.filter(x => x.ev.nivel === 'taller').length;
    const proximos = lista.filter(x => x.ev.nivel === 'revision').length;
    const alDia = appState.equipos.filter(eq => obtenerPeorEstadoEquipo(eq) === 'ok').length;

    const resumen = document.createElement("div");
    resumen.className = "summary-row";
    resumen.innerHTML = `
        <div class="summary-chip crit"><b>${vencidos}</b><span>Vencidos</span></div>
        <div class="summary-chip warn"><b>${proximos}</b><span>Próximos</span></div>
        <div class="summary-chip good"><b>${alDia}</b><span>Equipos al día</span></div>`;
    cont.appendChild(resumen);

    if (lista.length === 0) {
        const ok = document.createElement("div");
        ok.style.cssText = "color: var(--text-secondary); font-size: 0.9rem; text-align: center; padding: 0.8rem 0 0.4rem; width: 100%;";
        ok.textContent = "🎉 Todo al día. No hay alertas críticas ni próximas.";
        cont.appendChild(ok);
        return;
    }

    const MAX_VISIBLES = 5;
    lista.slice(0, MAX_VISIBLES).forEach(({ eq, dato, ev }) => {
        const critico = ev.nivel === 'taller';
        const item = document.createElement("div");
        item.className = `alert-item-3d ${critico ? 'critical' : 'warning'}`;
        const detalle = dato.tipo === 'km'
            ? `${capitalizar(ev.texto)} (a los ${formatearKm(dato.valor)} km)`
            : `${capitalizar(ev.texto)} (${formatearFechaAMostrar(dato.valor)})`;
        item.innerHTML = `
            <div class="alert-3d-avatar"><i data-lucide="${critico ? 'alert-triangle' : 'bell'}"></i></div>
            <div class="info">
                <h4>${esc(eq.nombre)}: ${esc(dato.nombre)}</h4>
                <p>${esc(detalle)}</p>
            </div>`;
        item.addEventListener("click", () => verDetalleEquipo(eq.id));
        cont.appendChild(item);
    });

    if (lista.length > MAX_VISIBLES) {
        const mas = document.createElement("div");
        mas.className = "more-alerts";
        mas.textContent = `+ ${lista.length - MAX_VISIBLES} más en las fichas`;
        cont.appendChild(mas);
    }
    lucide.createIcons();
}

// ==========================================================================
// 7. FICHA: todo editable directamente
// ==========================================================================
function verDetalleEquipo(id) {
    appState.equipoSeleccionadoId = id;
    renderFicha();
    navegarA("view-detail");
}

function renderFicha() {
    const equipo = equipoActual();
    if (!equipo) return;

    const esVehiculo = equipo.tipo === "vehiculo";
    const peor = obtenerPeorEstadoEquipo(equipo);

    $("detail-type-icon").innerHTML = `<i data-lucide="${esVehiculo ? 'car' : 'wrench'}"></i>`;
    $("detail-type-text").innerText = esVehiculo ? "VEHÍCULO" : "MAQUINARIA";
    $("detail-title").innerText = equipo.nombre;

    const badge = $("detail-status-badge");
    badge.className = `status-badge-3d ${peor}`;
    badge.innerText = etiquetaEstado(equipo, peor);

    // km actuales + llamar
    let quick = "";
    if (esVehiculo) {
        quick += `<label class="km-box"><input type="number" id="ficha-km" inputmode="numeric" min="0" placeholder="km" value="${equipo.km !== null ? equipo.km : ''}"><span>km</span></label>`;
    }
    const tel = (equipo.telefono || '').replace(/[^\d+]/g, '');
    if (tel) {
        quick += `<a class="btn-3d btn-3d-primary" href="tel:${esc(tel)}"><i data-lucide="phone"></i> Llamar al taller</a>`;
    }
    $("detail-quick").innerHTML = quick;

    renderSpecs(equipo);
    renderHistorial(equipo);

    // formulario del historial
    const histKm = $("hist-km");
    histKm.style.display = esVehiculo ? "" : "none";
    if (esVehiculo && document.activeElement !== histKm) histKm.value = equipo.km !== null ? equipo.km : "";
    const histFecha = $("hist-date");
    if (!histFecha.value) histFecha.value = hoyISO();

    // notas
    const notas = $("detail-notes");
    if (document.activeElement !== notas) notas.value = equipo.notas || "";

    lucide.createIcons();
}

function renderSpecs(equipo) {
    const cont = $("detail-specs-list");
    cont.innerHTML = "";

    if (equipo.datos.length === 0) {
        cont.innerHTML = `<p class="empty-note">Sin plazos ni controles todavía. Pulsa "Editar nombre, plazos y tipo" para añadirlos.</p>`;
        return;
    }

    equipo.datos.forEach((dato, i) => {
        const ev = evaluarDato(equipo, dato);
        const pasado = esCampoPasado(dato);
        const conAlerta = dato.alerta && !pasado && (dato.tipo === 'fecha' || dato.tipo === 'km');

        const tipoInput = dato.tipo === 'fecha' ? 'date' : dato.tipo === 'km' ? 'number' : 'text';
        const extra = dato.tipo === 'km' ? 'inputmode="numeric" min="0"' : '';

        let sub = "";
        if (conAlerta) {
            let estadoHtml;
            if (ev) estadoHtml = `<div class="spec-status ${ev.nivel}">${esc(capitalizar(ev.texto))}</div>`;
            else if (dato.tipo === 'km' && equipo.km === null && dato.valor !== '') estadoHtml = `<div class="spec-status vacio">Anota los km actuales arriba para activar el aviso</div>`;
            else estadoHtml = `<div class="spec-status vacio">${dato.tipo === 'fecha' ? 'Sin fecha: ponla o pulsa "Hecho hoy"' : 'Sin km: pon el siguiente o pulsa "Hecho hoy"'}</div>`;

            const actual = dato.intervalo || INTERVALO_DEFECTO[dato.tipo];
            const opciones = OPCIONES_INTERVALO[dato.tipo].slice();
            if (!opciones.includes(actual)) opciones.push(actual);
            opciones.sort((a, b) => a - b);
            const optionsHtml = opciones
                .map(o => `<option value="${o}" ${o === actual ? 'selected' : ''}>${etiquetaIntervalo(dato.tipo, o)}</option>`)
                .join("");

            sub = `
                ${estadoHtml}
                <div class="spec-sub">
                    <label class="spec-repeat">Repite cada
                        <select data-idx="${i}" data-field="intervalo">${optionsHtml}</select>
                    </label>
                    <button type="button" class="btn-done" data-action="hecho" data-idx="${i}"><i data-lucide="check"></i> Hecho hoy</button>
                </div>`;
        }

        const fila = document.createElement("div");
        fila.className = "spec-row";
        fila.innerHTML = `
            <div class="spec-top">
                <span class="spec-name">${esc(dato.nombre)}</span>
                <input class="spec-input" type="${tipoInput}" ${extra} data-idx="${i}" data-field="valor" value="${esc(dato.valor)}" placeholder="—">
            </div>
            ${sub}`;
        cont.appendChild(fila);
    });
}

function renderHistorial(equipo) {
    const lista = $("hist-list");
    if (equipo.historial.length === 0) {
        lista.className = "";
        lista.innerHTML = `<p class="hist-empty">Todavía no hay nada anotado. Cuando hagas algo, apúntalo aquí: es lo que te salva cuando hay una avería.</p>`;
        return;
    }
    lista.className = "hist-list";
    const ordenado = equipo.historial.slice().sort((a, b) => b.fecha.localeCompare(a.fecha));
    lista.innerHTML = ordenado.map(h => `
        <div class="hist-item">
            <div class="hist-meta">
                <span>${formatearFechaAMostrar(h.fecha)}${h.km !== null ? ` · ${formatearKm(h.km)} km` : ''}</span>
                <button type="button" class="btn-delete-field" data-action="hist-del" data-hid="${esc(h.id)}" title="Borrar anotación"><i data-lucide="x"></i></button>
            </div>
            <div class="hist-text" contenteditable="true" data-hid="${esc(h.id)}">${esc(h.texto)}</div>
        </div>`).join("");
}

// --- Acciones directas de la ficha ---------------------------------------
function guardarKm(valor) {
    const eq = equipoActual();
    if (!eq) return;
    eq.km = aNumeroOnull(valor);
    guardarEnLocalStorage();
    renderFicha();
    renderDashboard();
}

function hechoHoy(idx) {
    const eq = equipoActual();
    if (!eq) return;
    const dato = eq.datos[idx];
    if (!dato) return;

    const instantanea = JSON.stringify(eq);
    let mensaje;

    if (dato.tipo === 'fecha') {
        const meses = dato.intervalo || INTERVALO_DEFECTO.fecha;
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        dato.intervalo = meses;
        dato.valor = fechaAISO(sumarMeses(hoy, meses));
        sincronizarUltima(eq, dato);
        mensaje = `Hecho · próxima el ${formatearFechaAMostrar(dato.valor)}`;
    } else if (dato.tipo === 'km') {
        if (eq.km === null) {
            mostrarAlertaModal("Faltan los km", "Anota primero los kilómetros actuales del vehículo (arriba, en la ficha) y vuelve a pulsar.");
            return;
        }
        const km = dato.intervalo || INTERVALO_DEFECTO.km;
        dato.intervalo = km;
        dato.valor = String(eq.km + km);
        mensaje = `Hecho · próximo a los ${formatearKm(dato.valor)} km`;
    } else {
        return;
    }

    eq.historial.unshift({
        id: nuevoId('h_'),
        fecha: hoyISO(),
        texto: `Hecho: ${limpiarNombre(dato.nombre)}`,
        km: eq.tipo === 'vehiculo' ? eq.km : null
    });

    guardarEnLocalStorage();
    renderFicha();
    renderDashboard();
    mostrarToast(mensaje, "Deshacer", () => restaurarEquipo(instantanea));
}

// Si hay pareja "Última ..." / "Próxima ...", la de "Última" pasa a hoy
function sincronizarUltima(eq, dato) {
    if (!/pr[óo]xim/i.test(dato.nombre)) return;
    const ultima = eq.datos.find(d => d !== dato && d.tipo === 'fecha' && esCampoPasado(d));
    if (ultima) ultima.valor = hoyISO();
}

function restaurarEquipo(json) {
    try {
        const copia = normalizarEquipo(JSON.parse(json));
        const i = appState.equipos.findIndex(e => e.id === copia.id);
        if (i === -1) return;
        appState.equipos[i] = copia;
        guardarEnLocalStorage();
        if (appState.equipoSeleccionadoId === copia.id) renderFicha();
        renderDashboard();
        mostrarToast("Deshecho");
    } catch (e) {
        console.error("No se pudo deshacer", e);
    }
}

function anotarHistorial() {
    const eq = equipoActual();
    if (!eq) return;
    const campoTexto = $("hist-text");
    const texto = campoTexto.value.trim();
    if (!texto) {
        campoTexto.focus();
        return;
    }
    const fecha = $("hist-date").value || hoyISO();
    const km = eq.tipo === 'vehiculo' ? aNumeroOnull($("hist-km").value) : null;

    eq.historial.unshift({ id: nuevoId('h_'), fecha, texto, km });
    // Si el km anotado es mayor que el actual, el vehículo ya va por ahí
    if (km !== null && (eq.km === null || km > eq.km)) eq.km = km;

    campoTexto.value = "";
    $("hist-date").value = hoyISO();
    guardarEnLocalStorage();
    renderFicha();
    renderDashboard();
}

function configurarEventosFicha() {
    const specs = $("detail-specs-list");

    specs.addEventListener("change", (e) => {
        const t = e.target;
        const eq = equipoActual();
        if (!eq || t.dataset.idx === undefined) return;
        const dato = eq.datos[Number(t.dataset.idx)];
        if (!dato) return;

        if (t.dataset.field === "valor") dato.valor = t.value;
        else if (t.dataset.field === "intervalo") dato.intervalo = Number(t.value) || 0;
        else return;

        guardarEnLocalStorage();
        renderDashboard();

        // En escritorio, mientras se teclea una fecha no repintamos hasta salir del campo
        const tactil = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
        if (t.type === "date" && !tactil && document.activeElement === t) {
            fichaSucia = true;
        } else {
            fichaSucia = false;
            renderFicha();
        }
    });

    specs.addEventListener("focusout", () => {
        if (!fichaSucia) return;
        setTimeout(() => {
            if (fichaSucia && !specs.contains(document.activeElement)) {
                fichaSucia = false;
                renderFicha();
            }
        }, 60);
    });

    specs.addEventListener("click", (e) => {
        const btn = e.target.closest('[data-action="hecho"]');
        if (btn) hechoHoy(Number(btn.dataset.idx));
    });

    specs.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.target.matches("input")) e.target.blur();
    });

    const quick = $("detail-quick");
    quick.addEventListener("change", (e) => {
        if (e.target.id === "ficha-km") guardarKm(e.target.value);
    });
    quick.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && e.target.id === "ficha-km") e.target.blur();
    });

    $("btn-hist-add").onclick = anotarHistorial;
    $("hist-text").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            anotarHistorial();
        }
    });

    const lista = $("hist-list");
    lista.addEventListener("click", (e) => {
        const btn = e.target.closest('[data-action="hist-del"]');
        if (!btn) return;
        const hid = btn.dataset.hid;
        mostrarConfirmacionModal(
            "¿Borrar anotación?",
            "Se quitará esta línea del historial. No se puede deshacer.",
            () => {
                const eq = equipoActual();
                if (!eq) return;
                eq.historial = eq.historial.filter(h => h.id !== hid);
                guardarEnLocalStorage();
                renderFicha();
            }
        );
    });
    lista.addEventListener("focusout", (e) => {
        const el = e.target.closest(".hist-text");
        if (!el) return;
        const eq = equipoActual();
        const h = eq && eq.historial.find(x => x.id === el.dataset.hid);
        if (!h) return;
        const nuevo = el.innerText.trim();
        if (!nuevo) {
            el.innerText = h.texto;
            return;
        }
        if (nuevo !== h.texto) {
            h.texto = nuevo;
            guardarEnLocalStorage();
        }
    });

    $("detail-notes").addEventListener("change", (e) => {
        const eq = equipoActual();
        if (!eq) return;
        eq.notas = e.target.value.trim();
        guardarEnLocalStorage();
    });
}

// ==========================================================================
// 8. FORMULARIO (estructura de la ficha: nombre, tipo, campos, plantillas)
// ==========================================================================
function tipoInputDesdeNombre(nombre) {
    const t = nombre.toLowerCase().trim();
    if (t.includes('km')) return 'number';
    if (PALABRAS_FECHA.some(p => t.includes(p))) return 'date';
    return 'text';
}

function renderChipsPlantillas(activa) {
    const cont = $("template-chips");
    cont.innerHTML = "";
    Object.keys(PLANTILLAS).forEach(clave => {
        const p = PLANTILLAS[clave];
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "chip" + (clave === activa ? " active" : "");
        chip.innerHTML = `<i data-lucide="${p.icono}" style="width:14px;height:14px;"></i> ${p.etiqueta}`;
        chip.addEventListener("click", () => aplicarPlantilla(clave));
        cont.appendChild(chip);
    });
    lucide.createIcons();
}

function aplicarPlantilla(clave) {
    const p = PLANTILLAS[clave];
    if (!p) return;
    if (p.tipo) $("item-type").value = p.tipo;
    const cont = $("custom-fields-container");
    cont.innerHTML = "";
    p.campos.forEach(c => agregarCampoDinamico(c.nombre, c.valor || "", c.alerta, c.tipo, c.intervalo || 0));
    renderChipsPlantillas(clave);
}

function abrirEditorNuevo() {
    appState.equipoSeleccionadoId = null;

    $("modal-title").innerText = "Añadir Equipo";
    $("equipment-form").reset();
    $("btn-delete-detail").style.display = "none";
    $("item-id").value = "";
    $("item-notes").value = "";
    $("item-phone").value = "";

    $("template-wrap").style.display = "block";
    aplicarPlantilla("blanco");

    navegarA("view-form");
    lucide.createIcons();
}

function abrirEditorExistente() {
    const equipo = equipoActual();
    if (!equipo) return;

    $("modal-title").innerText = "Editar Equipo";
    $("item-id").value = equipo.id;
    $("item-name").value = equipo.nombre;
    $("item-type").value = equipo.tipo;
    $("item-status").value = equipo.estado;
    $("item-notes").value = equipo.notas || "";
    $("item-phone").value = equipo.telefono || "";
    $("btn-delete-detail").style.display = "block";
    $("template-wrap").style.display = "none";

    const cont = $("custom-fields-container");
    cont.innerHTML = "";
    equipo.datos.forEach(d => agregarCampoDinamico(d.nombre, d.valor, d.alerta, d.tipo, d.intervalo));

    navegarA("view-form");
    lucide.createIcons();
}

function agregarCampoDinamico(nombre = "", valor = "", alerta = false, tipo = "texto", intervalo = 0) {
    const contenedor = $("custom-fields-container");
    if (!contenedor) return;

    const rowId = nuevoId('row_');
    const tipoInput = tipo === 'fecha' ? 'date' : tipo === 'km' ? 'number' : 'text';
    const row = document.createElement("div");
    row.className = "custom-field-row";
    row.id = rowId;
    row.dataset.intervalo = String(intervalo || 0);

    row.innerHTML = `
        <input type="text" placeholder="Concepto (ej: Cambio aceite)" value="${esc(nombre)}" class="field-name" required>
        <input type="${tipoInput}" ${tipoInput === 'number' ? 'inputmode="numeric" min="0"' : ''} placeholder="Valor" value="${esc(valor)}" class="field-value">

        <div class="switch-container">
            <span>Alerta</span>
            <label class="switch">
                <input type="checkbox" class="field-alert" ${alerta ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
        </div>

        <button type="button" class="btn-delete-field" onclick="eliminarFilaDinamica('${rowId}')">
            <i data-lucide="trash-2"></i>
        </button>`;

    contenedor.appendChild(row);

    const inputNombre = row.querySelector('.field-name');
    const inputValor = row.querySelector('.field-value');

    // Campos nuevos en blanco: el tipo se adivina según lo que se escribe en el nombre.
    // Los que ya vienen con nombre (plantilla / edición) mantienen su tipo.
    if (!nombre) {
        inputNombre.addEventListener('input', () => {
            const nuevo = tipoInputDesdeNombre(inputNombre.value);
            if (inputValor.type !== nuevo) {
                inputValor.type = nuevo;
                inputValor.inputMode = nuevo === 'number' ? 'numeric' : '';
            }
        });
    }

    // "Última Revisión" -> calcula la "Próxima" a +12 meses
    inputValor.addEventListener('change', () => {
        const txt = inputNombre.value.toLowerCase().trim();
        const esUltima = txt.includes('última') || txt.includes('ultima');
        if (esUltima && inputValor.value && inputValor.type === 'date') {
            const base = parsearFechaISO(inputValor.value);
            if (base) actualizarOCrearProximaFecha(fechaAISO(sumarMeses(base, 12)));
        }
    });

    lucide.createIcons();
}

function actualizarOCrearProximaFecha(nuevaFecha) {
    let filaProxima = null;
    document.querySelectorAll('.custom-field-row').forEach(row => {
        const n = row.querySelector('.field-name');
        if (n) {
            const txt = n.value.toLowerCase().trim();
            if (txt.includes('próxima') || txt.includes('proxima')) filaProxima = row;
        }
    });

    if (filaProxima) {
        const inputValor = filaProxima.querySelector('.field-value');
        const inputCheck = filaProxima.querySelector('.field-alert');
        if (inputValor) {
            inputValor.type = 'date';
            inputValor.value = nuevaFecha;
        }
        if (inputCheck) inputCheck.checked = true;
    } else {
        agregarCampoDinamico("Próxima Revisión", nuevaFecha, true, "fecha", 12);
    }
}

window.eliminarFilaDinamica = function (id) {
    const fila = $(id);
    if (fila) fila.remove();
};

function procesarEnvioFormulario(e) {
    e.preventDefault();

    const id = $("item-id").value;
    const nombre = $("item-name").value.trim();
    const tipo = $("item-type").value;
    const estado = $("item-status").value;
    const notas = $("item-notes").value.trim();
    const telefono = $("item-phone").value.trim();

    if (!nombre) {
        mostrarAlertaModal("Falta Información", "El nombre es obligatorio.");
        return;
    }

    const datosProcesados = [];
    document.querySelectorAll('.custom-field-row').forEach(fila => {
        const inputNombre = fila.querySelector('.field-name');
        const inputValor = fila.querySelector('.field-value');
        const inputCheck = fila.querySelector('.field-alert');
        if (!inputNombre || !inputValor) return;

        const nom = inputNombre.value.trim();
        if (!nom) return;
        datosProcesados.push({
            nombre: nom,
            valor: inputValor.value,
            alerta: inputCheck ? inputCheck.checked : false,
            intervalo: Number(fila.dataset.intervalo) || 0,
            tipo: inputValor.type === 'date' ? 'fecha' : inputValor.type === 'number' ? 'km' : 'texto'
        });
    });

    let idFinal = id;
    if (id) {
        const eq = appState.equipos.find(x => x.id === id);
        if (eq) {
            eq.nombre = nombre;
            eq.tipo = tipo;
            eq.estado = estado;
            eq.notas = notas;
            eq.telefono = telefono;
            eq.datos = datosProcesados;
        }
    } else {
        const nuevo = {
            id: nuevoId('eq_'),
            nombre, tipo, estado, notas, telefono,
            km: null,
            historial: [],
            datos: datosProcesados
        };
        appState.equipos.push(nuevo);
        idFinal = nuevo.id;
    }

    guardarEnLocalStorage();
    renderDashboard();
    verDetalleEquipo(idFinal);
    mostrarToast("Guardado");
}

function eliminarEquipoSeleccionado() {
    mostrarConfirmacionModal(
        "¿Eliminar Equipo?",
        "Se borrará esta ficha de manera permanente junto a sus plazos e historial. No se puede deshacer.",
        () => {
            appState.equipos = appState.equipos.filter(e => e.id !== appState.equipoSeleccionadoId);
            appState.equipoSeleccionadoId = null;
            guardarEnLocalStorage();
            renderDashboard();
            navegarA("view-dashboard");
            mostrarToast("Equipo eliminado");
        }
    );
}

// ==========================================================================
// 9. MODALES Y TOAST
// ==========================================================================
function mostrarAlertaModal(titulo, mensaje) {
    const modal = $("modal-alert");
    const elTitulo = $("sys-alert-title");
    const elMensaje = $("sys-alert-text");
    if (modal && elTitulo && elMensaje) {
        elTitulo.innerText = titulo;
        elMensaje.innerText = mensaje;
        modal.classList.add("active");
    }
}

window.cerrarAlertaModal = function () {
    const modal = $("modal-alert");
    if (modal) modal.classList.remove("active");
};

function mostrarConfirmacionModal(titulo, mensaje, callbackConfirmar) {
    const modal = $("modal-confirm");
    const elMensaje = $("sys-confirm-text");
    if (!modal || !elMensaje) return;

    elMensaje.innerText = mensaje;
    modal.classList.add("active");

    $("btn-ok-confirm").onclick = () => {
        modal.classList.remove("active");
        callbackConfirmar();
    };
    $("btn-cancel-confirm").onclick = () => {
        modal.classList.remove("active");
    };
}

function mostrarToast(texto, textoAccion, accion) {
    let toast = $("toast");
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toast";
        toast.className = "toast";
        document.body.appendChild(toast);
    }
    toast.innerHTML = `<span>${esc(texto)}</span>`;
    if (accion) {
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = textoAccion;
        b.onclick = () => {
            toast.style.display = "none";
            accion();
        };
        toast.appendChild(b);
    }
    toast.style.display = "flex";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.style.display = "none"; }, accion ? 8000 : 2500);
}

// ==========================================================================
// 10. BACKUP Y RESTAURACIÓN
// ==========================================================================
function exportarBackup() {
    try {
        const backup = {
            app: "Mantresi Premium",
            version: 2,
            fecha: new Date().toISOString(),
            equipos: appState.equipos
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `mantresi_backup_${hoyISO()}.json`;
        document.body.appendChild(enlace);
        enlace.click();
        document.body.removeChild(enlace);

        URL.revokeObjectURL(url);
        mostrarAlertaModal("Copia Guardada", "El archivo de backup se ha descargado con éxito.");
    } catch (error) {
        console.error("Error al exportar backup:", error);
        mostrarAlertaModal("Error", "No se ha podido generar la copia de seguridad.");
    }
}

function solicitarArchivoRestauracion() {
    const input = $("input-restore-file");
    if (input) {
        input.value = "";
        input.click();
    }
}

function procesarArchivoRestauracion(e) {
    const archivo = e.target.files && e.target.files[0];
    if (!archivo) return;

    const lector = new FileReader();

    lector.onload = (evento) => {
        try {
            const contenido = JSON.parse(evento.target.result);
            const listaEquipos = Array.isArray(contenido) ? contenido : contenido.equipos;
            if (!Array.isArray(listaEquipos)) throw new Error("Formato no reconocido");

            const equiposValidados = listaEquipos.map(normalizarEquipo);

            mostrarConfirmacionModal(
                "¿Restaurar Copia?",
                `Se sustituirán los ${appState.equipos.length} elementos actuales por los ${equiposValidados.length} del archivo. Esta acción no se puede deshacer.`,
                () => {
                    appState.equipos = equiposValidados;
                    appState.equipoSeleccionadoId = null;
                    guardarEnLocalStorage();
                    renderDashboard();
                    mostrarAlertaModal("Restaurado", "La copia de seguridad se ha cargado con éxito.");
                }
            );
        } catch (error) {
            console.error("Error al leer el archivo de backup:", error);
            mostrarAlertaModal("Archivo No Válido", "El archivo seleccionado no es una copia de seguridad válida.");
        }
    };

    lector.onerror = () => {
        mostrarAlertaModal("Error", "No se ha podido leer el archivo seleccionado.");
    };

    lector.readAsText(archivo);
}

// ==========================================================================
// 11. ENLACE DE EVENTOS GLOBALES
// ==========================================================================
function configurarEventosGlobales() {
    $("btn-add-item").onclick = abrirEditorNuevo;
    $("btn-backup").onclick = exportarBackup;
    $("btn-restore").onclick = solicitarArchivoRestauracion;
    $("input-restore-file").addEventListener("change", procesarArchivoRestauracion);

    $("btn-back-to-dashboard-from-detail").onclick = () => {
        renderDashboard();
        navegarA("view-dashboard");
    };

    // Desde el formulario se vuelve a la ficha si se estaba editando, o al inicio si era nuevo
    $("btn-back-to-dashboard-from-form").onclick = () => {
        if ($("item-id").value && equipoActual()) {
            renderFicha();
            navegarA("view-detail");
        } else {
            navegarA("view-dashboard");
        }
    };

    $("btn-edit-detail").onclick = abrirEditorExistente;
    $("btn-delete-detail").onclick = eliminarEquipoSeleccionado;
    $("btn-add-field").onclick = () => agregarCampoDinamico("", "", false, "texto");
    $("equipment-form").onsubmit = procesarEnvioFormulario;
    $("btn-close-sys-alert").onclick = cerrarAlertaModal;

    const botonesFiltro = document.querySelectorAll(".filter-btn");
    botonesFiltro.forEach(btn => {
        btn.addEventListener("click", (e) => {
            botonesFiltro.forEach(b => b.classList.remove("active"));
            e.currentTarget.classList.add("active");
            appState.filtroActivo = e.currentTarget.getAttribute("data-filter");
            renderDashboard();
        });
    });
}
