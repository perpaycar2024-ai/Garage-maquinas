// ==========================================================================
// CONFIGURACIÓN Y ESTADO DE LA APLICACIÓN
// ==========================================================================
let inventory = [];
let currentViewingItemId = null; // Guarda el ID del item que se está viendo en detalle

// Elementos del DOM
const btnAddItem = document.getElementById('btn-add-item');
const modalForm = document.getElementById('modal-form');
const closeFormBtn = document.getElementById('close-form-btn');
const equipmentForm = document.getElementById('equipment-form');
const customFieldsContainer = document.getElementById('custom-fields-container');
const btnAddField = document.getElementById('btn-add-field');
const inventoryGrid = document.getElementById('inventory-grid');
const alertsContainer = document.getElementById('alerts-container');
const filterBtns = document.querySelectorAll('.filter-btn');

// Elementos de la Ficha Detallada
const modalDetail = document.getElementById('modal-detail');
const closeDetailBtn = document.getElementById('close-detail-btn');
const btnEditDetail = document.getElementById('btn-edit-detail');
const btnDeleteDetail = document.getElementById('btn-delete-detail');
const detailTitle = document.getElementById('detail-title');
const detailStatusBadge = document.getElementById('detail-status-badge');
const detailTypeText = document.getElementById('detail-type-text');
const detailTypeIcon = document.getElementById('detail-type-icon');
const detailSpecsList = document.getElementById('detail-specs-list');

// Elementos de Modales de Sistema (Nativos)
const modalAlert = document.getElementById('modal-alert');
const sysAlertTitle = document.getElementById('sys-alert-title');
const sysAlertText = document.getElementById('sys-alert-text');
const btnCloseSysAlert = document.getElementById('btn-close-sys-alert');

const modalConfirm = document.getElementById('modal-confirm');
const sysConfirmText = document.getElementById('sys-confirm-text');
const btnCancelConfirm = document.getElementById('btn-cancel-confirm');
const btnOkConfirm = document.getElementById('btn-ok-confirm');

let confirmCallback = null;

// ==========================================================================
// INICIALIZACIÓN
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
    loadInventory();
    setupEventListeners();
    render();
});

