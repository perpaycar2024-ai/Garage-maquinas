/* ==========================================================================
   SISTEMA DE GESTIÓN - LÓGICA COMPLETA Y LIMPIA (app.js)
   ========================================================================== */

// 1. ESTADO GLOBAL DE LA APLICACIÓN (Limpio por defecto)
let appState = {
    vehiculos: [], // Sin coches de prueba para evitar conflictos
    vehiculoSeleccionadoId: null,
    vistaAnteriorId: "view-dashboard"
};

// Cargar y migrar datos de LocalStorage de forma ultra segura
try {
    const datosGuardados = localStorage.getItem('mycar_data');
    if (datosGuardados) {
        const parseados = JSON.parse(datosGuardados);
        if (Array.isArray(parseados)) {
            // Migración automática: asegura que tus datos antiguos no rompan la app
            appState.vehiculos = parseados.map(v => {
                return {
                    id: v.id || 'v_' + Math.random().toString(36).substr(2, 9),
                    nombre: v.nombre || 'Sin nombre',
                    tipo: v.tipo || 'Vehículo',
                    icono: v.icono || '🚗',
                    estado: v.estado || 'ok',
                    notas: v.notas || v.notes || '', // Soporta notas antiguas si existían
                    datos: Array.isArray(v.datos) ? v.datos : [] // Asegura que 'datos' sea siempre un array
                };
            });
        }
    }
} catch (e) {
    console.warn("No se pudo cargar LocalStorage. Iniciando vacío.", e);
}

// Guardar en LocalStorage
function guardarEnLocalStorage() {
    try {
        localStorage.setItem('mycar_data', JSON.stringify(appState.vehiculos));
    } catch (e) {
        console.error("Error al guardar en LocalStorage", e);
    }
}

// 2. INICIALIZACIÓN AL CARGAR EL DOCUMENTO
document.addEventListener("DOMContentLoaded", () => {
    try {
        renderDashboard();
        configurarEventosGlobales();
    } catch (error) {
        console.error("Error durante la inicialización:", error);
    }
    
    const btnAdd = document.getElementById("btn-add-vehicle");
    if (btnAdd) {
        btnAdd.onclick = () => abrirEditorNuevo();
    }
});

// ==========================================================================
// SISTEMA DE NAVEGACIÓN SEGURO
// ==========================================================================
function navegarA(idVistaDestino) {
    const vistas = document.querySelectorAll('.app-view');
    const vistaDestino = document.getElementById(idVistaDestino);
    
    if (!vistaDestino) return;

    const activaActual = document.querySelector('.app-view.active');
    if (activaActual && activaActual.id !== idVistaDestino) {
        appState.vistaAnteriorId = activaActual.id;
    }

    vistas.forEach(vista => {
        vista.classList.remove('active');
    });
    vistaDestino.classList.add('active');
}

function volverAtras() {
    navegarA(appState.vistaAnteriorId || "view-dashboard");
}

// ==========================================================================
// LÓGICA DE COMPROBACIÓN DE ALERTAS
// ==========================================================================
function recalcularEstadoVehiculo(vehiculo) {
    if (!vehiculo) return;
    if (!Array.isArray(vehiculo.datos)) {
        vehiculo.datos = [];
    }
    
    const hoy = new Date();
    let peorEstado = "ok";

    vehiculo.datos.forEach(dato => {
        if (dato && dato.alerta && dato.valor) {
            const fechaLimite = new Date(dato.valor);
            if (isNaN(fechaLimite.getTime())) return;

            if (hoy > fechaLimite) {
                peorEstado = "taller"; 
            } else {
                const msDiferencia = fechaLimite - hoy;
                const diasRestantes = Math.ceil(msDiferencia / (1000 * 60 * 60 * 24));
                if (diasRestantes <= 30 && peorEstado !== "taller") {
                    peorEstado = "revision"; 
                }
            }
        }
    });

    vehiculo.estado = peorEstado;
}

