const STORES = ['Aldi', 'REWE', 'Edeka', 'HIT', 'Sonstige'];

// Datenmodell
let recipes = JSON.parse(localStorage.getItem('kochplan_recipes')) || [];
let planMap = JSON.parse(localStorage.getItem('kochplan_map')) || {};
let checkedItems = JSON.parse(localStorage.getItem('kochplan_checked')) || [];
let deletedItems = JSON.parse(localStorage.getItem('kochplan_deleted')) || []; // NEU: Gelöschte/Ausgeblendete Elemente
let storeAssignments = JSON.parse(localStorage.getItem('kochplan_store_assignments')) || {};
let customShoppingItems = JSON.parse(localStorage.getItem('kochplan_custom_items')) || [];

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupRecipeForm();
  setupShoppingEvents();
  
  renderRecipes();
  renderPlan();
  renderShoppingList();
});

function saveData() {
  localStorage.setItem('kochplan_recipes', JSON.stringify(recipes));
  localStorage.setItem('kochplan_map', JSON.stringify(planMap));
  localStorage.setItem('kochplan_checked', JSON.stringify(checkedItems));
  localStorage.setItem('kochplan_deleted', JSON.stringify(deletedItems));
  localStorage.setItem('kochplan_store_assignments', JSON.stringify(storeAssignments));
  localStorage.setItem('kochplan_custom_items', JSON.stringify(customShoppingItems));
}

// 1. Navigation
function setupNavigation() {
  const navBtns = document.querySelectorAll('.nav-btn');
  const tabs = document.querySelectorAll('.tab-content');

  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      navBtns.forEach(b => b.classList.remove('active'));
      tabs.forEach(t => t.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');

      if (btn.dataset.tab === 'shopping') {
        renderShoppingList();
      }
    });
  });
}

// 2. Gerichte-Verwaltung (Anlegen & Bearbeiten)
function setupRecipeForm() {
  const form = document.getElementById('recipe-form');
  const cancelBtn = document.getElementById('recipe-cancel-btn');

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const recipeId = document.getElementById('recipe-id').value;
    const nameInput = document.getElementById('recipe-name').value.trim();
    const ingredientsInput = document.getElementById('recipe-ingredients').value;

    const rawIngredients = ingredientsInput
      .split('\n')
      .map(i => i.trim())
      .filter(i => i.length > 0);

    if (recipeId) {
      // Bearbeiten
      const idx = recipes.findIndex(r => r.id === recipeId);
      if (idx > -1) {
        recipes[idx].name = nameInput;
        recipes[idx].ingredients = rawIngredients;
      }
    } else {
      // Neu anlegen
      recipes.push({
        id: Date.now().toString(),
        name: nameInput,
        ingredients: rawIngredients
      });
    }

    saveData();
    resetRecipeForm();
    renderRecipes();
    renderPlan();
  });

  cancelBtn.addEventListener('click', resetRecipeForm);
}

function resetRecipeForm() {
  document.getElementById('recipe-id').value = '';
  document.getElementById('recipe-name').value = '';
  document.getElementById('recipe-ingredients').value = '';
  document.getElementById('recipe-form-title').innerText = 'Neues Gericht hinzufügen';
  document.getElementById('recipe-submit-btn').innerText = 'Gericht speichern';
  document.getElementById('recipe-cancel-btn').classList.add('hidden');
}

function renderRecipes() {
  const container = document.getElementById('recipes-list');
  container.innerHTML = '';

  if (recipes.length === 0) {
    container.innerHTML = '<p class="subtitle">Noch keine Gerichte angelegt.</p>';
    return;
  }

  recipes.forEach(recipe => {
    const item = document.createElement('div');
    item.className = 'list-item';
    item.innerHTML = `
      <div>
        <strong>${escapeHtml(recipe.name)}</strong>
        <div style="font-size:0.8rem; color:#666;">${recipe.ingredients.length} Zutat(en)</div>
      </div>
      <div>
        <button class="action-btn edit-btn" onclick="editRecipe('${recipe.id}')" title="Bearbeiten">✏️</button>
        <button class="action-btn delete-btn" onclick="deleteRecipe('${recipe.id}')" title="Löschen">&times;</button>
      </div>
    `;
    container.appendChild(item);
  });
}

