/* ==========================================================================
   SISTEMA DE GESTIÓN - LOGICA COMPLETA DE LA APLICACIÓN (app.js)
   ========================================================================== */

// 1. ESTADO GLOBAL DE LA APLICACIÓN
let appState = {
    vehiculos: [
        {
            id: "1",
            nombre: "Coche rojo",
            tipo: "Vehículo",
            icono: "🚗",
            estado: "ok", // 'ok', 'revision', 'taller'
            notas: "ITV pasada sin defectos en julio. Próximo cambio de neumáticos delanteros recomendado para invierno.",
            datos: [
                { id: "d1", nombre: "Última Revisión", valor: "2026-07-15", alerta: false },
                { id: "d2", nombre: "Próxima ITV / Alerta", valor: "2027-07-15", alerta: true }
            ]
        }
    ],
    vehiculoSeleccionadoId: null,
    vistaAnteriorId: "view-dashboard"
};

// Cargar datos de LocalStorage al iniciar (si existen)
const datosGuardados = localStorage.getItem('mycar_data');
if (datosGuardados) {
    try {
        appState.vehiculos = JSON.parse(datosGuardados);
    } catch (e) {
        console.error("Error al cargar LocalStorage, usando datos por defecto.", e);
    }
}

// 2. INICIALIZACIÓN AL CARGAR EL DOCUMENTO
document.addEventListener("DOMContentLoaded", () => {
    renderDashboard();
    configurarEventosGlobales();
    
    // El botón de añadir nuevo vehículo desde el Dashboard
    const btnAdd = document.getElementById("btn-add-vehicle");
    if (btnAdd) {
        btnAdd.addEventListener("click", () => {
            abrirEditorNuevo();
        });
    }
});

// Guardar en LocalStorage de forma segura
function guardarEnLocalStorage() {
    localStorage.setItem('mycar_data', JSON.stringify(appState.vehiculos));
}

// ==========================================================================
// SISTEMA DE NAVEGACIÓN PREMIUM (CON SOPORTE DVH Y DESLIZAMIENTO)
// ==========================================================================
function navegarA(idVistaDestino) {
    const vistas = document.querySelectorAll('.app-view');
    const vistaDestino = document.getElementById(idVistaDestino);
    
    if (!vistaDestino) return;

    // Guardar el historial para el botón "Atrás"
    const activaActual = document.querySelector('.app-view.active');
    if (activaActual && activaActual.id !== idVistaDestino) {
        appState.vistaAnteriorId = activaActual.id;
    }

    // Quitar la clase activa de las demás y ponérsela a la de destino
    vistas.forEach(vista => {
        if (vista.id === idVistaDestino) {
            vista.classList.add('active');
        } else {
            vista.classList.remove('active');
        }
    });
}

// Regresar a la vista previa
function volverAtras() {
    navegarA(appState.vistaAnteriorId || "view-dashboard");
}

// ==========================================================================
// LÓGICA DE COMPROBACIÓN DE ALERTAS (INTELIGENTE)
// ==========================================================================
function recalcularEstadoVehiculo(vehiculo) {
    const hoy = new Date();
    let peorEstado = "ok";

    vehiculo.datos.forEach(dato => {
        if (dato.alerta && dato.valor) {
            const fechaLimite = new Date(dato.valor);
            if (isNaN(fechaLimite.getTime())) return;

            if (hoy > fechaLimite) {
                peorEstado = "taller"; // Crítico: Se ha pasado de la fecha
            } else {
                const msDiferencia = fechaLimite - hoy;
                const diasRestantes = Math.ceil(msDiferencia / (1000 * 60 * 60 * 24));
                if (diasRestantes <= 30 && peorEstado !== "taller") {
                    peorEstado = "revision"; // Preventivo: Próximo a vencer
                }
            }
        }
    });

    vehiculo.estado = peorEstado;
}

// ==========================================================================
// RENDERIZADO DEL DASHBOARD (PANTALLA PRINCIPAL)
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
                    <h3>${vehiculo.nombre}</h3>
                    <span class="subtitle">${vehiculo.tipo}</span>
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