function setupEventListeners() {
    // Abrir/Cerrar Formularios
    btnAddItem.addEventListener('click', () => openFormModal());
    closeFormBtn.addEventListener('click', () => modalForm.classList.remove('active'));
    
    // Ficha detallada
    closeDetailBtn.addEventListener('click', () => modalDetail.classList.remove('active'));
    btnEditDetail.addEventListener('click', () => {
        modalDetail.classList.remove('active');
        openFormModal(currentViewingItemId);
    });
    btnDeleteDetail.addEventListener('click', () => {
        modalDetail.classList.remove('active');
        deleteItem(currentViewingItemId);
    });

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

    // Modales del sistema
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
// CONTROL DE ALERTAS NATIVAS
// ==========================================================================
function showSystemAlert(title, text, type = 'info') {
    sysAlertTitle.textContent = title;
    sysAlertText.textContent = text;
    modalAlert.classList.add('active');
}

function showSystemConfirm(text, callback) {
    sysConfirmText.textContent = text;
    confirmCallback = callback;
    modalConfirm.classList.add('active');
}

// ==========================================================================
// CAMPOS PERSONALIZADOS DINÁMICOS
// ==========================================================================
function addCustomFieldRow(name = '', value = '', type = 'text', hasAlert = false) {
    const rowId = 'field_' + Math.random().toString(36).substr(2, 9);
    
    const rowHTML = `
        <div class="custom-field-row" id="${rowId}">
            <input type="text" class="field-name" placeholder="ITV, Aceite..." value="${name}" required>
            <input type="${type}" class="field-value" placeholder="Dato o Fecha" value="${value}" required>
            <div class="switch-container">
                <span>Alerta</span>
                <label class="switch">
                    <input type="checkbox" class="field-alert" ${hasAlert ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
            <button type="button" class="btn-delete-field" onclick="document.getElementById('${rowId}').remove()">
                <i data-lucide="trash-2" style="width:18px; height:18px;"></i>
            </button>
        </div>
    `;
    
    customFieldsContainer.insertAdjacentHTML('beforeend', rowHTML);
    
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

    if (hasAlert) {
        valueInput.type = 'date';
    }

    lucide.createIcons();
}

// ==========================================================================
// DETALLE DE FICHA (A PANTALLA COMPLETA)
// ==========================================================================
function openDetailModal(itemId) {
    currentViewingItemId = itemId;
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;

    // Título y categoría
    detailTitle.textContent = item.name;
    detailTypeText.textContent = item.type === 'vehiculo' ? 'Vehículo' : 'Maquinaria';
    
    // Icono correspondiente
    detailTypeIcon.innerHTML = item.type === 'vehiculo' 
        ? '<i data-lucide="car" style="width:28px;height:28px;"></i>' 
        : '<i data-lucide="wrench" style="width:28px;height:28px;"></i>';

    // Estado Pill
    let statusText = 'Operativo';
    if (item.status === 'revision') statusText = 'Revisión';
    if (item.status === 'taller') statusText = 'En Taller';
    detailStatusBadge.className = `status-indicator ${item.status}`;
    detailStatusBadge.textContent = statusText;

    // Limpiar y renderizar la lista de especificaciones
    detailSpecsList.innerHTML = '';
    if (item.customFields && item.customFields.length > 0) {
        item.customFields.forEach(field => {
            let displayValue = field.value;
            if (field.type === 'date' && field.value) {
                const dateObj = new Date(field.value);
                displayValue = dateObj.toLocaleDateString('es-ES');
            }
            
            const specHTML = `
                <div class="native-spec-item">
                    <span class="native-spec-label">${field.name}</span>
                    <span class="native-spec-value">${displayValue || '---'}</span>
                </div>
            `;
            detailSpecsList.insertAdjacentHTML('beforeend', specHTML);
        });
    } else {
        detailSpecsList.innerHTML = `
            <div class="native-spec-item" style="justify-content: center; color: var(--text-muted); font-style: italic;">
                Ficha de especificaciones vacía.
            </div>
        `;
    }

    modalDetail.classList.add('active');
    lucide.createIcons();
}

// ==========================================================================
// GUARDAR Y EDITAR FORMULARIO
// ==========================================================================
function openFormModal(itemId = null) {
    equipmentForm.reset();
    customFieldsContainer.innerHTML = '';
    
    if (itemId) {
        const item = inventory.find(i => i.id === itemId);
        document.getElementById('modal-title').textContent = 'Editar Equipo';
        document.getElementById('item-id').value = item.id;
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-type').value = item.type;
        document.getElementById('item-status').value = item.status;
        
        item.customFields.forEach(field => {
            addCustomFieldRow(field.name, field.value, field.type, field.hasAlert);
        });
    } else {
        document.getElementById('modal-title').textContent = 'Nuevo Equipo';
        document.getElementById('item-id').value = '';
        addCustomFieldRow('Última Revisión', '', 'text', false);
        addCustomFieldRow('Próxima ITV / Alerta', '', 'text', false);
    }
    
    modalForm.classList.add('active');
}

function handleFormSubmit(e) {
    e.preventDefault();
    
    const id = document.getElementById('item-id').value;
    const name = document.getElementById('item-name').value;
    const type = document.getElementById('item-type').value;
    const status = document.getElementById('item-status').value;
    
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
        const index = inventory.findIndex(i => i.id === id);
        inventory[index] = { id, name, type, status, customFields };
    } else {
        const newItem = {
            id: 'item_' + Date.now(),
            name,
            type,
            status,
            customFields
        };
        inventory.push(newItem);
    }
    
    saveInventory();
    modalForm.classList.remove('active');
    render();
}