// ==========================================================================
// RENDERIZADO DEL DASHBOARD
// ==========================================================================
function renderDashboard() {
    const contenedor = document.getElementById("dashboard-cards-grid");
    if (!contenedor) return;

    contenedor.innerHTML = "";

    if (appState.vehiculos.length === 0) {
        contenedor.innerHTML = `
            <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <p style="font-size: 1.2rem; margin-bottom: 1rem; font-weight: bold;">No tienes elementos añadidos</p>
                <p style="font-size: 0.85rem;">Pulsa el botón de abajo para empezar.</p>
            </div>
        `;
        return;
    }

    appState.vehiculos.forEach(vehiculo => {
        recalcularEstadoVehiculo(vehiculo);

        let badgeTexto = "Operativo";
        if (vehiculo.estado === "revision") badgeTexto = "Revisión pronto";
        if (vehiculo.estado === "taller") badgeTexto = "Alerta vencida";

        const card = document.createElement("div");
        card.className = `premium-item-card ${vehiculo.estado}`;
        card.innerHTML = `
            <div class="card-title-block">
                <div class="avatar-wrapper-3d">
                    <span style="font-size: 1.4rem;">${vehiculo.icono || '🚗'}</span>
                </div>
                <div>
                    <h3>${vehiculo.nombre || 'Sin nombre'}</h3>
                    <span class="subtitle">${vehiculo.tipo || 'Vehículo'}</span>
                </div>
            </div>
            <div>
                <span class="status-badge-3d ${vehiculo.estado}">${badgeTexto}</span>
            </div>
        `;

        card.addEventListener("click", () => {
            verDetalleVehiculo(vehiculo.id);
        });

        contenedor.appendChild(card);
    });

    actualizarAlertasGlobales();
}

function actualizarAlertasGlobales() {
    const contenedorAlertas = document.getElementById("alerts-list");
    if (!contenedorAlertas) return;

    contenedorAlertas.innerHTML = "";
    let alertasActivas = 0;

    appState.vehiculos.forEach(vehiculo => {
        if (!vehiculo || !Array.isArray(vehiculo.datos)) return;
        
        vehiculo.datos.forEach(dato => {
            if (dato && dato.alerta && dato.valor) {
                const fechaLimite = new Date(dato.valor);
                const hoy = new Date();

                if (hoy > fechaLimite) {
                    alertasActivas++;
                    const alertaItem = document.createElement("div");
                    alertaItem.className = "alert-item-3d critical";
                    alertaItem.innerHTML = `
                        <div class="alert-3d-avatar">🚨</div>
                        <div class="info">
                            <h4>${vehiculo.nombre}: ${dato.nombre}</h4>
                            <p>Venció el ${formatearFechaAMostrar(dato.valor)}</p>
                        </div>
                    `;
                    alertaItem.addEventListener("click", () => verDetalleVehiculo(vehiculo.id));
                    contenedorAlertas.appendChild(alertaItem);
                }
            }
        });
    });

    const tituloAlertas = document.getElementById("alerts-section-title");
    if (tituloAlertas) {
        tituloAlertas.style.display = alertasActivas > 0 ? "flex" : "none";
    }
}

// ==========================================================================
// PANTALLA DETALLE
// ==========================================================================
function verDetalleVehiculo(id) {
    const vehiculo = appState.vehiculos.find(v => v.id === id);
    if (!vehiculo) return;

    appState.vehiculoSeleccionadoId = id;

    const elIcon = document.getElementById("detail-icon");
    const elType = document.getElementById("detail-type");
    const elTitle = document.getElementById("detail-title");
    const elBadge = document.getElementById("detail-status-badge");

    if (elIcon) elIcon.innerText = vehiculo.icono || "🚗";
    if (elType) elType.innerText = (vehiculo.tipo || "VEHÍCULO").toUpperCase();
    if (elTitle) elTitle.innerText = vehiculo.nombre || "Sin nombre";

    if (elBadge) {
        elBadge.className = `status-badge-3d ${vehiculo.estado}`;
        if (vehiculo.estado === "ok") elBadge.innerText = "OPERATIVO";
        if (vehiculo.estado === "revision") elBadge.innerText = "ATENCIÓN";
        if (vehiculo.estado === "taller") elBadge.innerText = "VENCIDO";
    }

    const listaSpecs = document.getElementById("detail-specs-list");
    if (listaSpecs) {
        listaSpecs.innerHTML = "";
        if (Array.isArray(vehiculo.datos)) {
            vehiculo.datos.forEach(dato => {
                const item = document.createElement("div");
                item.className = "spec-item-3d";
                
                let alertaIcono = "";
                if (dato.alerta) {
                    const fechaLimite = new Date(dato.valor);
                    const hoy = new Date();
                    alertaIcono = hoy > fechaLimite ? " 🚨" : " 🔔";
                }

                item.innerHTML = `
                    <span class="label">${dato.nombre}${alertaIcono}</span>
                    <span class="value">${formatearFechaAMostrar(dato.valor)}</span>
                `;
                listaSpecs.appendChild(item);
            });
        }
    }

    const contenedorNotas = document.getElementById("detail-notes-container");
    if (contenedorNotas) {
        const textoNotas = vehiculo.notas || "";
        if (textoNotas.trim() !== "") {
            contenedorNotas.innerHTML = `
                <div class="detail-specs-box" style="margin-top: 1rem;">
                    <div class="specs-box-title">📝 Notas e Incidencias</div>
                    <p style="font-size: 0.9rem; line-height: 1.5; color: var(--text-primary); white-space: pre-line; margin: 0;">${textoNotas}</p>
                </div>
            `;
        } else {
            contenedorNotas.innerHTML = "";
        }
    }

    navegarA("view-detail");
}

