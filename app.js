/* ==========================================================================
   MANTRESI PREMIUM - LÓGICA DE NEGOCIO INTEGRADA (app.js)
   ========================================================================== */

// 1. ESTADO GLOBAL DE LA APLICACIÓN (Totalmente compatible con tus datos en LocalStorage)
let appState = {
    equipos: [],
    equipoSeleccionadoId: null,
    vistaAnteriorId: "view-dashboard",
    filtroActivo: "all"
};

// Cargar y migrar datos antiguos del LocalStorage de forma segura
try {
    const datosGuardados = localStorage.getItem('mycar_data'); // Mantenemos tu clave para no perder tus datos
    if (datosGuardados) {
        const parseados = JSON.parse(datosGuardados);
        if (Array.isArray(parseados)) {
            appState.equipos = parseados.map(e => {
                // Mapear campos antiguos si los hubiera a la estructura de tu HTML
                return {
                    id: e.id || 'eq_' + Math.random().toString(36).substr(2, 9),
                    nombre: e.nombre || e.name || 'Sin nombre',
                    tipo: e.tipo || e.type || 'vehiculo', // 'vehiculo' o 'maquina'
                    estado: e.estado || e.status || 'ok', // 'ok', 'revision', 'taller'
                    datos: Array.isArray(e.datos) ? e.datos : []
                };
            });
        }
    }
} catch (error) {
    console.warn("No se pudo cargar o procesar LocalStorage. Iniciando vacío.", error);
}

// Guardar en LocalStorage de forma segura
function guardarEnLocalStorage() {
    try {
        localStorage.setItem('mycar_data', JSON.stringify(appState.equipos));
    } catch (e) {
        console.error("Error al guardar en LocalStorage", e);
    }
}

// 2. INICIALIZACIÓN AL CARGAR EL DOCUMENTO
document.addEventListener("DOMContentLoaded", () => {
    try {
        renderDashboard();
        configurarEventosGlobales();
        lucide.createIcons();
    } catch (error) {
        console.error("Error crítico en la inicialización:", error);
    }
});

// ==========================================================================
// SISTEMA DE NAVEGACIÓN SEGURO (Manejando tus IDs de vista)
// ==========================================================================
function navegarA(idVistaDestino) {
    const vistas = document.querySelectorAll('.app-view');
    const vistaDestino = document.getElementById(idVistaDestino);
    
    if (!vistaDestino) return;

    const activaActual = document.querySelector('.app-view.active');
    if (activaActual && activaActual.id !== idVistaDestino) {
        appState.vistaAnteriorId = activaActual.id;
    }

    vistas.forEach(vista => vista.classList.remove('active'));
    vistaDestino.classList.add('active');
}

function volverAtras() {
    navegarA(appState.vistaAnteriorId || "view-dashboard");
}