// Actualiza el widget superior de alertas en el Dashboard
function actualizarAlertasGlobales() {
    const contenedorAlertas = document.getElementById("alerts-list");
    if (!contenedorAlertas) return;

    contenedorAlertas.innerHTML = "";
    let alertasActivas = 0;

    appState.vehiculos.forEach(vehiculo => {
        vehiculo.datos.forEach(dato => {
            if (dato.alerta && dato.valor) {
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
// PANTALLA DETALLE (#view-detail)
// ==========================================================================
function verDetalleVehiculo(id) {
    const vehiculo = appState.vehiculos.find(v => v.id === id);
    if (!vehiculo) return;

    appState.vehiculoSeleccionadoId = id;

    document.getElementById("detail-icon").innerText = vehiculo.icono || "🚗";
    document.getElementById("detail-type").innerText = vehiculo.tipo.toUpperCase();
    document.getElementById("detail-title").innerText = vehiculo.nombre;

    // Badge de estado general
    const badge = document.getElementById("detail-status-badge");
    badge.className = `status-badge-3d ${vehiculo.estado}`;
    if (vehiculo.estado === "ok") badge.innerText = "OPERATIVO";
    if (vehiculo.estado === "revision") badge.innerText = "ATENCIÓN";
    if (vehiculo.estado === "taller") badge.innerText = "VENCIDO";

    // Pintar los datos dinámicos en la ficha técnica
    const listaSpecs = document.getElementById("detail-specs-list");
    listaSpecs.innerHTML = "";

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

    // Pintar notas e incidencias
    const contenedorNotas = document.getElementById("detail-notes-container");
    if (contenedorNotas) {
        if (vehiculo.notes || vehiculo.notas) { // Soportar ambos nombres de variable por si acaso
            const notasTexto = vehiculo.notas || vehiculo.notes;
            contenedorNotas.innerHTML = `
                <div class="detail-specs-box" style="margin-top: 1rem;">
                    <div class="specs-box-title">📝 Notas e Incidencias</div>
                    <p style="font-size: 0.9rem; line-height: 1.5; color: var(--text-primary); white-space: pre-line; margin: 0;">${notasTexto}</p>
                </div>
            `;
        } else {
            contenedorNotas.innerHTML = "";
        }
    }

    navegarA("view-detail");
}

// ==========================================================================
// FORMULARIO DE EDICIÓN Y CREACIÓN (#view-edit)
// ==========================================================================
function abrirEditorNuevo() {
    appState.vehiculoSeleccionadoId = null;
    
    document.getElementById("edit-view-title").innerText = "Añadir Ficha";
    document.getElementById("input-nombre").value = "";
    document.getElementById("select-tipo").value = "Vehículo";
    
    const txtNotas = document.getElementById("textarea-notas");
    if (txtNotas) txtNotas.value = "";
    
    const contenedorCampos = document.getElementById("custom-fields-container");
    contenedorCampos.innerHTML = "";

    // Añadir campos por defecto
    agregarCampoDinamico("Última Revisión", "", false);
    agregarCampoDinamico("Próxima ITV / Alerta", "", true);

    navegarA("view-edit");
}

function abrirEditorExistente() {
    const vehiculo = appState.vehiculos.find(v => v.id === appState.vehiculoSeleccionadoId);
    if (!vehiculo) return;

    document.getElementById("edit-view-title").innerText = "Editar Ficha";
    document.getElementById("input-nombre").value = vehiculo.nombre;
    document.getElementById("select-tipo").value = vehiculo.tipo;

    const txtNotas = document.getElementById("textarea-notas");
    if (txtNotas) txtNotas.value = vehiculo.notas || vehiculo.notes || "";

    const contenedorCampos = document.getElementById("custom-fields-container");
    contenedorCampos.innerHTML = "";

    vehiculo.datos.forEach(dato => {
        agregarCampoDinamico(dato.nombre, dato.valor, dato.alerta);
    });

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

    // LÓGICA INTELIGENTE DE CÁLCULO DE FECHAS AUTOMÁTICAS
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

// EXPOSICIÓN GLOBAL DE LA FUNCIÓN DE ELIMINAR FILA (Evita roturas de JavaScript)
window.eliminarFilaDinamica = function(id) {
    const fila = document.getElementById(id);
    if (fila) fila.remove();
};

// ==========================================================================
// GUARDAR LOS CAMBIOS DEL FORMULARIO
// ==========================================================================
function guardarFormulario() {
    const nombre = document.getElementById("input-nombre").value.trim();
    const tipo = document.getElementById("select-tipo").value;
    const txtNotas = document.getElementById("textarea-notas");
    const notasVal = txtNotas ? txtNotas.value.trim() : "";

    if (!nombre) {
        mostrarAlertaModal("Falta Información", "Por favor, escribe un nombre o identificador para continuar.", "danger");
        return;
    }

    const filas = document.querySelectorAll('.custom-field-row');
    const datosProcesados = [];

    filas.forEach(fila => {
        const concepto = fila.querySelector('.field-name').value.trim();
        const fechaVal = fila.querySelector('.field-value').value;
        const alertaVal = fila.querySelector('.field-alert').checked;

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
        // Modo Edición
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
        // Modo Creación
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

// EXPOSICIÓN GLOBAL PARA QUE EL CLICK DEL HTML PUEDA CERRARLO
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
        btnConfirmar.addEventListener("click", () => {
            cerrarAlertaModal();
            callbackConfirmar();
        });
    }
}

// ==========================================================================
// MANEJADORES DE EVENTOS GLOBALES Y UTILIDADES
// ==========================================================================
function configurarEventosGlobales() {
    document.querySelectorAll(".btn-back, .btn-cancelar").forEach(btn => {
        btn.addEventListener("click", volverAtras);
    });

    const btnAddOtro = document.getElementById("btn-add-other");
    if (btnAddOtro) {
        btnAddOtro.addEventListener("click", () => {
            agregarCampoDinamico("", "", false);
        });
    }

    const btnGuardar = document.getElementById("btn-save-form");
    if (btnGuardar) {
        btnGuardar.addEventListener("click", guardarFormulario);
    }

    const btnEditar = document.getElementById("btn-edit-vehicle");
    if (btnEditar) {
        btnEditar.addEventListener("click", abrirEditorExistente);
    }

    const btnEliminar = document.getElementById("btn-delete-vehicle");
    if (btnEliminar) {
        btnEliminar.addEventListener("click", eliminarVehiculoSeleccionado);
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