// ==========================================================================
// FORMULARIO DE EDICIÓN Y CREACIÓN
// ==========================================================================
function abrirEditorNuevo() {
    appState.vehiculoSeleccionadoId = null;
    
    const elEditTitle = document.getElementById("edit-view-title");
    const elNombre = document.getElementById("input-nombre");
    const elTipo = document.getElementById("select-tipo");
    const txtNotas = document.getElementById("textarea-notas");

    if (elEditTitle) elEditTitle.innerText = "Añadir Ficha";
    if (elNombre) elNombre.value = "";
    if (elTipo) elTipo.value = "Vehículo";
    if (txtNotas) txtNotas.value = "";
    
    const contenedorCampos = document.getElementById("custom-fields-container");
    if (contenedorCampos) {
        contenedorCampos.innerHTML = "";
        agregarCampoDinamico("Última Revisión", "", false);
        agregarCampoDinamico("Próxima ITV / Alerta", "", true);
    }

    navegarA("view-edit");
}

function abrirEditorExistente() {
    const vehiculo = appState.vehiculos.find(v => v.id === appState.vehiculoSeleccionadoId);
    if (!vehiculo) return;

    const elEditTitle = document.getElementById("edit-view-title");
    const elNombre = document.getElementById("input-nombre");
    const elTipo = document.getElementById("select-tipo");
    const txtNotas = document.getElementById("textarea-notas");

    if (elEditTitle) elEditTitle.innerText = "Editar Ficha";
    if (elNombre) elNombre.value = vehiculo.nombre || "";
    if (elTipo) elTipo.value = vehiculo.tipo || "Vehículo";
    if (txtNotas) txtNotas.value = vehiculo.notas || "";

    const contenedorCampos = document.getElementById("custom-fields-container");
    if (contenedorCampos) {
        contenedorCampos.innerHTML = "";
        if (Array.isArray(vehiculo.datos)) {
            vehiculo.datos.forEach(dato => {
                agregarCampoDinamico(dato.nombre, dato.valor, dato.alerta);
            });
        }
    }

    navegarA("view-edit");
}

function agregarCampoDinamico(nombre = "", valor = "", alerta = false) {
    const contenedor = document.getElementById("custom-fields-container");
    if (!contenedor) return;

    const rowId = 'row_' + Math.random().toString(36).substr(2, 9);
    const row = document.createElement("div");
    row.className = "custom-field-row";
    row.id = rowId;

    row.innerHTML = `
        <input type="text" placeholder="Concepto (ej: Seguro)" value="${nombre}" class="field-name">
        <input type="date" value="${valor}" class="field-value">
        
        <div class="switch-container">
            <span>Alerta</span>
            <label class="switch">
                <input type="checkbox" class="field-alert" ${alerta ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
        </div>
        
        <button type="button" class="btn-delete-field" onclick="eliminarFilaDinamica('${rowId}')">
            🗑️
        </button>
    `;

    contenedor.appendChild(row);

    const inputNombre = row.querySelector('.field-name');
    const inputFecha = row.querySelector('.field-value');

    if (inputFecha && inputNombre) {
        inputFecha.addEventListener('change', () => {
            const nombreNormalizado = inputNombre.value.toLowerCase().trim();
            const esUltimaRevision = nombreNormalizado.includes('última') || nombreNormalizado.includes('ultima');

            if (esUltimaRevision && inputFecha.value) {
                const fechaBase = new Date(inputFecha.value);
                fechaBase.setFullYear(fechaBase.getFullYear() + 1);

                const aaaa = fechaBase.getFullYear();
                const mm = String(fechaBase.getMonth() + 1).padStart(2, '0');
                const dd = String(fechaBase.getDate()).padStart(2, '0');
                const fechaCalculada = `${aaaa}-${mm}-${dd}`;

                actualizarOCrearProximaFecha(fechaCalculada);
            }
        });
    }
}

