// ==========================================================================
// CONFIGURACIÓN Y ESTADO DE LA APLICACIÓN
// ==========================================================================
let inventory = [];

// Elementos del DOM
const btnAddItem = document.getElementById('btn-add-item');
const modalForm = document.getElementById('modal-form');
const closeFormBtn = document.getElementById('close-form-btn');
const btnCancelForm = document.getElementById('btn-cancel-form');
const equipmentForm = document.getElementById('equipment-form');
const customFieldsContainer = document.getElementById('custom-fields-container');
const btnAddField = document.getElementById('btn-add-field');
const inventoryGrid = document.getElementById('inventory-grid');
const alertsContainer = document.getElementById('alerts-container');
const filterBtns = document.querySelectorAll('.filter-btn');

// Elementos de Modales de Sistema (Sustitutos de alert/confirm)
const modalAlert = document.getElementById('modal-alert');
const sysAlertTitle = document.getElementById('sys-alert-title');
const sysAlertText = document.getElementById('sys-alert-text');
const btnCloseSysAlert = document.getElementById('btn-close-sys-alert');

const modalConfirm = document.getElementById('modal-confirm');
const sysConfirmText = document.getElementById('sys-confirm-text');
const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
const btnOkConfirm = document.getElementById('btn-ok-confirm');

let confirmCallback = null; // Guardará la acción a realizar si el usuario confirma

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadInventory();
    setupEventListeners();
    render();
});

function setupEventListeners() {
    // Abrir/Cerrar Formulario
    btnAddItem.addEventListener('click', () => openFormModal());
    closeFormBtn.addEventListener('click', closeFormModal);
    btnCancelForm.addEventListener('click', closeFormModal);
    
    // Añadir campo personalizado
    btnAddField.addEventListener('click', () => addCustomFieldRow());

    // Guardar formulario
    equipmentForm.addEventListener('submit', handleFormSubmit);

    // Filtros de inventario
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderInventory(e.target.dataset.filter);
        });
    });

    // Cerrar Modales de Alerta/Confirmación
    btnCloseSysAlert.addEventListener('click', () => modalAlert.classList.remove('active'));
    btnCancelConfirm.addEventListener('click', () => {
        modalConfirm.classList.remove('active');
        confirmCallback = null;
    });
    btnOkConfirm.addEventListener('click', () => {
        if (confirmCallback) confirmCallback();
        modalConfirm.classList.remove('active');
        confirmCallback = null;
    });
}

// ==========================================================================
// CONTROL DE MODALES BONITOS (REEMPLAZO DE ALERT/CONFIRM)
// ==========================================================================
function showSystemAlert(title, text, type = 'info') {
    sysAlertTitle.textContent = title;
    sysAlertText.textContent = text;
    
    const iconContainer = document.querySelector('.alert-icon-container');
    if (type === 'warning') {
        iconContainer.className = 'alert-icon-container warning';
        iconContainer.innerHTML = '<i data-lucide="alert-triangle"></i>';
    } else {
        iconContainer.className = 'alert-icon-container';
        iconContainer.innerHTML = '<i data-lucide="info"></i>';
    }
    
    modalAlert.classList.add('active');
    lucide.createIcons();
}

function showSystemConfirm(text, callback) {
    sysConfirmText.textContent = text;
    confirmCallback = callback;
    modalConfirm.classList.add('active');
}

// ==========================================================================
// LÓGICA DE CAMPOS PERSONALIZADOS DINÁMICOS
// ==========================================================================
function addCustomFieldRow(name = '', value = '', type = 'text', hasAlert = false) {
    const rowId = 'field_' + Math.random().toString(36).substr(2, 9);
    
    const rowHTML = `
        <div class="custom-field-row" id="${rowId}">
            <input type="text" class="field-name" placeholder="Ej. ITV o Aceite" value="${name}" required>
            <input type="${type}" class="field-value" placeholder="Valor o fecha" value="${value}" required>
            <div class="switch-container">
                <span>Alerta</span>
                <label class="switch">
                    <input type="checkbox" class="field-alert" ${hasAlert ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
            <button type="button" class="btn-delete-field" onclick="document.getElementById('${rowId}').remove()">
                <i data-lucide="trash-2"></i>
            </button>
        </div>
    `;
    
    customFieldsContainer.insertAdjacentHTML('beforeend', rowHTML);
    
    // Escuchar el cambio en el input de valor para transformarlo en fecha si activan la alerta
    const row = document.getElementById(rowId);
    const valueInput = row.querySelector('.field-value');
    const alertCheckbox = row.querySelector('.field-alert');
    
    alertCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            valueInput.type = 'date';
        } else {
            valueInput.type = 'text';
        }
    });

    // Si se cargó con alerta activa, aseguramos que el tipo sea fecha
    if (hasAlert) {
        valueInput.type = 'date';
    }

    lucide.createIcons();
}