function deleteItem(id) {
    const item = inventory.find(i => i.id === id);
    showSystemConfirm(`¿Seguro que quieres eliminar "${item.name}"?`, () => {
        inventory = inventory.filter(i => i.id !== id);
        saveInventory();
        render();
    });
}

// ==========================================================================
// PERSISTENCIA DE DATOS (LOCALSTORAGE)
// ==========================================================================
function loadInventory() {
    const data = localStorage.getItem('resi_inventory');
    inventory = data ? JSON.parse(data) : getMockData();
}

function saveInventory() {
    localStorage.setItem('resi_inventory', JSON.stringify(inventory));
}

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
// RENDERIZADO VISUAL EN PANTALLA
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
            <div style="text-align:center; padding: 2rem; color: var(--text-muted); width: 100%;">
                <i data-lucide="package-open" style="margin: 0 auto 0.5rem auto; width:36px; height:36px; display:block;"></i>
                <p style="font-size: 0.9rem;">No hay equipos cargados.</p>
            </div>
        `;
        lucide.createIcons();
        return;
    }

    filtered.forEach(item => {
        let statusText = 'Operativo';
        if (item.status === 'revision') statusText = 'Revisión';
        if (item.status === 'taller') statusText = 'En Taller';

        const typeIcon = item.type === 'vehiculo' ? 'car' : 'wrench';
        const itemTypeLabel = item.type === 'vehiculo' ? 'Vehículo' : 'Maquinaria';

        const cardHTML = `
            <div class="compact-item-card" onclick="openDetailModal('${item.id}')">
                <div class="card-main-title">
                    <div class="card-avatar-icon">
                        <i data-lucide="${typeIcon}"></i>
                    </div>
                    <div>
                        <h3>${item.name}</h3>
                        <span class="card-subtitle">${itemTypeLabel}</span>
                    </div>
                </div>
                <span class="status-indicator ${item.status}">${statusText}</span>
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
    
    inventory.forEach(item => {
        if (item.customFields) {
            item.customFields.forEach(field => {
                if (field.hasAlert && field.value) {
                    const targetDate = new Date(field.value);
                    targetDate.setHours(0,0,0,0);
                    const compareDate = new Date(today);
                    compareDate.setHours(0,0,0,0);

                    const timeDiff = targetDate.getTime() - compareDate.getTime();
                    const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));

                    if (daysDiff <= 0) {
                        activeAlerts.push({
                            itemId: item.id,
                            itemName: item.name,
                            fieldName: field.name,
                            days: daysDiff,
                            dateStr: targetDate.toLocaleDateString('es-ES'),
                            critical: true
                        });
                    } else if (daysDiff <= 15) {
                        activeAlerts.push({
                            itemId: item.id,
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
            <div style="background-color: var(--surface); padding: 1rem; text-align: center; border-radius: var(--radius-ios); border: 1px solid var(--border); box-shadow: var(--shadow-native);">
                <p style="font-size: 0.85rem; font-weight:600; color: var(--text-muted);">🎉 Todo en regla. No hay alertas pendientes.</p>
            </div>
        `;
        return;
    }

    activeAlerts.sort((a, b) => (a.critical === b.critical) ? 0 : a.critical ? -1 : 1);

    activeAlerts.forEach(alert => {
        const cardClass = alert.critical ? 'critical' : 'warning';
        const iconName = alert.critical ? 'alert-octagon' : 'alert-triangle';
        const msg = alert.critical 
            ? `¡VENCIDO hace ${Math.abs(alert.days)} d!` 
            : `Vence en ${alert.days} d`;

        const alertHTML = `
            <div class="alert-card-native ${cardClass}" onclick="openDetailModal('${alert.itemId}')">
                <div class="alert-circle-icon">
                    <i data-lucide="${iconName}"></i>
                </div>
                <div class="info">
                    <h4>${alert.itemName} - ${alert.fieldName}</h4>
                    <p>${msg} (${alert.dateStr})</p>
                </div>
            </div>
        `;
        
        alertsContainer.insertAdjacentHTML('beforeend', alertHTML);
    });

    lucide.createIcons();
}
