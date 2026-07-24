/* ============================================================
   iStorage — Inventory Management
   Application Logic — Persistent Inventory System
   ============================================================ */

//resat btn
  document
    .getElementById("resetBtn")
    .addEventListener("click", function () {
      const confirmDelete = confirm(
        "Are you sure?\n\nThis will permanently delete all saved data from this device."
      );

      if (confirmDelete) {
        // Clear browser storage
        localStorage.clear();
        sessionStorage.clear();

        // Success message
        alert("All saved data has been deleted successfully!");

        // Reload the page after 1 second
        setTimeout(() => {
          location.reload();
        }, 1000);
      }
    });

//resat btn


(function () {
  'use strict';

  // ── Data Keys ──────────────────────────────────────────────
  var KEY_INVENTORY = 'istorage_inventory';
  var KEY_MOVEMENTS = 'istorage_movements';

  // ── Movement Type Labels ───────────────────────────────────
  var MOVEMENT_LABELS = {
    new_stock_in: 'New Stock In',
    sold_out: 'Sold Out',
    service_in: 'Service In',
    service_completed: 'Service Done',
    sent_outside: 'Sent Outside',
    returned_outside: 'Returned Outside',
  };

  var MOVEMENT_DESCRIPTIONS = {
    new_stock_in: 'Add new inventory to desk stock',
    sold_out: 'Remove sold items from desk stock',
    service_in: 'Move items from desk to service',
    service_completed: 'Return items from service to desk',
    sent_outside: 'Move items from desk to outside',
    returned_outside: 'Return items from outside to desk',
  };

  // ── Helpers ────────────────────────────────────────────────
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function formatDateFull(dateStr) {
    if (!dateStr) return '';
    var d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  }

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function formatTime12(createdAt) {
    var d = new Date(createdAt);
    var hours = d.getHours();
    var minutes = d.getMinutes();
    var ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    var minStr = minutes < 10 ? '0' + minutes : minutes;
    return hours + ':' + minStr + ' ' + ampm;
  }

  // ── Inventory Data Access (Persistent) ─────────────────────
  function getInventory() {
    try {
      return JSON.parse(localStorage.getItem(KEY_INVENTORY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveInventory(inventory) {
    localStorage.setItem(KEY_INVENTORY, JSON.stringify(inventory));
  }

  function findInventoryItem(model) {
    var inventory = getInventory();
    for (var i = 0; i < inventory.length; i++) {
      if (inventory[i].model.toLowerCase() === model.toLowerCase()) {
        return inventory[i];
      }
    }
    return null;
  }

  function addInventoryModel(modelName) {
    var inventory = getInventory();
    var model = modelName.trim();
    // Check duplicate
    for (var i = 0; i < inventory.length; i++) {
      if (inventory[i].model.toLowerCase() === model.toLowerCase()) {
        return { success: false, message: 'This model already exists in inventory.' };
      }
    }
    var newItem = {
      id: generateId(),
      model: model,
      desk: 0,
      service: 0,
      outside: 0,
    };
    inventory.push(newItem);
    saveInventory(inventory);
    return { success: true };
  }

  function updateInventoryQuantity(id, desk, service, outside) {
    var inventory = getInventory();
    for (var i = 0; i < inventory.length; i++) {
      if (inventory[i].id === id) {
        inventory[i].desk = Math.max(0, parseInt(desk, 10) || 0);
        inventory[i].service = Math.max(0, parseInt(service, 10) || 0);
        inventory[i].outside = Math.max(0, parseInt(outside, 10) || 0);
        saveInventory(inventory);
        return true;
      }
    }
    return false;
  }

  function deleteInventoryModel(id) {
    var inventory = getInventory().filter(function (item) {
      return item.id !== id;
    });
    saveInventory(inventory);
  }

  // ── Stock Movement Operations ──────────────────────────────
  // These directly modify the persistent inventory quantities

  function applyMovement(type, model, qty) {
    var inventory = getInventory();
    var item = null;
    for (var i = 0; i < inventory.length; i++) {
      if (inventory[i].model.toLowerCase() === model.toLowerCase()) {
        item = inventory[i];
        break;
      }
    }

    if (!item) {
      return { success: false, message: 'Model "' + model + '" not found. Please add it to inventory first.' };
    }

    qty = parseInt(qty, 10);

    switch (type) {
      case 'new_stock_in':
        item.desk += qty;
        break;

      case 'sold_out':
        if (item.desk < qty) {
          return { success: false, message: 'Only ' + item.desk + ' units of ' + model + ' available in Desk stock.' };
        }
        item.desk -= qty;
        break;

      case 'service_in':
        if (item.desk < qty) {
          return { success: false, message: 'Only ' + item.desk + ' units of ' + model + ' available in Desk stock.' };
        }
        item.desk -= qty;
        item.service += qty;
        break;

      case 'service_completed':
        if (item.service < qty) {
          return { success: false, message: 'Only ' + item.service + ' units of ' + model + ' in Service.' };
        }
        item.service -= qty;
        item.desk += qty;
        break;

      case 'sent_outside':
        if (item.desk < qty) {
          return { success: false, message: 'Only ' + item.desk + ' units of ' + model + ' available in Desk stock.' };
        }
        item.desk -= qty;
        item.outside += qty;
        break;

      case 'returned_outside':
        if (item.outside < qty) {
          return { success: false, message: 'Only ' + item.outside + ' units of ' + model + ' available Outside.' };
        }
        item.outside -= qty;
        item.desk += qty;
        break;
    }

    saveInventory(inventory);
    return { success: true };
  }

  function reverseMovement(type, model, qty) {
    // Reverse the effect of a movement (used when deleting from log)
    var reversed = {
      new_stock_in: 'sold_out',
      sold_out: 'new_stock_in',
      service_in: 'service_completed',
      service_completed: 'service_in',
      sent_outside: 'returned_outside',
      returned_outside: 'sent_outside',
    };
    var reverseType = reversed[type];
    if (reverseType) {
      return applyMovement(reverseType, model, qty);
    }
    return { success: false, message: 'Cannot reverse this movement.' };
  }

  // ── Movements Log Access ───────────────────────────────────
  function getMovements() {
    try {
      return JSON.parse(localStorage.getItem(KEY_MOVEMENTS)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveMovements(movements) {
    localStorage.setItem(KEY_MOVEMENTS, JSON.stringify(movements));
  }

  function recordMovement(type, date, model, qty, notes) {
    var movements = getMovements();
    movements.push({
      id: generateId(),
      type: type,
      date: date,
      model: model.trim(),
      quantity: parseInt(qty, 10),
      notes: (notes || '').trim(),
      createdAt: Date.now(),
    });
    saveMovements(movements);
  }

  function deleteMovementRecord(id) {
    var movements = getMovements().filter(function (m) {
      return m.id !== id;
    });
    saveMovements(movements);
  }

  // ── Stock Counts (from persistent inventory) ───────────────
  function getStockCounts() {
    var inventory = getInventory();
    var desk = 0, service = 0, outside = 0;
    inventory.forEach(function (item) {
      desk += item.desk;
      service += item.service;
      outside += item.outside;
    });
    return {
      desk: desk,
      service: service,
      outside: outside,
      total: desk + service + outside,
    };
  }

  function getModelInventory() {
    var inventory = getInventory();
    var result = inventory.map(function (item) {
      return {
        id: item.id,
        model: item.model,
        desk: item.desk,
        service: item.service,
        outside: item.outside,
        total: item.desk + item.service + item.outside,
      };
    });
    result.sort(function (a, b) {
      return a.model.localeCompare(b.model);
    });
    return result;
  }

  // ── Filtered Model Lists for Movement Dropdowns ────────────
  // Returns models that have stock in the required source location
  function getFilteredModelsForMovement(type) {
    var inventory = getInventory();
    var models = [];

    inventory.forEach(function (item) {
      switch (type) {
        case 'new_stock_in':
          // Any existing model can receive new stock
          models.push(item.model);
          break;
        case 'sold_out':
          // Only models with desk stock > 0
          if (item.desk > 0) models.push(item.model);
          break;
        case 'service_in':
          // Only models with desk stock > 0
          if (item.desk > 0) models.push(item.model);
          break;
        case 'service_completed':
          // Only models with service stock > 0
          if (item.service > 0) models.push(item.model);
          break;
        case 'sent_outside':
          // Only models with desk stock > 0
          if (item.desk > 0) models.push(item.model);
          break;
        case 'returned_outside':
          // Only models with outside stock > 0
          if (item.outside > 0) models.push(item.model);
          break;
      }
    });

    models.sort();
    return models;
  }

  // ── Daily Movements ────────────────────────────────────────
  function getDailyMovements(date) {
    date = date || today();
    return getMovements().filter(function (m) {
      return m.date === date;
    });
  }

  function getDailySummary(date) {
    date = date || today();
    var daily = getDailyMovements(date);
    var s = { newIn: 0, soldOut: 0, serviceIn: 0, serviceCompleted: 0, sentOutside: 0, returnedOutside: 0 };
    daily.forEach(function (m) {
      switch (m.type) {
        case 'new_stock_in': s.newIn += m.quantity; break;
        case 'sold_out': s.soldOut += m.quantity; break;
        case 'service_in': s.serviceIn += m.quantity; break;
        case 'service_completed': s.serviceCompleted += m.quantity; break;
        case 'sent_outside': s.sentOutside += m.quantity; break;
        case 'returned_outside': s.returnedOutside += m.quantity; break;
      }
    });
    return s;
  }

  // Calculate opening stock for a given date by reversing all movements on and after that date
  function getOpeningStock(date) {
    date = date || today();
    var currentCounts = getStockCounts();
    var movements = getMovements();

    // We need to undo all movements from this date onwards to get opening stock
    var desk = currentCounts.desk;
    var service = currentCounts.service;
    var outside = currentCounts.outside;

    // Get all movements on or after the date, sorted by date desc, then createdAt desc
    var relevantMoves = movements.filter(function (m) {
      return m.date >= date;
    }).sort(function (a, b) {
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.createdAt - a.createdAt;
    });

    // Reverse each movement
    relevantMoves.forEach(function (m) {
      var qty = m.quantity;
      switch (m.type) {
        case 'new_stock_in':
          desk -= qty;
          break;
        case 'sold_out':
          desk += qty;
          break;
        case 'service_in':
          desk += qty;
          service -= qty;
          break;
        case 'service_completed':
          service += qty;
          desk -= qty;
          break;
        case 'sent_outside':
          desk += qty;
          outside -= qty;
          break;
        case 'returned_outside':
          outside += qty;
          desk -= qty;
          break;
      }
    });

    return {
      desk: Math.max(0, desk),
      service: Math.max(0, service),
      outside: Math.max(0, outside),
      total: Math.max(0, desk) + Math.max(0, service) + Math.max(0, outside),
    };
  }

  // ── Toast Notification ─────────────────────────────────────
  function showToast(message, type) {
    type = type || 'success';
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast toast--' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = '0.3s ease';
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 2800);
  }

  // ── Modal ──────────────────────────────────────────────────
  function showModal(title, bodyHtml, footerHtml) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    document.getElementById('modalFooter').innerHTML = footerHtml || '';
    document.getElementById('modalOverlay').classList.add('active');
  }

  function hideModal() {
    document.getElementById('modalOverlay').classList.remove('active');
  }

  // ── Section Navigation ─────────────────────────────────────
  function navigateTo(sectionName) {
    document.querySelectorAll('.section').forEach(function (s) {
      s.classList.remove('active');
    });
    var target = document.getElementById('section-' + sectionName);
    if (target) target.classList.add('active');

    document.querySelectorAll('.nav-link').forEach(function (link) {
      link.classList.toggle('active', link.dataset.section === sectionName);
    });
    document.querySelectorAll('.bottom-nav-item').forEach(function (item) {
      item.classList.toggle('active', item.dataset.section === sectionName);
    });

    var titles = {
      dashboard: 'Dashboard',
      movement: 'Stock Movement',
      inventory: 'Inventory',
      report: 'Reports',
    };
    document.getElementById('pageTitle').textContent = titles[sectionName] || 'Dashboard';

    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('active');

    if (sectionName === 'dashboard') renderDashboard();
    if (sectionName === 'inventory') renderInventoryTable();
    if (sectionName === 'movement') {
      renderMovementLog();
      refreshFilteredDatalist();
    }
    if (sectionName === 'report') renderReportPreview();
  }

  // ── Render: Dashboard ──────────────────────────────────────
  function renderDashboard() {
    var counts = getStockCounts();
    var summary = getDailySummary();
    var dailyMoves = getDailyMovements();

    document.getElementById('stat-total').textContent = counts.total;
    document.getElementById('stat-desk').textContent = counts.desk;
    document.getElementById('stat-service').textContent = counts.service;
    document.getElementById('stat-outside').textContent = counts.outside;
    document.getElementById('stat-sold').textContent = summary.soldOut;
    document.getElementById('stat-newin').textContent = summary.newIn;

    document.getElementById('summary-desk').textContent = counts.desk + ' pcs';
    document.getElementById('summary-service').textContent = counts.service + ' pcs';
    document.getElementById('summary-outside').textContent = counts.outside + ' pcs';
    document.getElementById('summary-total').textContent = counts.total + ' pcs';
    document.getElementById('summaryDate').textContent = formatDateFull(today());

    var activityEl = document.getElementById('todayActivity');
    if (dailyMoves.length === 0) {
      activityEl.innerHTML =
        '<div class="empty-state">' +
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>' +
        '<p>No activity recorded today</p>' +
        '</div>';
    } else {
      var html = '';
      dailyMoves.slice().reverse().forEach(function (m) {
        var dotClass = 'activity-dot--';
        if (m.type === 'new_stock_in' || m.type === 'service_completed' || m.type === 'returned_outside') dotClass += 'in';
        else if (m.type === 'sold_out') dotClass += 'out';
        else dotClass += 'move';

        var sign = (m.type === 'sold_out' || m.type === 'service_in' || m.type === 'sent_outside') ? '-' : '+';
        var timeStr = formatTime12(m.createdAt);
        html +=
          '<div class="activity-item">' +
          '<div class="activity-dot ' + dotClass + '"></div>' +
          '<div class="activity-info">' +
          '<div class="activity-text">' + MOVEMENT_LABELS[m.type] + ' — ' + escapeHtml(m.model) + '</div>' +
          '<div class="activity-meta">' + timeStr + (m.notes ? ' · ' + escapeHtml(m.notes) : '') + '</div>' +
          '</div>' +
          '<div class="activity-qty">' + sign + m.quantity + '</div>' +
          '</div>';
      });
      activityEl.innerHTML = html;
    }
  }

  // ── Render: Movement Log ───────────────────────────────────
  function renderMovementLog() {
    var daily = getDailyMovements();
    var logEl = document.getElementById('movementLog');

    if (daily.length === 0) {
      logEl.innerHTML =
        '<div class="empty-state">' +
        '<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" opacity="0.3"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>' +
        '<p>No movements recorded today</p>' +
        '</div>';
      return;
    }

    var html = '';
    daily.slice().reverse().forEach(function (m) {
      var timeStr = formatTime12(m.createdAt);
      html +=
        '<div class="movement-log-item">' +
        '<span class="movement-type-badge badge-' + m.type + '">' + MOVEMENT_LABELS[m.type] + '</span>' +
        '<div class="movement-log-info">' +
        '<div class="movement-log-model">' + escapeHtml(m.model) + '</div>' +
        '<div class="movement-log-notes">' + timeStr + (m.notes ? ' · ' + escapeHtml(m.notes) : '') + '</div>' +
        '</div>' +
        '<div class="movement-log-qty">' + m.quantity + '</div>' +
        '<button class="movement-log-delete" data-id="' + m.id + '" title="Delete">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
        '</div>';
    });
    logEl.innerHTML = html;
  }

  // ── Render: Inventory Table ────────────────────────────────
  function renderInventoryTable() {
    var modelInv = getModelInventory();
    var searchVal = (document.getElementById('searchInput').value || '').toLowerCase();
    var filterLoc = document.getElementById('filterLocation').value;

    var filtered = modelInv.filter(function (item) {
      if (searchVal && item.model.toLowerCase().indexOf(searchVal) === -1) return false;
      if (filterLoc !== 'all' && item[filterLoc] === 0) return false;
      return true;
    });

    var tbody = document.getElementById('inventoryBody');
    var tfoot = document.getElementById('inventoryFooter');
    var emptyEl = document.getElementById('inventoryEmpty');
    var tableEl = document.getElementById('inventoryTable');

    if (filtered.length === 0) {
      tableEl.style.display = 'none';
      emptyEl.style.display = '';
      return;
    }

    tableEl.style.display = '';
    emptyEl.style.display = 'none';

    var html = '';
    filtered.forEach(function (item) {
      html +=
        '<tr data-id="' + item.id + '">' +
        '<td class="model-name">' + escapeHtml(item.model) + '</td>' +
        '<td>' + item.desk + '</td>' +
        '<td>' + item.service + '</td>' +
        '<td>' + item.outside + '</td>' +
        '<td><strong>' + item.total + '</strong></td>' +
        '<td>' +
        '<div class="table-actions">' +
        '<button class="btn-icon btn-icon--edit" data-action="edit" data-id="' + item.id + '" title="Edit Quantities">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
        '</button>' +
        '<button class="btn-icon btn-icon--delete" data-action="delete" data-id="' + item.id + '" data-model="' + escapeHtml(item.model) + '" title="Delete Model">' +
        '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>' +
        '</button>' +
        '</div>' +
        '</td>' +
        '</tr>';
    });
    tbody.innerHTML = html;

    // Footer totals
    var tDesk = 0, tService = 0, tOutside = 0, tAll = 0;
    filtered.forEach(function (item) {
      tDesk += item.desk;
      tService += item.service;
      tOutside += item.outside;
      tAll += item.total;
    });

    tfoot.innerHTML =
      '<tr>' +
      '<td><strong>Total (' + filtered.length + ' models)</strong></td>' +
      '<td><strong>' + tDesk + '</strong></td>' +
      '<td><strong>' + tService + '</strong></td>' +
      '<td><strong>' + tOutside + '</strong></td>' +
      '<td><strong>' + tAll + '</strong></td>' +
      '<td></td>' +
      '</tr>';
  }

  // ── Render: Report Preview ─────────────────────────────────
  function renderReportPreview() {
    var reportDate = document.getElementById('reportDate').value || today();
    var counts = getStockCounts();
    var summary = getDailySummary(reportDate);
    var modelInv = getModelInventory().filter(function (m) { return m.total > 0; });
    var openingStock = getOpeningStock(reportDate);
    var totalIncoming = summary.newIn + summary.serviceCompleted + summary.returnedOutside;
    var totalOutgoing = summary.soldOut + summary.serviceIn + summary.sentOutside;
    var closingStock = openingStock.total + totalIncoming - totalOutgoing;
    if (closingStock < 0) closingStock = 0;

    var html =
      '<div class="report-header">' +
      '<div class="report-logo">iS</div>' +
      '<h2>iStorage</h2>' +
      '<p>Daily Inventory Report</p>' +
      '<p class="report-date-line">' + formatDateFull(reportDate) + '</p>' +
      '</div>' +

      // Executive Summary
      '<div class="report-section">' +
      '<h3>Executive Summary</h3>' +
      '<div class="report-summary-box">' +
      '<div class="report-summary-grid">' +
      '<div class="report-summary-item"><span class="rs-label">Total Stock</span><span class="rs-value">' + counts.total + '</span></div>' +
      '<div class="report-summary-item"><span class="rs-label">Desk Stock</span><span class="rs-value">' + counts.desk + '</span></div>' +
      '<div class="report-summary-item"><span class="rs-label">Service</span><span class="rs-value">' + counts.service + '</span></div>' +
      '<div class="report-summary-item"><span class="rs-label">Outside</span><span class="rs-value">' + counts.outside + '</span></div>' +
      '<div class="report-summary-item"><span class="rs-label">Sold Today</span><span class="rs-value">' + summary.soldOut + '</span></div>' +
      '<div class="report-summary-item"><span class="rs-label">New In</span><span class="rs-value">' + summary.newIn + '</span></div>' +
      '</div>' +
      '</div>' +
      '</div>' +

      // Stock Movement Timeline
      '<div class="report-section">' +
      '<h3>Stock Movement Timeline</h3>' +
      '<div class="report-timeline">';

    var dayMovements = getDailyMovements(reportDate);
    if (dayMovements.length === 0) {
      html += '<div class="report-timeline-empty">No activity recorded for this date</div>';
    } else {
      dayMovements.forEach(function (m) {
        html +=
          '<div class="report-timeline-item">' +
          '<div class="report-timeline-time">' + formatTime12(m.createdAt) + '</div>' +
          '<div class="report-timeline-dot"></div>' +
          '<div class="report-timeline-content">' +
          MOVEMENT_LABELS[m.type] + ' (' + escapeHtml(m.model) + ' × ' + m.quantity + ')' +
          (m.notes ? '<div class="report-timeline-notes">' + escapeHtml(m.notes) + '</div>' : '') +
          '</div>' +
          '</div>';
      });
    }

    html += '</div></div>' +

      // Model Wise Inventory
      '<div class="report-section">' +
      '<h3>Model Wise Inventory</h3>' +
      '<table class="report-table">' +
      '<thead><tr><th>Model</th><th>Desk</th><th>Service</th><th>Outside</th><th>Total</th></tr></thead>' +
      '<tbody>';

    if (modelInv.length === 0) {
      html += '<tr><td colspan="5" style="text-align:center;color:var(--text-tertiary);font-style:italic;">No stock records</td></tr>';
    } else {
      modelInv.forEach(function (item) {
        html +=
          '<tr>' +
          '<td>' + escapeHtml(item.model) + '</td>' +
          '<td>' + item.desk + '</td>' +
          '<td>' + item.service + '</td>' +
          '<td>' + item.outside + '</td>' +
          '<td><strong>' + item.total + '</strong></td>' +
          '</tr>';
      });
      html +=
        '<tr class="report-table-total">' +
        '<td><strong>Grand Total</strong></td>' +
        '<td><strong>' + counts.desk + '</strong></td>' +
        '<td><strong>' + counts.service + '</strong></td>' +
        '<td><strong>' + counts.outside + '</strong></td>' +
        '<td><strong>' + counts.total + '</strong></td>' +
        '</tr>';
    }

    html += '</tbody></table></div>' +

      // Daily Summary
      '<div class="report-section">' +
      '<h3>Daily Summary</h3>' +
      '<div class="report-daily-summary">' +
      '<div class="report-ds-row"><span>Opening Stock</span><span>' + openingStock.total + '</span></div>' +
      '<div class="report-ds-row report-ds-in"><span>Total Incoming</span><span>+' + totalIncoming + '</span></div>' +
      '<div class="report-ds-row report-ds-out"><span>Total Outgoing</span><span>-' + totalOutgoing + '</span></div>' +
      '<div class="report-ds-row report-ds-total"><span>Closing Stock</span><span>' + closingStock + '</span></div>' +
      '</div>' +
      '</div>' +

      '<div class="report-footer">' +
      '<p>Generated Automatically — iStorage Inventory System</p>' +
      '</div>';

    document.getElementById('reportPreview').innerHTML = html;
  }

  // ── PDF Generation ─────────────────────────────────────────
  function generatePDF() {
    var jsPDF = window.jspdf ? window.jspdf.jsPDF : null;
    if (!jsPDF) {
      showToast('PDF library not loaded. Please check your connection.', 'error');
      return;
    }

    var doc = new jsPDF('p', 'mm', 'a4');
    var reportDate = document.getElementById('reportDate').value || today();
    var counts = getStockCounts();
    var summary = getDailySummary(reportDate);
    var modelInv = getModelInventory().filter(function (m) { return m.total > 0; });
    var openingStock = getOpeningStock(reportDate);
    var totalIncoming = summary.newIn + summary.serviceCompleted + summary.returnedOutside;
    var totalOutgoing = summary.soldOut + summary.serviceIn + summary.sentOutside;
    var closingStock = openingStock.total + totalIncoming - totalOutgoing;
    if (closingStock < 0) closingStock = 0;

    var pageWidth = doc.internal.pageSize.getWidth();
    var pageHeight = doc.internal.pageSize.getHeight();
    var margin = 20;
    var contentWidth = pageWidth - 2 * margin;
    var y = 15;

    // Helper to check for page break
    function checkPageBreak(neededSpace) {
      if (y + neededSpace > pageHeight - 25) {
        doc.addPage();
        y = 20;
        return true;
      }
      return false;
    }

    // ─── HEADER ───
    // Logo box
    var logoSize = 12;
    var logoX = margin;
    doc.setFillColor(29, 29, 31);
    doc.roundedRect(logoX, y, logoSize, logoSize, 2, 2, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(255, 255, 255);
    doc.text('iS', logoX + logoSize / 2, y + logoSize / 2 + 1.5, { align: 'center' });

    // Shop name
    doc.setTextColor(29, 29, 31);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(22);
    doc.text('iStorage', logoX + logoSize + 4, y + logoSize / 2 + 1.5);

    // Right side: date info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(110, 110, 115);
    doc.text('Daily Inventory Report', pageWidth - margin, y + 4, { align: 'right' });
    doc.text(formatDateFull(reportDate), pageWidth - margin, y + 9, { align: 'right' });

    y += logoSize + 6;

    // Separator
    doc.setDrawColor(29, 29, 31);
    doc.setLineWidth(0.4);
    doc.line(margin, y, pageWidth - margin, y);
    y += 3;

    // Prepared by
    doc.setFontSize(8);
    doc.setTextColor(140, 140, 145);
    doc.text('Prepared by: Accounts Manager', margin, y + 3);
    var now = new Date();
    var timeStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
    doc.text('Generated at: ' + timeStr, pageWidth - margin, y + 3, { align: 'right' });
    y += 8;

    // ─── EXECUTIVE SUMMARY BOX ───
    doc.setFillColor(245, 245, 247);
    doc.setDrawColor(200, 200, 205);
    doc.setLineWidth(0.2);
    var boxY = y;
    var boxHeight = 28;
    doc.roundedRect(margin, boxY, contentWidth, boxHeight, 3, 3, 'FD');

    // Box title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(29, 29, 31);
    doc.text('Executive Summary', margin + 5, boxY + 6);

    // Summary items in a 3x2 grid
    var gridStartY = boxY + 12;
    var colWidth = contentWidth / 3;
    var summaryItems = [
      { label: 'Total Stock', value: counts.total.toString() },
      { label: 'Desk Stock', value: counts.desk.toString() },
      { label: 'Service', value: counts.service.toString() },
      { label: 'Outside', value: counts.outside.toString() },
      { label: 'Sold Today', value: summary.soldOut.toString() },
      { label: 'New In', value: summary.newIn.toString() },
    ];

    summaryItems.forEach(function (item, i) {
      var col = i % 3;
      var row = Math.floor(i / 3);
      var x = margin + 5 + col * colWidth;
      var iy = gridStartY + row * 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(110, 110, 115);
      doc.text(item.label, x, iy);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(29, 29, 31);
      doc.text(item.value, x, iy + 5);
    });

    y = boxY + boxHeight + 8;

    // ─── STOCK MOVEMENT TIMELINE ───
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(29, 29, 31);
    doc.text('Stock Movement Timeline', margin, y);
    y += 3;
    doc.setDrawColor(200, 200, 205);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    var dayMovements = getDailyMovements(reportDate);
    if (dayMovements.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(170, 170, 175);
      doc.text('No activity recorded for this date', margin, y);
      y += 8;
    } else {
      dayMovements.forEach(function (m) {
        checkPageBreak(8);

        // Time
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(110, 110, 115);
        doc.text(formatTime12(m.createdAt), margin, y);

        // Dot
        doc.setFillColor(29, 29, 31);
        doc.circle(margin + 38, y - 1.2, 1.2, 'F');

        // Activity text
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(29, 29, 31);
        doc.text(MOVEMENT_LABELS[m.type] + ' (' + m.model + ' × ' + m.quantity + ')', margin + 42, y);

        y += 5.5;
      });
      y += 3;
    }

    // ─── MODEL WISE INVENTORY TABLE ───
    checkPageBreak(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(29, 29, 31);
    doc.text('Model Wise Inventory', margin, y);
    y += 3;
    doc.setDrawColor(200, 200, 205);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    if (modelInv.length === 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(170, 170, 175);
      doc.text('No stock records found.', margin, y);
      y += 8;
    } else {
      // Table header
      var colX = [margin, margin + 62, margin + 82, margin + 105, margin + 130];
      var headers = ['Model', 'Desk', 'Service', 'Outside', 'Total'];

      doc.setFillColor(245, 245, 247);
      doc.rect(margin, y - 3.5, contentWidth, 7, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(110, 110, 115);
      headers.forEach(function (h, i) {
        var align = i === 0 ? 'left' : 'center';
        doc.text(h, colX[i], y, { align: align });
      });
      y += 3;
      doc.setDrawColor(200, 200, 205);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;

      // Table rows
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      modelInv.forEach(function (item) {
        checkPageBreak(6);
        doc.setTextColor(29, 29, 31);
        doc.text(item.model, colX[0], y);
        doc.text(item.desk.toString(), colX[1], y, { align: 'center' });
        doc.text(item.service.toString(), colX[2], y, { align: 'center' });
        doc.text(item.outside.toString(), colX[3], y, { align: 'center' });
        doc.setFont('helvetica', 'bold');
        doc.text(item.total.toString(), colX[4], y, { align: 'center' });
        doc.setFont('helvetica', 'normal');
        y += 5;
      });

      // Grand Total
      doc.setDrawColor(29, 29, 31);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 4;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(29, 29, 31);
      doc.text('Grand Total', colX[0], y);
      doc.text(counts.desk.toString(), colX[1], y, { align: 'center' });
      doc.text(counts.service.toString(), colX[2], y, { align: 'center' });
      doc.text(counts.outside.toString(), colX[3], y, { align: 'center' });
      doc.text(counts.total.toString(), colX[4], y, { align: 'center' });
      y += 10;
    }

    // ─── DAILY SUMMARY ───
    checkPageBreak(35);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(29, 29, 31);
    doc.text('Daily Summary', margin, y);
    y += 3;
    doc.setDrawColor(200, 200, 205);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;

    // Summary box
    var dsBoxY = y;
    doc.setFillColor(245, 245, 247);
    doc.roundedRect(margin, dsBoxY, contentWidth, 30, 3, 3, 'FD');

    var dsItems = [
      { label: 'Opening Stock', value: openingStock.total.toString(), bold: false },
      { label: 'Total Incoming', value: '+' + totalIncoming.toString(), bold: false },
      { label: 'Total Outgoing', value: '-' + totalOutgoing.toString(), bold: false },
      { label: 'Closing Stock', value: closingStock.toString(), bold: true },
    ];

    dsItems.forEach(function (item, i) {
      var iy = dsBoxY + 6 + i * 6;
      doc.setFont('helvetica', item.bold ? 'bold' : 'normal');
      doc.setFontSize(10);
      doc.setTextColor(item.bold ? 29 : 110, item.bold ? 29 : 110, item.bold ? 31 : 115);
      doc.text(item.label, margin + 8, iy);
      doc.text(item.value, pageWidth - margin - 8, iy, { align: 'right' });
    });

    // Line under closing
    doc.setDrawColor(29, 29, 31);
    doc.setLineWidth(0.3);
    doc.line(margin + 5, dsBoxY + 25, pageWidth - margin - 5, dsBoxY + 25);

    y = dsBoxY + 35;

    // ─── FOOTER ───
    // Page numbers
    var totalPages = doc.internal.getNumberOfPages();
    for (var i = 1; i <= totalPages; i++) {
      doc.setPage(i);

      // Footer line
      doc.setDrawColor(200, 200, 205);
      doc.setLineWidth(0.2);
      doc.line(margin, pageHeight - 15, pageWidth - margin, pageHeight - 15);

      // Footer text
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(170, 170, 175);
      doc.text('Generated Automatically — iStorage Inventory System', margin, pageHeight - 10);
      doc.text('Page ' + i + ' of ' + totalPages, pageWidth - margin, pageHeight - 10, { align: 'right' });
    }

    doc.save('iStorage_Report_' + reportDate + '.pdf');
    showToast('PDF report downloaded successfully');
  }

  // ── Movement Type Switching ────────────────────────────────
  function setMovementType(type) {
    document.getElementById('movementType').value = type;
    document.getElementById('movementFormTitle').textContent = MOVEMENT_LABELS[type];
    document.getElementById('movementFormSubtitle').textContent = MOVEMENT_DESCRIPTIONS[type];
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.classList.toggle('active', tab.dataset.type === type);
    });

    // Update the filtered datalist for this movement type
    refreshFilteredDatalist();

    // Update placeholder text based on movement type
    var modelInput = document.getElementById('movementModel');
    if (type === 'new_stock_in') {
      modelInput.placeholder = 'e.g. iPhone 14 Pro Max';
    } else if (type === 'service_completed') {
      modelInput.placeholder = 'Select model in Service...';
    } else if (type === 'returned_outside') {
      modelInput.placeholder = 'Select model Outside...';
    } else {
      modelInput.placeholder = 'Select model from Desk...';
    }
    modelInput.value = '';
  }

  // ── Filtered Datalist Refresh ──────────────────────────────
  // Only shows models that have stock in the required source location
  function refreshFilteredDatalist() {
    var currentType = document.getElementById('movementType').value;
    var models = getFilteredModelsForMovement(currentType);
    var datalist = document.getElementById('modelSuggestions');
    datalist.innerHTML = '';

    models.forEach(function (model) {
      var opt = document.createElement('option');
      opt.value = model;
      datalist.appendChild(opt);
    });

    // Update hint text
    var hintEl = document.getElementById('movementModelHint');
    if (hintEl) {
      if (models.length === 0 && currentType !== 'new_stock_in') {
        hintEl.textContent = 'No models available for this action';
        hintEl.style.display = '';
      } else {
        hintEl.style.display = 'none';
      }
    }
  }

  // ── Initialize ─────────────────────────────────────────────
  function init() {
    var todayStr = today();
    document.getElementById('movementDate').value = todayStr;
    document.getElementById('reportDate').value = todayStr;
    document.getElementById('dateDisplay').textContent = formatDateFull(todayStr);

    // ── Navigation ──
    document.querySelectorAll('.nav-link').forEach(function (link) {
      link.addEventListener('click', function () { navigateTo(this.dataset.section); });
    });
    document.querySelectorAll('.bottom-nav-item').forEach(function (item) {
      item.addEventListener('click', function () { navigateTo(this.dataset.section); });
    });

    // ── Mobile Menu ──
    document.getElementById('menuToggle').addEventListener('click', function () {
      document.getElementById('sidebar').classList.toggle('open');
      document.getElementById('sidebarOverlay').classList.toggle('active');
    });
    document.getElementById('sidebarOverlay').addEventListener('click', function () {
      document.getElementById('sidebar').classList.remove('open');
      this.classList.remove('active');
    });

    // ── Modal Close ──
    document.getElementById('modalClose').addEventListener('click', hideModal);
    document.getElementById('modalOverlay').addEventListener('click', function (e) {
      if (e.target === this) hideModal();
    });

    // ── Movement Tabs ──
    document.querySelectorAll('.tab').forEach(function (tab) {
      tab.addEventListener('click', function () { setMovementType(this.dataset.type); });
    });

    // ── Movement Form Submit ──
    document.getElementById('movementForm').addEventListener('submit', function (e) {
      e.preventDefault();

      var type = document.getElementById('movementType').value;
      var date = document.getElementById('movementDate').value;
      var model = document.getElementById('movementModel').value.trim();
      var qty = parseInt(document.getElementById('movementQty').value, 10);
      var notes = document.getElementById('movementNotes').value;

      if (!date || !model || !qty) {
        showToast('Please fill in all required fields', 'error');
        return;
      }
      if (qty < 1) {
        showToast('Quantity must be at least 1', 'error');
        return;
      }

      // Apply movement to persistent inventory
      var result = applyMovement(type, model, qty);
      if (!result.success) {
        showToast(result.message, 'error');
        return;
      }

      // Record in movement log
      recordMovement(type, date, model, qty, notes);
      showToast(MOVEMENT_LABELS[type] + ' recorded — ' + qty + 'x ' + model);

      // Reset form fields
      document.getElementById('movementModel').value = '';
      document.getElementById('movementQty').value = '1';
      document.getElementById('movementNotes').value = '';

      // Refresh everywhere
      refreshFilteredDatalist();
      renderMovementLog();
      renderDashboard();
    });

    // ── Movement Reset ──
    document.getElementById('movementResetBtn').addEventListener('click', function () {
      document.getElementById('movementModel').value = '';
      document.getElementById('movementQty').value = '1';
      document.getElementById('movementNotes').value = '';
    });

    // ── Movement Log Delete (delegation) ──
    document.getElementById('movementLog').addEventListener('click', function (e) {
      var btn = e.target.closest('.movement-log-delete');
      if (!btn) return;

      var id = btn.dataset.id;
      var movements = getMovements();
      var movement = null;
      for (var i = 0; i < movements.length; i++) {
        if (movements[i].id === id) { movement = movements[i]; break; }
      }
      if (!movement) return;

      // Show confirmation modal
      var body =
        '<p style="margin-bottom:8px;">This will reverse the following movement from inventory:</p>' +
        '<div style="background:var(--bg-base);padding:12px;border-radius:8px;font-size:13px;">' +
        '<strong>' + MOVEMENT_LABELS[movement.type] + '</strong> — ' +
        escapeHtml(movement.model) + ' x ' + movement.quantity +
        '</div>' +
        '<div class="modal-warning" style="margin-top:12px;">Stock quantities will be adjusted accordingly.</div>';

      var footer =
        '<button class="btn btn-ghost" onclick="document.getElementById(\'modalOverlay\').classList.remove(\'active\')">Cancel</button>' +
        '<button class="btn btn-primary" id="confirmDeleteMovement">Delete</button>';

      showModal('Delete Movement', body, footer);

      document.getElementById('confirmDeleteMovement').addEventListener('click', function () {
        var rev = reverseMovement(movement.type, movement.model, movement.quantity);
        if (!rev.success) {
          showToast(rev.message, 'error');
        } else {
          deleteMovementRecord(id);
          showToast('Movement deleted and stock adjusted');
          renderMovementLog();
          renderDashboard();
          refreshFilteredDatalist();
        }
        hideModal();
      });
    });

    // ── Inventory Search & Filter ──
    document.getElementById('searchInput').addEventListener('input', renderInventoryTable);
    document.getElementById('filterLocation').addEventListener('change', renderInventoryTable);

    // ── Add New Model Button ──
    document.getElementById('addModelBtn').addEventListener('click', function () {
      var body =
        '<div class="modal-form">' +
        '<div class="form-group">' +
        '<label class="form-label">Model Name</label>' +
        '<input type="text" class="form-input" id="newModelName" placeholder="e.g. iPhone 15 Pro Max" autofocus>' +
        '</div>' +
        '</div>';

      var footer =
        '<button class="btn btn-ghost" onclick="document.getElementById(\'modalOverlay\').classList.remove(\'active\')">Cancel</button>' +
        '<button class="btn btn-primary" id="confirmAddModel">Add Model</button>';

      showModal('Add New Model', body, footer);

      // Focus the input
      setTimeout(function () {
        var inp = document.getElementById('newModelName');
        if (inp) inp.focus();
      }, 100);

      // Enter key to submit
      document.getElementById('newModelName').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById('confirmAddModel').click();
        }
      });

      document.getElementById('confirmAddModel').addEventListener('click', function () {
        var name = (document.getElementById('newModelName').value || '').trim();
        if (!name) {
          showToast('Please enter a model name', 'error');
          return;
        }
        var res = addInventoryModel(name);
        if (!res.success) {
          showToast(res.message, 'error');
          return;
        }
        hideModal();
        showToast('Model "' + name + '" added successfully');
        refreshFilteredDatalist();
        renderInventoryTable();
      });
    });

    // ── Inventory Table Actions (delegation) ──
    document.getElementById('inventoryBody').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-action]');
      if (!btn) return;

      var action = btn.dataset.action;
      var id = btn.dataset.id;

      if (action === 'edit') {
        openEditModal(id);
      } else if (action === 'delete') {
        openDeleteModal(id, btn.dataset.model);
      }
    });

    // ── Report Controls ──
    document.getElementById('reportDate').addEventListener('change', renderReportPreview);
    document.getElementById('generatePdfBtn').addEventListener('click', generatePDF);
    document.getElementById('printReportBtn').addEventListener('click', function () {
      window.print();
    });

    // Initial renders
    refreshFilteredDatalist();
    renderDashboard();
    renderReportPreview();
  }

  // ── Edit Model Modal ───────────────────────────────────────
  function openEditModal(id) {
    var inventory = getInventory();
    var item = null;
    for (var i = 0; i < inventory.length; i++) {
      if (inventory[i].id === id) { item = inventory[i]; break; }
    }
    if (!item) return;

    var body =
      '<div class="modal-form">' +
      '<div class="form-group">' +
      '<label class="form-label">Model</label>' +
      '<input type="text" class="form-input" value="' + escapeHtml(item.model) + '" disabled style="opacity:0.6;cursor:not-allowed">' +
      '</div>' +
      '<div class="form-group">' +
      '<label class="form-label">Quantities by Location</label>' +
      '<div class="qty-grid">' +
      '<div class="qty-group">' +
      '<span class="qty-label">Desk</span>' +
      '<input type="number" class="form-input" id="editDesk" min="0" value="' + item.desk + '">' +
      '</div>' +
      '<div class="qty-group">' +
      '<span class="qty-label">Service</span>' +
      '<input type="number" class="form-input" id="editService" min="0" value="' + item.service + '">' +
      '</div>' +
      '<div class="qty-group">' +
      '<span class="qty-label">Outside</span>' +
      '<input type="number" class="form-input" id="editOutside" min="0" value="' + item.outside + '">' +
      '</div>' +
      '</div>' +
      '</div>' +
      '<div style="font-size:12px;color:var(--text-tertiary);margin-top:4px;">Total: <strong id="editTotalPreview">' + (item.desk + item.service + item.outside) + '</strong></div>' +
      '</div>';

    var footer =
      '<button class="btn btn-ghost" onclick="document.getElementById(\'modalOverlay\').classList.remove(\'active\')">Cancel</button>' +
      '<button class="btn btn-primary" id="confirmEditModel">Save Changes</button>';

    showModal('Edit — ' + item.model, body, footer);

    // Live total preview
    function updateEditTotal() {
      var d = parseInt(document.getElementById('editDesk').value, 10) || 0;
      var s = parseInt(document.getElementById('editService').value, 10) || 0;
      var o = parseInt(document.getElementById('editOutside').value, 10) || 0;
      document.getElementById('editTotalPreview').textContent = d + s + o;
    }
    document.getElementById('editDesk').addEventListener('input', updateEditTotal);
    document.getElementById('editService').addEventListener('input', updateEditTotal);
    document.getElementById('editOutside').addEventListener('input', updateEditTotal);

    document.getElementById('confirmEditModel').addEventListener('click', function () {
      var d = document.getElementById('editDesk').value;
      var s = document.getElementById('editService').value;
      var o = document.getElementById('editOutside').value;
      updateInventoryQuantity(id, d, s, o);
      hideModal();
      showToast('Stock quantities updated for ' + item.model);
      renderInventoryTable();
      renderDashboard();
      renderReportPreview();
      refreshFilteredDatalist();
    });
  }

  // ── Delete Model Modal ─────────────────────────────────────
  function openDeleteModal(id, modelName) {
    var item = null;
    var inventory = getInventory();
    for (var i = 0; i < inventory.length; i++) {
      if (inventory[i].id === id) { item = inventory[i]; break; }
    }
    if (!item) return;

    var total = item.desk + item.service + item.outside;
    var warningHtml = '';
    if (total > 0) {
      warningHtml = '<div class="modal-warning">This model has ' + total + ' units in stock. Deleting will remove all records.</div>';
    }

    var body =
      '<p>Are you sure you want to delete <strong>' + escapeHtml(item.model) + '</strong> from inventory?</p>' +
      warningHtml;

    var footer =
      '<button class="btn btn-ghost" onclick="document.getElementById(\'modalOverlay\').classList.remove(\'active\')">Cancel</button>' +
      '<button class="btn btn-primary" style="background:#c62828;" id="confirmDeleteModel">Delete Model</button>';

    showModal('Delete Model', body, footer);

    document.getElementById('confirmDeleteModel').addEventListener('click', function () {
      deleteInventoryModel(id);
      hideModal();
      showToast('Model "' + item.model + '" deleted');
      refreshFilteredDatalist();
      renderInventoryTable();
      renderDashboard();
      renderReportPreview();
    });
  }

  // ── Start ──────────────────────────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