// ==========================================================================
// GESTIÓN DEL INVENTARIO (GUARDADO Y CARGA)
// ==========================================================================
function loadInventory() {
    const data = localStorage.getItem('resi_inventory');
    inventory = data ? JSON.parse(data) : getMockData();
}

function saveInventory() {
    localStorage.setItem('resi_inventory', JSON.stringify(inventory));
}

// Datos de demostración iniciales (Para no ver la app vacía al principio)
function getMockData() {
    return [
        {
            id: '1',
            name: 'Furgoneta Partner',
            type: 'vehiculo',
            status: 'ok',
            customFields: [
                { name: 'Próxima ITV', value: '2026-08-15', type: 'date', hasAlert: true },
                { name: 'Revisión Filtros', value: '2026-10-01', type: 'date', hasAlert: true },
                { name: 'Presión Neumáticos', value: '2.4 bar', type: 'text', hasAlert: false }
            ]
        },
        {
            id: '2',
            name: 'Cortasetos Stihl HS 45',
            type: 'maquina',
            status: 'revision',
            customFields: [
                { name: 'Afilado Cuchilla', value: '2026-06-30', type: 'date', hasAlert: true },
                { name: 'Mezcla Gasolina', value: '1:50 (2%)', type: 'text', hasAlert: false }
            ]
        }
    ];
}

// ==========================================================================
// FORMULARIO: ABRIR, GUARDAR, EDITAR
// ==========================================================================
function openFormModal(itemId = null) {
    equipmentForm.reset();
    customFieldsContainer.innerHTML = '';
    
    if (itemId) {
        // Modo Edición
        const item = inventory.find(i => i.id === itemId);
        document.getElementById('modal-title').textContent = 'Editar Equipo';
        document.getElementById('item-id').value = item.id;
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-type').value = item.type;
        document.getElementById('item-status').value = item.status;
        
        // Cargar sus campos personalizados
        item.customFields.forEach(field => {
            addCustomFieldRow(field.name, field.value, field.type, field.hasAlert);
        });
    } else {
        // Modo Nuevo
        document.getElementById('modal-title').textContent = 'Registrar Nuevo Equipo';
        document.getElementById('item-id').value = '';
        
        // Campos por defecto recomendados para ayudar al usuario
        addCustomFieldRow('Última Revisión', '', 'text', false);
        addCustomFieldRow('Próxima ITV / Alerta', '', 'text', false);
    }
    
    modalForm.classList.add('active');
}

function closeFormModal() {
    modalForm.classList.remove('active');
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('item-id').value;
    const name = document.getElementById('item-name').value;
    const type = document.getElementById('item-type').value;
    const status = document.getElementById('item-status').value;
    
    // Recopilar campos personalizados
    const customFields = [];
    const rows = customFieldsContainer.querySelectorAll('.custom-field-row');
    
    rows.forEach(row => {
        const fieldName = row.querySelector('.field-name').value;
        const fieldValue = row.querySelector('.field-value').value;
        const hasAlert = row.querySelector('.field-alert').checked;
        const fieldType = hasAlert ? 'date' : 'text';
        
        if (fieldName.trim() !== '') {
            customFields.push({
                name: fieldName,
                value: fieldValue,
                type: fieldType,
                hasAlert: hasAlert
            });
        }
    });

    if (id) {
        // Actualizar existente
        const index = inventory.findIndex(i => i.id === id);
        inventory[index] = { id, name, type, status, customFields };
        showSystemAlert('Actualizado', `${name} se ha guardado correctamente.`);
    } else {
        // Crear nuevo
        const newItem = {
            id: 'item_' + Date.now(),
            name,
            type,
            status,
            customFields
        };
        inventory.push(newItem);
        showSystemAlert('Creado', `${name} se ha añadido al inventario.`);
    }
    
    saveInventory();
    closeFormModal();
    render();
}

function deleteItem(id) {
    const item = inventory.find(i => i.id === id);
    showSystemConfirm(`¿Seguro que quieres eliminar "${item.name}" de la lista?`, () => {
        inventory = inventory.filter(i => i.id !== id);
        saveInventory();
        render();
        showSystemAlert('Eliminado', 'El equipo se ha quitado del inventario.', 'warning');
    });
}

// ==========================================================================
// RENDERIZADO VISUAL (DIBUJAR EN PANTALLA)
// ==========================================================================
function render() {
    const activeFilter = document.querySelector('.filter-btn.active').dataset.filter;
    renderInventory(activeFilter);
    renderAlerts();
}