window.editRecipe = function(id) {
  const recipe = recipes.find(r => r.id === id);
  if (!recipe) return;

  document.getElementById('recipe-id').value = recipe.id;
  document.getElementById('recipe-name').value = recipe.name;
  document.getElementById('recipe-ingredients').value = recipe.ingredients.join('\n');

  document.getElementById('recipe-form-title').innerText = 'Gericht bearbeiten';
  document.getElementById('recipe-submit-btn').innerText = 'Änderungen speichern';
  document.getElementById('recipe-cancel-btn').classList.remove('hidden');

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteRecipe = function(id) {
  recipes = recipes.filter(r => r.id !== id);
  Object.keys(planMap).forEach(dateStr => {
    planMap[dateStr] = planMap[dateStr].filter(mId => mId !== id);
  });
  saveData();
  renderRecipes();
  renderPlan();
};

// 3. 14-Tage-Planer
function getNext14Days() {
  const days = [];
  const today = new Date();
  
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    
    const dateKey = d.toISOString().split('T')[0];
    const options = { weekday: 'short', day: '2-digit', month: 'short' };
    let formattedDate = d.toLocaleDateString('de-DE', options);
    if (i === 0) formattedDate = `Heute (${formattedDate})`;
    if (i === 1) formattedDate = `Morgen (${formattedDate})`;

    days.push({ dateKey, formattedDate });
  }
  return days;
}

function renderPlan() {
  const container = document.getElementById('days-container');
  container.innerHTML = '';

  const days = getNext14Days();

  days.forEach(dayInfo => {
    const mealIds = planMap[dayInfo.dateKey] || [];
    const card = document.createElement('div');
    card.className = 'day-card';

    let mealsHtml = '';
    mealIds.forEach(mealId => {
      const recipe = recipes.find(r => r.id === mealId);
      if (recipe) {
        mealsHtml += `
          <div class="meal-chip">
            ${escapeHtml(recipe.name)}
            <span onclick="removeMealFromDay('${dayInfo.dateKey}', '${recipe.id}')">&times;</span>
          </div>
        `;
      }
    });

    let selectOptions = '<option value="">+ Gericht wählen...</option>';
    recipes.forEach(r => {
      selectOptions += `<option value="${r.id}">${escapeHtml(r.name)}</option>`;
    });

    card.innerHTML = `
      <div class="day-title">${dayInfo.formattedDate}</div>
      <div class="day-meals">${mealsHtml || '<span style="font-size:0.85rem; color:#888;">Kein Gericht geplant</span>'}</div>
      <select onchange="addMealToDay('${dayInfo.dateKey}', this.value)">
        ${selectOptions}
      </select>
    `;
    container.appendChild(card);
  });
}

window.addMealToDay = function(dateKey, recipeId) {
  if (!recipeId) return;
  if (!planMap[dateKey]) planMap[dateKey] = [];
  planMap[dateKey].push(recipeId);
  
  // Wenn ein neues Gericht hinzugefügt wird, die gelöschten Elemente zurücksetzen
  // damit neu geplante Zutaten wieder erscheinen
  deletedItems = [];
  
  saveData();
  renderPlan();
};

window.removeMealFromDay = function(dateKey, recipeId) {
  if (!planMap[dateKey]) return;
  const idx = planMap[dateKey].indexOf(recipeId);
  if (idx > -1) {
    planMap[dateKey].splice(idx, 1);
  }
  saveData();
  renderPlan();
};

// 4. Intelligente Einkaufsliste (Mengenberechnung, Extra-Artikel & Löschen)

function parseIngredient(str) {
  const trimmed = str.trim();
  const regex = /^([\d\,\.]+)\s*([a-zA-ZäöüÄÖÜß]*)\s+(.+)$/;
  const match = trimmed.match(regex);

  if (match) {
    const amount = parseFloat(match[1].replace(',', '.'));
    const unit = match[2].trim().toLowerCase();
    const name = match[3].trim().toLowerCase();
    if (!isNaN(amount)) {
      return { amount, unit, name, rawName: match[3].trim() };
    }
  }

  return { amount: null, unit: '', name: trimmed.toLowerCase(), rawName: trimmed };
}

function setupShoppingEvents() {
  // Abgehakte löschen Button
  document.getElementById('clear-checked-btn').addEventListener('click', () => {
    // 1. Alle abgehakten Einträge zu den dauerhaft gelöschten/ausgeblendeten hinzufügen
    checkedItems.forEach(item => {
      if (!deletedItems.includes(item)) {
        deletedItems.push(item);
      }
    });

    // 2. Extra-Gewürze/Zutaten aus der Custom-Liste entfernen
    customShoppingItems = customShoppingItems.filter(item => !checkedItems.includes(item));

    // 3. Abhakspeicher leeren
    checkedItems = [];

    saveData();
    renderShoppingList();
  });

  // Schnell-Hinzufügen (Gewürze etc.)
  document.getElementById('quick-add-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('quick-add-input');
    const val = input.value.trim();
    if (val) {
      customShoppingItems.push(val);
      saveData();
      renderShoppingList();
      input.value = '';
    }
  });
}

