// ==========================================================================
// CONFIGURACIÓN Y ESTADO DE LA APLICACIÓN
// ==========================================================================
let inventory = [];
let currentViewingItemId = null;

// Elementos de Control de Vistas (Páginas Completas)
const viewDashboard = document.getElementById('view-dashboard');
const viewDetail = document.getElementById('view-detail');
const viewForm = document.getElementById('view-form');

// Botones de Navegación
const btnAddItem = document.getElementById('btn-add-item');
const btnBackToDashboardFromDetail = document.getElementById('btn-back-to-dashboard-from-detail');
const btnBackToDashboardFromForm = document.getElementById('btn-back-to-dashboard-from-form');

// Formulario
const equipmentForm = document.getElementById('equipment-form');
const customFieldsContainer = document.getElementById('custom-fields-container');
const btnAddField = document.getElementById('btn-add-field');

// Dashboard & Fichas
const inventoryGrid = document.getElementById('inventory-grid');
const alertsContainer = document.getElementById('alerts-container');
const filterBtns = document.querySelectorAll('.filter-btn');

// Detalle de Ficha
const btnEditDetail = document.getElementById('btn-edit-detail');
const btnDeleteDetail = document.getElementById('btn-delete-detail');
const detailTitle = document.getElementById('detail-title');
const detailStatusBadge = document.getElementById('detail-status-badge');
const detailTypeText = document.getElementById('detail-type-text');
const detailTypeIcon = document.getElementById('detail-type-icon');
const detailSpecsList = document.getElementById('detail-specs-list');

// Modales de Confirmación y Alerta
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

// Control centralizado para deslizar "páginas" completas
function navigateTo(targetView) {
    // Ocultar todas las vistas deslizando
    viewDashboard.classList.remove('active');
    viewDetail.classList.remove('active');
    viewForm.classList.remove('active');
    
    // Activar la seleccionada
    targetView.classList.add('active');
}

function setupEventListeners() {
    // Entrar y Salir de la pantalla de registro
    btnAddItem.addEventListener('click', () => {
        openFormView();
    });
    btnBackToDashboardFromForm.addEventListener('click', () => {
        navigateTo(viewDashboard);
    });

    // Volver de Ficha Detallada
    btnBackToDashboardFromDetail.addEventListener('click', () => {
        navigateTo(viewDashboard);
    });

    // Acciones desde Ficha Detallada
    btnEditDetail.addEventListener('click', () => {
        openFormView(currentViewingItemId);
    });
    btnDeleteDetail.addEventListener('click', () => {
        deleteItem(currentViewingItemId);
    });

    // Campos dinámicos del formulario
    btnAddField.addEventListener('click', () => addCustomFieldRow());
    equipmentForm.addEventListener('submit', handleFormSubmit);

    // Filtros
    filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            filterBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            renderInventory(e.target.dataset.filter);
        });
    });

    // Modales informativos
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
// PANTALLA DE FICHA DETALLADA (PÁGINA COMPLETA)
// ==========================================================================
function openDetailView(itemId) {
    currentViewingItemId = itemId;
    const item = inventory.find(i => i.id === itemId);
    if (!item) return;

    detailTitle.textContent = item.name;
    detailTypeText.textContent = item.type === 'vehiculo' ? 'Vehículo' : 'Maquinaria';
    
    detailTypeIcon.innerHTML = item.type === 'vehiculo' 
        ? '<i data-lucide="car" style="width:36px;height:36px;"></i>' 
        : '<i data-lucide="wrench" style="width:36px;height:36px;"></i>';

    let statusText = 'Operativo';
    if (item.status === 'revision') statusText = 'Revisión';
    if (item.status === 'taller') statusText = 'En Taller';
    detailStatusBadge.className = `status-badge-3d ${item.status}`;
    detailStatusBadge.textContent = statusText;

    detailSpecsList.innerHTML = '';
    if (item.customFields && item.customFields.length > 0) {
        item.customFields.forEach(field => {
            let displayValue = field.value;
            if (field.type === 'date' && field.value) {
                const dateObj = new Date(field.value);
                displayValue = dateObj.toLocaleDateString('es-ES');
            }
            
            const specHTML = `
                <div class="spec-item-3d">
                    <span class="label">${field.name}</span>
                    <span class="value">${displayValue || '---'}</span>
                </div>
            `;
            detailSpecsList.insertAdjacentHTML('beforeend', specHTML);
        });
    } else {
        detailSpecsList.innerHTML = `
            <div class="spec-item-3d" style="justify-content: center; color: var(--text-secondary); font-style: italic;">
                No tiene datos técnicos registrados.
            </div>
        `;
    }

    navigateTo(viewDetail);
    lucide.createIcons();
}