function renderInventory(filter = 'all') {
    inventoryGrid.innerHTML = '';
    
    const filtered = inventory.filter(item => {
        if (filter === 'all') return true;
        return item.type === filter;
    });

    if (filtered.length === 0) {
        inventoryGrid.innerHTML = `
            <div class="no-alerts" style="grid-column: 1/-1;">
                <i data-lucide="package-open" style="width: 48px; height: 48px; color: #a0aec0;"></i>
                <p>No se encontraron equipos en esta categoría.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    filtered.forEach(item => {
        // Formatear el estado para la clase CSS y texto legible
        let statusClass = item.status;
        let statusText = 'Operativo';
        if (item.status === 'revision') statusText = 'Revisión';
        if (item.status === 'taller') statusText = 'En Taller';

        const typeIcon = item.type === 'vehiculo' ? 'car' : 'wrench';
        
        // Generar lista de campos personalizados para la tarjeta
        let specsHTML = '';
        if (item.customFields && item.customFields.length > 0) {
            item.customFields.forEach(field => {
                let displayValue = field.value;
                // Si es tipo fecha, formatearla bonito
                if (field.type === 'date' && field.value) {
                    const dateObj = new Date(field.value);
                    displayValue = dateObj.toLocaleDateString('es-ES');
                }
                specsHTML += `
                    <div class="spec-item">
                        <span class="spec-label">${field.name}:</span>
                        <span class="spec-value">${displayValue || '---'}</span>
                    </div>
                `;
            });
        } else {
            specsHTML = `<div class="no-specs">Ficha técnica vacía</div>`;
        }

        const cardHTML = `
            <div class="inventory-card">
                <div class="card-header">
                    <div class="card-title-group">
                        <h3>${item.name}</h3>
                        <span class="type-badge"><i data-lucide="${typeIcon}" style="width:14px;height:14px;"></i> ${item.type === 'vehiculo' ? 'Vehículo' : 'Maquinaria'}</span>
                    </div>
                    <span class="status-indicator ${statusClass}">${statusText}</span>
                </div>
                <div class="card-body">
                    <div class="specs-list">
                        ${specsHTML}
                    </div>
                </div>
                <div class="card-footer">
                    <button class="btn btn-neutral btn-sm" onclick="openFormModal('${item.id}')">
                        <i data-lucide="edit-3" style="width:14px;height:14px;"></i> Editar
                    </button>
                    <button class="btn btn-danger btn-sm" onclick="deleteItem('${item.id}')">
                        <i data-lucide="trash-2" style="width:14px;height:14px;"></i> Borrar
                    </button>
                </div>
            </div>
        `;
        
        inventoryGrid.insertAdjacentHTML('beforeend', cardHTML);
    });

    lucide.createIcons();
}

function renderAlerts() {
    alertsContainer.innerHTML = '';
    const activeAlerts = [];
    const today = new Date();
    
    // Analizar el inventario buscando fechas de alertas próximas o vencidas
    inventory.forEach(item => {
        if (item.customFields) {
            item.customFields.forEach(field => {
                if (field.hasAlert && field.value) {
                    const targetDate = new Date(field.value);
                    // Resetear horas para comparar solo días precisos
                    targetDate.setHours(0,0,0,0);
                    const compareDate = new Date(today);
                    compareDate.setHours(0,0,0,0);

                    const timeDiff = targetDate.getTime() - compareDate.getTime();
                    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                    if (daysDiff <= 0) {
                        // VENCIDO (Alerta Crítica)
                        activeAlerts.push({
                            itemName: item.name,
                            fieldName: field.name,
                            days: daysDiff,
                            dateStr: targetDate.toLocaleDateString('es-ES'),
                            critical: true
                        });
                    } else if (daysDiff <= 15) {
                        // PRÓXIMO (Alerta de advertencia - 15 días de margen)
                        activeAlerts.push({
                            itemName: item.name,
                            fieldName: field.name,
                            days: daysDiff,
                            dateStr: targetDate.toLocaleDateString('es-ES'),
                            critical: false
                        });
                    }
                }
            });
        }
    });

    if (activeAlerts.length === 0) {
        alertsContainer.innerHTML = `
            <div class="no-alerts">
                <i data-lucide="shield-check" style="width:48px;height:48px;color:var(--primary-light);"></i>
                <p>Todo al día. No hay alertas ni mantenimientos vencidos para los próximos 15 días.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    // Ordenar alertas: críticas primero
    activeAlerts.sort((a, b) => (a.critical === b.critical) ? 0 : a.critical ? -1 : 1);

    activeAlerts.forEach(alert => {
        const cardClass = alert.critical ? 'critical' : 'warning';
        const iconName = alert.critical ? 'alert-octagon' : 'alert-triangle';
        const msg = alert.critical 
            ? `¡VENCIDO hace ${Math.abs(alert.days)} ${Math.abs(alert.days) === 1 ? 'día' : 'días'}!` 
            : `Vence en ${alert.days} ${alert.days === 1 ? 'día' : 'días'}`;

        const alertHTML = `
            <div class="alert-card ${cardClass}">
                <div class="alert-icon-wrapper">
                    <i data-lucide="${iconName}"></i>
                </div>
                <div class="alert-info">
                    <span class="alert-tag">${alert.itemName}</span>
                    <h4>${alert.fieldName}</h4>
                    <p>${msg} (<span class="alert-date">${alert.dateStr}</span>)</p>
                </div>
            </div>
        `;
        
        alertsContainer.insertAdjacentHTML('beforeend', alertHTML);
    });

    lucide.createIcons();
}