function renderShoppingList() {
  const container = document.getElementById('shopping-by-store');
  container.innerHTML = '';

  const days = getNext14Days();
  const activeDateKeys = days.map(d => d.dateKey);

  const rawIngredients = [];

  // 1. Zutaten aus den nächsten 14 Tagen sammeln
  activeDateKeys.forEach(dateKey => {
    const mealIds = planMap[dateKey] || [];
    mealIds.forEach(mealId => {
      const recipe = recipes.find(r => r.id === mealId);
      if (recipe) {
        recipe.ingredients.forEach(ing => rawIngredients.push(ing));
      }
    });
  });

  // 2. Extra Artikel (Gewürze etc.) hinzufügen
  customShoppingItems.forEach(item => rawIngredients.push(item));

  // 3. Mengenkonsolidierung (Gleiche Zutat + gleiche Einheit zusammenrechnen)
  const consolidated = {};

  rawIngredients.forEach(rawStr => {
    const parsed = parseIngredient(rawStr);
    const key = `${parsed.name}__${parsed.unit}`;

    if (!consolidated[key]) {
      consolidated[key] = {
        name: parsed.name,
        rawName: parsed.rawName,
        unit: parsed.unit,
        amount: parsed.amount
      };
    } else {
      if (parsed.amount !== null && consolidated[key].amount !== null) {
        consolidated[key].amount += parsed.amount;
      }
    }
  });

  // Display-Strings erstellen
  let formattedItems = Object.values(consolidated).map(item => {
    if (item.amount !== null) {
      const formattedAmount = Number.isInteger(item.amount) ? item.amount : item.amount.toFixed(1).replace('.', ',');
      const unitStr = item.unit ? `${item.unit} ` : '';
      return `${formattedAmount} ${unitStr}${item.rawName}`;
    }
    return item.rawName;
  });

  // 4. WICHTIG: Bereits gelöschte Zutaten herausfiltern!
  formattedItems = formattedItems.filter(itemStr => !deletedItems.includes(itemStr));

  if (formattedItems.length === 0) {
    container.innerHTML = '<p class="subtitle">Keine Zutaten auf der Einkaufsliste.</p>';
    return;
  }

  // 5. Nach Supermarkt gruppieren
  const storeGroups = {};
  STORES.forEach(s => storeGroups[s] = []);

  formattedItems.forEach(itemStr => {
    const store = storeAssignments[itemStr] || 'Sonstige';
    if (!storeGroups[store]) storeGroups[store] = [];
    storeGroups[store].push(itemStr);
  });

  STORES.forEach(store => {
    const list = storeGroups[store] || [];
    if (list.length > 0) {
      const groupDiv = document.createElement('div');
      groupDiv.className = 'store-group';

      let itemsHtml = '';
      list.forEach(itemStr => {
        const isChecked = checkedItems.includes(itemStr);

        let storeOptionsHtml = STORES.map(s => 
          `<option value="${s}" ${s === store ? 'selected' : ''}>${s}</option>`
        ).join('');

        itemsHtml += `
          <li class="shopping-item ${isChecked ? 'checked' : ''}">
            <div class="shopping-left">
              <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="toggleCheck('${escapeHtml(itemStr)}')">
              <span>${escapeHtml(itemStr)}</span>
            </div>
            <select class="store-select-inline" onchange="changeIngredientStore('${escapeHtml(itemStr)}', this.value)">
              ${storeOptionsHtml}
            </select>
          </li>
        `;
      });

      groupDiv.innerHTML = `
        <div class="store-title">${store} (${list.length})</div>
        <ul class="shopping-ul">${itemsHtml}</ul>
      `;
      container.appendChild(groupDiv);
    }
  });
}

window.changeIngredientStore = function(itemStr, newStore) {
  storeAssignments[itemStr] = newStore;
  saveData();
  renderShoppingList();
};

window.toggleCheck = function(itemStr) {
  const index = checkedItems.indexOf(itemStr);
  if (index > -1) {
    checkedItems.splice(index, 1);
  } else {
    checkedItems.push(itemStr);
  }
  saveData();
  renderShoppingList();
};

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, function(m) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}