// ==========================================================================
// PANTALLA DE FORMULARIO (PÁGINA COMPLETA)
// ==========================================================================
function openFormView(itemId = null) {
    equipmentForm.reset();
    customFieldsContainer.innerHTML = '';
    
    if (itemId) {
        const item = inventory.find(i => i.id === itemId);
        document.getElementById('modal-title').textContent = 'Editar Ficha';
        document.getElementById('item-id').value = item.id;
        document.getElementById('item-name').value = item.name;
        document.getElementById('item-type').value = item.type;
        document.getElementById('item-status').value = item.status;
        
        item.customFields.forEach(field => {
            addCustomFieldRow(field.name, field.value, field.type, field.hasAlert);
        });
    } else {
        document.getElementById('modal-title').textContent = 'Añadir Ficha';
        document.getElementById('item-id').value = '';
        addCustomFieldRow('Última Revisión', '', 'text', false);
        addCustomFieldRow('Próxima ITV / Alerta', '', 'text', false);
    }
    
    navigateTo(viewForm);
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
    navigateTo(viewDashboard);
    render();
}

function deleteItem(id) {
    const item = inventory.find(i => i.id === id);
    showSystemConfirm(`¿Estás seguro de que deseas eliminar permanentemente a "${item.name}"?`, () => {
        inventory = inventory.filter(i => i.id !== id);
        saveInventory();
        navigateTo(viewDashboard);
        render();
    });
}

// ==========================================================================
// CAMPOS PERSONALIZADOS DINÁMICOS
// ==========================================================================
function addCustomFieldRow(name = '', value = '', type = 'text', hasAlert = false) {
    const rowId = 'field_' + Math.random().toString(36).substr(2, 9);
    
    const rowHTML = `
        <div class="custom-field-row" id="${rowId}">
            <input type="text" class="field-name" placeholder="Ej. ITV" value="${name}" required>
            <input type="${type}" class="field-value" placeholder="Valor" value="${value}" required>
            <div class="switch-container">
                <span>Alerta</span>
                <label class="switch">
                    <input type="checkbox" class="field-alert" ${hasAlert ? 'checked' : ''}>
                    <span class="slider"></span>
                </label>
            </div>
            <button type="button" class="btn-delete-field" onclick="document.getElementById('${rowId}').remove()">
                <i data-lucide="trash-2" style="width:16px; height:16px;"></i>
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
// ALERTAS NATIVAS EN DIALOGS
// ==========================================================================
function showSystemAlert(title, text) {
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
// PERSISTENCIA DE DATOS (LOCAL STORAGE)
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
// RENDERIZADO VISUAL
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
            <div style="text-align:center; padding: 3rem 1rem; color: var(--text-secondary); width: 100%;">
                <i data-lucide="package-open" style="margin: 0 auto 0.75rem auto; width:36px; height:36px; display:block; opacity: 0.5;"></i>
                <p style="font-size: 0.9rem; font-weight: 600;">Inventario vacío.</p>
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
            <div class="premium-item-card ${item.status}" onclick="openDetailView('${item.id}')">
                <div class="card-title-block">
                    <div class="avatar-wrapper-3d">
                        <i data-lucide="${typeIcon}"></i>
                    </div>
                    <div>
                        <h3>${item.name}</h3>
                        <span class="subtitle">${itemTypeLabel}</span>
                    </div>
                </div>
                <span class="status-badge-3d ${item.status}">${statusText}</span>
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
            <div style="background: rgba(255,255,255,0.02); padding: 1rem; text-align: center; border-radius: 14px; border: 1px solid var(--glass-border);">
                <p style="font-size: 0.85rem; font-weight:700; color: var(--text-secondary);">🎉 Todo al día. Sin mantenimientos pendientes.</p>
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
            <div class="alert-item-3d ${cardClass}" onclick="openDetailView('${alert.itemId}')">
                <div class="alert-3d-avatar">
                    <i data-lucide="${iconName}"></i>
                </div>
                <div class="info">
                    <h4 style="color: #ffffff;">${alert.itemName} - ${alert.fieldName}</h4>
                    <p>${msg} (${alert.dateStr})</p>
                </div>
            </div>
        `;
        
        alertsContainer.insertAdjacentHTML('beforeend', alertHTML);
    });

    lucide.createIcons();
}