function actualizarOCrearProximaFecha(nuevaFecha) {
    const filas = document.querySelectorAll('.custom-field-row');
    let campoProximoEncontrado = null;

    filas.forEach(row => {
        const inputNombre = row.querySelector('.field-name');
        if (inputNombre) {
            const txt = inputNombre.value.toLowerCase().trim();
            if (txt.includes('próxima') || txt.includes('proxima')) {
                campoProximoEncontrado = row;
            }
        }
    });

    if (campoProximoEncontrado) {
        const inputFecha = campoProximoEncontrado.querySelector('.field-value');
        const inputCheck = campoProximoEncontrado.querySelector('.field-alert');
        if (inputFecha) inputFecha.value = nuevaFecha;
        if (inputCheck) inputCheck.checked = true; 
    } else {
        agregarCampoDinamico("Próxima ITV / Alerta", nuevaFecha, true);
    }
}

// EXPOSICIÓN GLOBAL INDESTRUCTIBLE
window.eliminarFilaDinamica = function(id) {
    const fila = document.getElementById(id);
    if (fila) fila.remove();
};

// ==========================================================================
// GUARDAR LOS CAMBIOS DEL FORMULARIO
// ==========================================================================
function guardarFormulario() {
    const elNombre = document.getElementById("input-nombre");
    const elTipo = document.getElementById("select-tipo");
    const elNotas = document.getElementById("textarea-notas");

    const nombre = elNombre ? elNombre.value.trim() : "";
    const tipo = elTipo ? elTipo.value : "Vehículo";
    const notasVal = elNotas ? elNotas.value.trim() : "";

    if (!nombre) {
        mostrarAlertaModal("Falta Información", "Por favor, escribe un nombre o identificador para continuar.", "danger");
        return;
    }

    const filas = document.querySelectorAll('.custom-field-row');
    const datosProcesados = [];

    filas.forEach(fila => {
        const inputNombre = fila.querySelector('.field-name');
        const inputFecha = fila.querySelector('.field-value');
        const inputCheck = fila.querySelector('.field-alert');

        const concepto = inputNombre ? inputNombre.value.trim() : "";
        const fechaVal = inputFecha ? inputFecha.value : "";
        const alertaVal = inputCheck ? inputCheck.checked : false;

        if (concepto) {
            datosProcesados.push({
                id: 'd_' + Math.random().toString(36).substr(2, 9),
                nombre: concepto,
                valor: fechaVal,
                alerta: alertaVal
            });
        }
    });

    const emojiIcono = tipo === "Vehículo" ? "🚗" : tipo === "Herramienta" ? "🔧" : "📦";

    if (appState.vehiculoSeleccionadoId) {
        const index = appState.vehiculos.findIndex(v => v.id === appState.vehiculoSeleccionadoId);
        if (index !== -1) {
            appState.vehiculos[index].nombre = nombre;
            appState.vehiculos[index].tipo = tipo;
            appState.vehiculos[index].icono = emojiIcono;
            appState.vehiculos[index].notas = notasVal; 
            appState.vehiculos[index].datos = datosProcesados;
            recalcularEstadoVehiculo(appState.vehiculos[index]);
        }
    } else {
        const nuevoVehiculo = {
            id: 'v_' + Math.random().toString(36).substr(2, 9),
            nombre: nombre,
            tipo: tipo,
            icono: emojiIcono,
            estado: "ok",
            notas: notasVal, 
            datos: datosProcesados
        };
        recalcularEstadoVehiculo(nuevoVehiculo);
        appState.vehiculos.push(nuevoVehiculo);
    }

    guardarEnLocalStorage();
    renderDashboard();

    if (appState.vehiculoSeleccionadoId) {
        verDetalleVehiculo(appState.vehiculoSeleccionadoId);
    } else {
        navegarA("view-dashboard");
    }

    mostrarAlertaModal("Guardado", "La ficha técnica se ha actualizado correctamente.", "success");
}