// ==========================================================================
// RENDERIZADO DEL DASHBOARD (INVENTARIO Y ALERTAS)
// ==========================================================================
function renderDashboard() {
    const contenedorInventario = document.getElementById("inventory-grid");
    if (!contenedorInventario) return;

    contenedorInventario.innerHTML = "";

    // Filtrar equipos según el botón activo
    const equiposFiltrados = appState.equipos.filter(equipo => {
        if (appState.filtroActivo === "all") return true;
        return equipo.tipo === appState.filtroActivo;
    });

    if (equiposFiltrados.length === 0) {
        contenedorInventario.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <p style="font-size: 1.1rem; margin-bottom: 0.5rem; font-weight: bold;">No hay elementos para mostrar</p>
                <p style="font-size: 0.85rem; opacity: 0.7;">Pulsa el botón "Nuevo" de arriba para empezar.</p>
            </div>
        `;
    } else {
        equiposFiltrados.forEach(equipo => {
            const card = document.createElement("div");
            card.className = `premium-item-card ${equipo.estado}`;
            
            // Icono dinámico Lucide
            const iconoLucide = equipo.tipo === "vehiculo" ? "car" : "wrench";
            
            let badgeTexto = "Operativo";
            if (equipo.estado === "revision") badgeTexto = "Revisión pronto";
            if (equipo.estado === "taller") badgeTexto = "Alerta vencida";

            card.innerHTML = `
                <div class="card-title-block">
                    <div class="avatar-wrapper-3d">
                        <i data-lucide="${iconoLucide}"></i>
                    </div>
                    <div>
                        <h3>${equipo.nombre}</h3>
                        <span class="subtitle">${equipo.tipo === "vehiculo" ? "Vehículo" : "Maquinaria / Herramienta"}</span>
                    </div>
                </div>
                <div>
                    <span class="status-badge-3d ${equipo.estado}">${badgeTexto}</span>
                </div>
            `;

            card.addEventListener("click", () => verDetalleEquipo(equipo.id));
            contenedorInventario.appendChild(card);
        });
    }

    actualizarAlertasGlobales();
    lucide.createIcons(); // Vuelve a cargar los iconos generados dinámicamente
}

function actualizarAlertasGlobales() {
    const contenedorAlertas = document.getElementById("alerts-container");
    if (!contenedorAlertas) return;

    contenedorAlertas.innerHTML = "";
    let alertasActivas = 0;

    appState.equipos.forEach(equipo => {
        if (!equipo || !Array.isArray(equipo.datos)) return;

        equipo.datos.forEach(dato => {
            if (dato && dato.alerta && dato.valor) {
                const fechaLimite = new Date(dato.valor);
                const hoy = new Date();

                if (hoy > fechaLimite) {
                    alertasActivas++;
                    const alertaItem = document.createElement("div");
                    alertaItem.className = "alert-item-3d critical";
                    alertaItem.innerHTML = `
                        <div class="alert-3d-avatar"><i data-lucide="alert-triangle"></i></div>
                        <div class="info">
                            <h4>${equipo.nombre}: ${dato.nombre}</h4>
                            <p>Venció el ${formatearFechaAMostrar(dato.valor)}</p>
                        </div>
                    `;
                    alertaItem.addEventListener("click", () => verDetalleEquipo(equipo.id));
                    contenedorAlertas.appendChild(alertaItem);
                }
            }
        });
    });

    // Si no hay alertas de hoy, mostramos un aviso limpio
    if (alertasActivas === 0) {
        contenedorAlertas.innerHTML = `
            <div style="color: var(--text-secondary); font-size: 0.9rem; text-align: center; padding: 1.5rem 0; width: 100%;">
                🎉 Todo al día. No hay alertas críticas pendientes.
            </div>
        `;
    }
    lucide.createIcons();
}

// ==========================================================================
// PANTALLA DETALLE (#view-detail)
// ==========================================================================
function verDetalleEquipo(id) {
    const equipo = appState.equipos.find(e => e.id === id);
    if (!equipo) return;

    appState.equipoSeleccionadoId = id;

    // Actualizar datos del héroe de detalle
    const elIcono = document.getElementById("detail-type-icon");
    const elTextoTipo = document.getElementById("detail-type-text");
    const elTitulo = document.getElementById("detail-title");
    const elBadge = document.getElementById("detail-status-badge");

    if (elIcono) {
        const icono = equipo.tipo === "vehiculo" ? "car" : "wrench";
        elIcono.innerHTML = `<i data-lucide="${icono}"></i>`;
    }
    if (elTextoTipo) elTextoTipo.innerText = (equipo.tipo === "vehiculo" ? "VEHÍCULO" : "MAQUINARIA").toUpperCase();
    if (elTitulo) elTitulo.innerText = equipo.nombre;

    if (elBadge) {
        elBadge.className = `status-badge-3d ${equipo.estado}`;
        if (equipo.estado === "ok") elBadge.innerText = "Operativo";
        if (equipo.estado === "revision") elBadge.innerText = "Revisión pronto";
        if (equipo.estado === "taller") elBadge.innerText = "Alerta vencida";
    }

    // Dibujar la ficha técnica con las fechas clave
    const listaSpecs = document.getElementById("detail-specs-list");
    if (listaSpecs) {
        listaSpecs.innerHTML = "";
        if (Array.isArray(equipo.datos) && equipo.datos.length > 0) {
            equipo.datos.forEach(dato => {
                const item = document.createElement("div");
                item.className = "spec-item-3d";

                let alertaIcono = "";
                if (dato.alerta) {
                    const fechaLimite = new Date(dato.valor);
                    const hoy = new Date();
                    alertaIcono = hoy > fechaLimite ? ' <i data-lucide="alert-circle" style="color: var(--status-critical); display: inline-block; width: 14px; height: 14px; vertical-align: middle;"></i>' : ' <i data-lucide="bell" style="color: var(--status-warning); display: inline-block; width: 14px; height: 14px; vertical-align: middle;"></i>';
                }

                item.innerHTML = `
                    <span class="label">${dato.nombre}${alertaIcono}</span>
                    <span class="value">${formatearFechaAMostrar(dato.valor)}</span>
                `;
                listaSpecs.appendChild(item);
            });
        } else {
            listaSpecs.innerHTML = `<p style="color: var(--text-secondary); font-size: 0.9rem; text-align: center; padding: 1rem 0;">No se han configurado fechas de control.</p>`;
        }
    }

    lucide.createIcons();
    navegarA("view-detail");
}

// ==========================================================================
// FORMULARIO DE EDICIÓN / REGISTRO (#view-form)
// ==========================================================================
function abrirEditorNuevo() {
    appState.equipoSeleccionadoId = null;

    const elTitle = document.getElementById("modal-title");
    const form = document.getElementById("equipment-form");
    
    if (elTitle) elTitle.innerText = "Añadir Equipo";
    if (form) form.reset();

    const elHiddenId = document.getElementById("item-id");
    if (elHiddenId) elHiddenId.value = "";

    const contenedorCampos = document.getElementById("custom-fields-container");
    if (contenedorCampos) {
        contenedorCampos.innerHTML = "";
        // Campos de control por defecto de forma interactiva
        agregarCampoDinamico("Última Revisión", "", false);
        agregarCampoDinamico("Próxima ITV / Alerta", "", true);
    }

    navegarA("view-form");
    lucide.createIcons();
}

function abrirEditorExistente() {
    const equipo = appState.equipos.find(e => e.id === appState.equipoSeleccionadoId);
    if (!equipo) return;

    const elTitle = document.getElementById("modal-title");
    const elHiddenId = document.getElementById("item-id");
    const elNombre = document.getElementById("item-name");
    const elTipo = document.getElementById("item-type");
    const elEstado = document.getElementById("item-status");

    if (elTitle) elTitle.innerText = "Editar Equipo";
    if (elHiddenId) elHiddenId.value = equipo.id;
    if (elNombre) elNombre.value = equipo.nombre;
    if (elTipo) elTipo.value = equipo.tipo;
    if (elEstado) elEstado.value = equipo.estado;

    const contenedorCampos = document.getElementById("custom-fields-container");
    if (contenedorCampos) {
        contenedorCampos.innerHTML = "";
        if (Array.isArray(equipo.datos)) {
            equipo.datos.forEach(dato => {
                agregarCampoDinamico(dato.nombre, dato.valor, dato.alerta);
            });
        }
    }

    navegarA("view-form");
    lucide.createIcons();
}

function agregarCampoDinamico(nombre = "", valor = "", alerta = false) {
    const contenedor = document.getElementById("custom-fields-container");
    if (!contenedor) return;

    const rowId = 'row_' + Math.random().toString(36).substr(2, 9);
    const row = document.createElement("div");
    row.className = "custom-field-row";
    row.id = rowId;

    row.innerHTML = `
        <input type="text" placeholder="Concepto (ej: Seguro)" value="${nombre}" class="field-name" required>
        <input type="date" value="${valor}" class="field-value" required>
        
        <div class="switch-container">
            <span>Alerta</span>
            <label class="switch">
                <input type="checkbox" class="field-alert" ${alerta ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
        </div>
        
        <button type="button" class="btn-delete-field" onclick="eliminarFilaDinamica('${rowId}')">
            <i data-lucide="trash-2"></i>
        </button>
    `;

    contenedor.appendChild(row);

    // Automatización de fechas inteligente (Si cambias la última revisión, calcula la próxima a un año)
    const inputNombre = row.querySelector('.field-name');
    const inputFecha = row.querySelector('.field-value');

    if (inputFecha && inputNombre) {
        inputFecha.addEventListener('change', () => {
            const txt = inputNombre.value.toLowerCase().trim();
            const esUltimaRevision = txt.includes('última') || txt.includes('ultima');

            if (esUltimaRevision && inputFecha.value) {
                const fechaBase = new Date(inputFecha.value);
                fechaBase.setFullYear(fechaBase.getFullYear() + 1); // +1 Año

                const aaaa = fechaBase.getFullYear();
                const mm = String(fechaBase.getMonth() + 1).padStart(2, '0');
                const dd = String(fechaBase.getDate()).padStart(2, '0');
                const fechaCalculada = `${aaaa}-${mm}-${dd}`;

                actualizarOCrearProximaFecha(fechaCalculada);
            }
        });
    }

    lucide.createIcons();
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

// Ventana de borrado de fila dinámica
window.eliminarFilaDinamica = function(id) {
    const fila = document.getElementById(id);
    if (fila) fila.remove();
};

// Guardar cambios mediante el Submit nativo del Form
function procesarEnvioFormulario(e) {
    e.preventDefault();

    const elId = document.getElementById("item-id");
    const elNombre = document.getElementById("item-name");
    const elTipo = document.getElementById("item-type");
    const elEstado = document.getElementById("item-status");

    const id = elId ? elId.value : "";
    const nombre = elNombre ? elNombre.value.trim() : "";
    const tipo = elTipo ? elTipo.value : "vehiculo";
    const estado = elEstado ? elEstado.value : "ok";

    if (!nombre) {
        mostrarAlertaModal("Falta Información", "El nombre es obligatorio.");
        return;
    }

    const filas = document.querySelectorAll('.custom-field-row');
    const datosProcesados = [];

    filas.forEach(fila => {
        const inputNombre = fila.querySelector('.field-name');
        const inputFecha = fila.querySelector('.field-value');
        const inputCheck = fila.querySelector('.field-alert');

        if (inputNombre && inputFecha) {
            datosProcesados.push({
                nombre: inputNombre.value.trim(),
                valor: inputFecha.value,
                alerta: inputCheck ? inputCheck.checked : false
            });
        }
    });

    if (id) {
        // Edición de un equipo existente
        const index = appState.equipos.findIndex(e => e.id === id);
        if (index !== -1) {
            appState.equipos[index].nombre = nombre;
            appState.equipos[index].tipo = tipo;
            appState.equipos[index].estado = estado;
            appState.equipos[index].datos = datosProcesados;
        }
    } else {
        // Nuevo registro
        const nuevoEquipo = {
            id: 'eq_' + Math.random().toString(36).substr(2, 9),
            nombre: nombre,
            tipo: tipo,
            estado: estado,
            datos: datosProcesados
        };
        appState.equipos.push(nuevoEquipo);
        appState.equipoSeleccionadoId = nuevoEquipo.id;
    }

    guardarEnLocalStorage();
    renderDashboard();

    if (appState.equipoSeleccionadoId) {
        verDetalleEquipo(appState.equipoSeleccionadoId);
    } else {
        navegarA("view-dashboard");
    }

    mostrarAlertaModal("Guardado", "El equipo ha sido actualizado con éxito.", "success");
}

function eliminarEquipoSeleccionado() {
    mostrarConfirmacionModal(
        "¿Eliminar Equipo?",
        "Se borrará esta ficha de manera permanente junto a sus fechas de control. No se puede deshacer.",
        () => {
            appState.equipos = appState.equipos.filter(e => e.id !== appState.equipoSeleccionadoId);
            guardarEnLocalStorage();
            renderDashboard();
            navegarA("view-dashboard");
            mostrarAlertaModal("Borrado", "El elemento ha sido eliminado.", "info");
        }
    );
}

// ==========================================================================
// MODALES PREMIUM INTEGRADOS EN TU HTML
// ==========================================================================
function mostrarAlertaModal(titulo, mensaje) {
    const modal = document.getElementById("modal-alert");
    const elTitulo = document.getElementById("sys-alert-title");
    const elMensaje = document.getElementById("sys-alert-text");

    if (modal && elTitulo && elMensaje) {
        elTitulo.innerText = titulo;
        elMensaje.innerText = mensaje;
        modal.classList.add("active");
    }
}

window.cerrarAlertaModal = function() {
    const modal = document.getElementById("modal-alert");
    if (modal) modal.classList.remove("active");
};

function mostrarConfirmacionModal(titulo, mensaje, callbackConfirmar) {
    const modal = document.getElementById("modal-confirm");
    const elMensaje = document.getElementById("sys-confirm-text");

    if (modal && elMensaje) {
        elMensaje.innerText = mensaje;
        modal.classList.add("active");

        const btnOk = document.getElementById("btn-ok-confirm");
        const btnCancel = document.getElementById("btn-cancel-confirm");

        if (btnOk) {
            btnOk.onclick = () => {
                modal.classList.remove("active");
                callbackConfirmar();
            };
        }

        if (btnCancel) {
            btnCancel.onclick = () => {
                modal.classList.remove("active");
            };
        }
    }
}

// ==========================================================================
// EVENTOS Y ENLACES FINALES
// ==========================================================================
function configurarEventosGlobales() {
    // Botón "Nuevo" del Dashboard
    const btnNuevo = document.getElementById("btn-add-item");
    if (btnNuevo) btnNuevo.onclick = abrirEditorNuevo;

    // Botones "Atrás" y "Cancelar"
    const btnBackDetail = document.getElementById("btn-back-to-dashboard-from-detail");
    if (btnBackDetail) btnBackDetail.onclick = volverAtras;

    const btnBackForm = document.getElementById("btn-back-to-dashboard-from-form");
    if (btnBackForm) btnBackForm.onclick = volverAtras;

    // Botones de acción del Detalle (Editar y Eliminar)
    const btnEditar = document.getElementById("btn-edit-detail");
    if (btnEditar) btnEditar.onclick = abrirEditorExistente;

    const btnEliminar = document.getElementById("btn-delete-detail");
    if (btnEliminar) btnEliminar.onclick = eliminarEquipoSeleccionado;

    // Botón dinámico dentro del formulario para añadir filas extras
    const btnAddOtro = document.getElementById("btn-add-field");
    if (btnAddOtro) {
        btnAddOtro.onclick = () => agregarCampoDinamico("", "", false);
    }

    // Submit del Formulario
    const formulario = document.getElementById("equipment-form");
    if (formulario) {
        formulario.onsubmit = procesarEnvioFormulario;
    }

    // Cerrar el modal de alertas
    const btnCloseAlert = document.getElementById("btn-close-sys-alert");
    if (btnCloseAlert) {
        btnCloseAlert.onclick = cerrarAlertaModal;
    }

    // Filtros del Dashboard (Todos, Vehículos, Maquinaria)
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

function formatearFechaAMostrar(fechaStr) {
    if (!fechaStr) return "Sin fecha";
    const partes = fechaStr.split("-");
    if (partes.length === 3) {
        return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    return fechaStr;
}