function eliminarVehiculoSeleccionado() {
    mostrarConfirmacionModal(
        "¿Eliminar Ficha?", 
        "Esta acción no se puede deshacer. Se borrarán todos los históricos y alertas de este elemento.", 
        () => {
            appState.vehiculos = appState.vehiculos.filter(v => v.id !== appState.vehiculoSeleccionadoId);
            guardarEnLocalStorage();
            renderDashboard();
            navegarA("view-dashboard");
            mostrarAlertaModal("Eliminado", "La ficha ha sido borrada permanentemente.", "danger");
        }
    );
}

// ==========================================================================
// MODALES PREMIUM DE SISTEMA CON BLUR
// ==========================================================================
function mostrarAlertaModal(titulo, mensaje, tipo = "info") {
    const overlay = document.getElementById("alert-modal-overlay");
    const contenedor = document.getElementById("alert-modal-container");
    
    if (!overlay || !contenedor) return;

    const icono = tipo === "danger" ? "🚨" : tipo === "success" ? "✅" : "ℹ️";
    const claseIcono = tipo === "danger" ? "danger-icon" : "";

    contenedor.innerHTML = `
        <div class="alert-3d-icon ${claseIcono}">${icono}</div>
        <h3>${titulo}</h3>
        <p>${mensaje}</p>
        <button class="btn-alert-close" onclick="cerrarAlertaModal()">Entendido</button>
    `;

    overlay.classList.add("active");
}

window.cerrarAlertaModal = function() {
    const overlay = document.getElementById("alert-modal-overlay");
    if (overlay) overlay.classList.remove("active");
};

function mostrarConfirmacionModal(titulo, mensaje, callbackConfirmar) {
    const overlay = document.getElementById("alert-modal-overlay");
    const contenedor = document.getElementById("alert-modal-container");
    
    if (!overlay || !contenedor) return;

    contenedor.innerHTML = `
        <div class="alert-3d-icon danger-icon">🗑️</div>
        <h3>${titulo}</h3>
        <p>${mensaje}</p>
        <div class="alert-confirm-grid">
            <button class="btn-confirm-cancel" onclick="cerrarAlertaModal()">Cancelar</button>
            <button class="btn-confirm-danger" id="btn-modal-confirm-action">Eliminar</button>
        </div>
    `;

    overlay.classList.add("active");

    const btnConfirmar = document.getElementById("btn-modal-confirm-action");
    if (btnConfirmar) {
        btnConfirmar.onclick = () => {
            cerrarAlertaModal();
            callbackConfirmar();
        };
    }
}

// ==========================================================================
// MANEJADORES DE EVENTOS GLOBALES Y UTILIDADES
// ==========================================================================
function configurarEventosGlobales() {
    document.querySelectorAll(".btn-back, .btn-cancelar").forEach(btn => {
        btn.onclick = volverAtras;
    });

    const btnAddOtro = document.getElementById("btn-add-other");
    if (btnAddOtro) {
        btnAddOtro.onclick = () => agregarCampoDinamico("", "", false);
    }

    const btnGuardar = document.getElementById("btn-save-form");
    if (btnGuardar) {
        btnGuardar.onclick = guardarFormulario;
    }

    const btnEditar = document.getElementById("btn-edit-vehicle");
    if (btnEditar) {
        btnEditar.onclick = abrirEditorExistente;
    }

    const btnEliminar = document.getElementById("btn-delete-vehicle");
    if (btnEliminar) {
        btnEliminar.onclick = eliminarVehiculoSeleccionado;
    }
}

function formatearFechaAMostrar(fechaStr) {
    if (!fechaStr) return "Sin fecha";
    const partes = fechaStr.split("-");
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return fechaStr;
}
