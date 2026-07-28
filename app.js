const firebaseConfig = {
  apiKey: "AIzaSyAk62DFEE6PTiTlUD7XU5Q0B3bb4OI_92k",
  authDomain: "kochplan-65d85.firebaseapp.com",
  projectId: "kochplan-65d85",
  storageBucket: "kochplan-65d85.firebasestorage.app",
  messagingSenderId: "461548419472",
  appId: "1:461548419472:web:69bdc92272857318c99b15"

};


// Firebase & Cloud Firestore initialisieren
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Globale Variablen für den Zustand
let recipes = [];
let shoppingList = [];
let currentRecipeImageBase64 = "";
let selectedStoreFilter = "ALLE"; // Filter für den Einkaufszettel

// ==========================================
// 1. INITIALISIERUNG & ECHTZEIT-LISTEN (FIRESTORE)
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  setupImageUpload();
  setupRecipeForm();
  setupSearchAndFilter();

  // 🔄 Live-Stream für Rezepte aus Firebase
  db.collection('recipes').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    recipes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderRecipes();
  }, error => {
    console.error("Fehler beim Laden der Rezepte:", error);
  });

  // 🔄 Live-Stream für die Einkaufsliste aus Firebase
  db.collection('shoppingList').orderBy('createdAt', 'desc').onSnapshot(snapshot => {
    shoppingList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    renderShoppingList();
    renderStoreFilterButtons();
  }, error => {
    console.error("Fehler beim Laden der Einkaufsliste:", error);
  });
});

// Navigation / Tab-Wechsel (z. B. zwischen Rezepten & Einkaufszettel)
window.switchTab = function(tabName) {
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.view-content').forEach(view => view.classList.add('hidden'));

  const activeView = document.getElementById(`view-${tabName}`);
  if (activeView) activeView.classList.remove('hidden');

  if (event && event.target && event.target.classList.contains('nav-btn')) {
    event.target.classList.add('active');
  }
};

// ==========================================
// 2. REZEPT-BILD UPLOAD (VORSCHAU & BASE64)
// ==========================================
function setupImageUpload() {
  const fileInput = document.getElementById('recipe-image');
  const preview = document.getElementById('recipe-image-preview');
  const previewContainer = document.getElementById('image-preview-container');

  if (!fileInput) return;

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = function(evt) {
        currentRecipeImageBase64 = evt.target.result;
        if (preview) preview.src = currentRecipeImageBase64;
        if (previewContainer) previewContainer.classList.remove('hidden');
      };
      reader.readAsDataURL(file);
    }
  });
}

// ==========================================
// 3. REZEPTE SPEICHERN, EDITIEREN & LÖSCHEN
// ==========================================
function setupRecipeForm() {
  const form = document.getElementById('recipe-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const recipeId = document.getElementById('recipe-id') ? document.getElementById('recipe-id').value : '';
    const title = document.getElementById('recipe-title').value.trim();
    const category = document.getElementById('recipe-category') ? document.getElementById('recipe-category').value : 'Hauptspeise';
    const prepTime = parseInt(document.getElementById('recipe-time') ? document.getElementById('recipe-time').value : 0) || 0;
    const servings = parseInt(document.getElementById('recipe-servings') ? document.getElementById('recipe-servings').value : 1) || 1;
    const ingredients = document.getElementById('recipe-ingredients').value.trim();
    const instructions = document.getElementById('recipe-instructions').value.trim();

    if (!title || !ingredients || !instructions) {
      alert('Bitte fülle mindestens Titel, Zutaten und Zubereitung aus.');
      return;
    }

    const recipeData = {
      title,
      category,
      prepTime,
      servings,
      ingredients,
      instructions,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (currentRecipeImageBase64) {
      recipeData.image = currentRecipeImageBase64;
    }

    try {
      if (recipeId && recipeId !== "") {
        await db.collection('recipes').doc(recipeId).update(recipeData);
      } else {
        recipeData.createdAt = firebase.firestore.FieldValue.serverTimestamp();
        await db.collection('recipes').add(recipeData);
      }
      resetRecipeForm();
    } catch (error) {
      console.error("Fehler beim Speichern in Firebase:", error);
      alert("Fehler beim Speichern des Rezepts!");
    }
  });
}

window.resetRecipeForm = function() {
  const form = document.getElementById('recipe-form');
  if (form) form.reset();

  if (document.getElementById('recipe-id')) document.getElementById('recipe-id').value = '';
  if (document.getElementById('recipe-image-preview')) document.getElementById('recipe-image-preview').src = '';
  if (document.getElementById('image-preview-container')) document.getElementById('image-preview-container').classList.add('hidden');
  
  const submitBtn = document.getElementById('recipe-submit-btn');
  if (submitBtn) submitBtn.innerText = 'Rezept speichern';
  
  const formTitle = document.getElementById('recipe-form-title');
  if (formTitle) formTitle.innerText = 'Neues Rezept anlegen';

  currentRecipeImageBase64 = "";
};

window.editRecipe = function(id) {
  const recipe = recipes.find(r => String(r.id) === String(id));
  if (!recipe) return;

  if (document.getElementById('recipe-id')) document.getElementById('recipe-id').value = recipe.id;
  if (document.getElementById('recipe-title')) document.getElementById('recipe-title').value = recipe.title;
  if (document.getElementById('recipe-category')) document.getElementById('recipe-category').value = recipe.category;
  if (document.getElementById('recipe-time')) document.getElementById('recipe-time').value = recipe.prepTime || '';
  if (document.getElementById('recipe-servings')) document.getElementById('recipe-servings').value = recipe.servings || 1;
  if (document.getElementById('recipe-ingredients')) document.getElementById('recipe-ingredients').value = recipe.ingredients;
  if (document.getElementById('recipe-instructions')) document.getElementById('recipe-instructions').value = recipe.instructions;

  if (recipe.image) {
    currentRecipeImageBase64 = recipe.image;
    if (document.getElementById('recipe-image-preview')) document.getElementById('recipe-image-preview').src = recipe.image;
    if (document.getElementById('image-preview-container')) document.getElementById('image-preview-container').classList.remove('hidden');
  }

  const submitBtn = document.getElementById('recipe-submit-btn');
  if (submitBtn) submitBtn.innerText = 'Änderungen speichern';
  
  const formTitle = document.getElementById('recipe-form-title');
  if (formTitle) formTitle.innerText = 'Rezept bearbeiten';

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.deleteRecipe = async function(id) {
  if (confirm('Möchtest du dieses Rezept wirklich aus der Cloud löschen?')) {
    try {
      await db.collection('recipes').doc(id).delete();
    } catch (error) {
      console.error("Fehler beim Löschen:", error);
      alert("Fehler beim Löschen des Rezepts.");
    }
  }
};

// ==========================================
// 4. REZEPT-ANZEIGE & FILTER
// ==========================================
function setupSearchAndFilter() {
  const searchInput = document.getElementById('recipe-search');
  const categoryFilter = document.getElementById('recipe-filter-category');

  if (searchInput) searchInput.addEventListener('input', renderRecipes);
  if (categoryFilter) categoryFilter.addEventListener('change', renderRecipes);
}

window.renderRecipes = function() {
  const container = document.getElementById('recipe-list');
  if (!container) return;

  const searchVal = document.getElementById('recipe-search') ? document.getElementById('recipe-search').value.toLowerCase().trim() : '';
  const categoryVal = document.getElementById('recipe-filter-category') ? document.getElementById('recipe-filter-category').value : '';

  container.innerHTML = '';

  const filtered = recipes.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchVal) || r.ingredients.toLowerCase().includes(searchVal);
    const matchesCategory = categoryVal === '' || r.category === categoryVal;
    return matchesSearch && matchesCategory;
  });

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:#666; font-size:0.9rem; text-align:center;">Keine Rezepte gefunden.</p>';
    return;
  }

  filtered.forEach(recipe => {
    const card = document.createElement('div');
    card.className = 'recipe-card list-item';
    
    card.innerHTML = `
      <div class="item-header">
        <h3 style="margin:0;">${escapeHtml(recipe.title)}</h3>
        <span class="badge">${escapeHtml(recipe.category || 'Allgemein')}</span>
      </div>
      
      <div style="font-size:0.85rem; color:#666; margin: 6px 0;">
        ⏱️ ${recipe.prepTime || 0} Min. | 👥 ${recipe.servings || 1} Person(en)
      </div>

      ${recipe.image ? `<img src="${recipe.image}" class="img-preview" style="max-width:100%; max-height:220px; object-fit:cover; border-radius:8px; margin:8px 0;">` : ''}

      <div style="margin-top:10px;">
        <strong>Zutaten:</strong>
        <p style="white-space: pre-wrap; font-size:0.9rem; color:#333; margin:4px 0 10px 0;">${escapeHtml(recipe.ingredients)}</p>
      </div>

      <div>
        <strong>Zubereitung:</strong>
        <p style="white-space: pre-wrap; font-size:0.9rem; color:#333; margin:4px 0;">${escapeHtml(recipe.instructions)}</p>
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; border-top:1px solid #eee; padding-top:8px;">
        <button class="btn btn-small btn-secondary" onclick="addIngredientsToShoppingList('${recipe.id}')">🛒 Zutaten auf Einkaufszettel</button>
        <div>
          <button class="action-btn" onclick="editRecipe('${recipe.id}')" title="Bearbeiten">✏️</button>
          <button class="action-btn" onclick="deleteRecipe('${recipe.id}')" title="Löschen" style="color:red;">🗑️</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
};

// ==========================================
// 5. EINKAUFSZETTEL-LOGIK (Echtzeit + Supermärkte)
// ==========================================

// Artikel manuell hinzufügen (mit Laden-Zuordnung)
window.addShoppingItem = async function(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('shopping-input');
  const storeSelect = document.getElementById('shopping-store');
  if (!input) return;

  const itemText = input.value.trim();
  const store = storeSelect ? storeSelect.value : 'Sonstiges';

  if (!itemText) return;

  try {
    await db.collection('shoppingList').add({
      name: itemText,
      store: store,
      completed: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = '';
  } catch (error) {
    console.error("Fehler beim Hinzufügen:", error);
  }
};

// Rezept-Zutaten gesammelt zum Einkaufszettel hinzufügen
window.addIngredientsToShoppingList = async function(recipeId) {
  const recipe = recipes.find(r => String(r.id) === String(recipeId));
  if (!recipe || !recipe.ingredients) return;

  const lines = recipe.ingredients.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return;

  const batch = db.batch();
  lines.forEach(line => {
    const docRef = db.collection('shoppingList').doc();
    batch.set(docRef, {
      name: line,
      store: 'Supermarkt',
      completed: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });

  try {
    await batch.commit();
    alert(`${lines.length} Zutat(en) wurden zum Einkaufszettel hinzugefügt!`);
  } catch (error) {
    console.error("Fehler beim Übertragen der Zutaten:", error);
  }
};

// Artikel-Status umschalten (Abgehakt / Offen)
window.toggleShoppingItem = async function(id, currentStatus) {
  try {
    await db.collection('shoppingList').doc(id).update({
      completed: !currentStatus
    });
  } catch (error) {
    console.error("Fehler beim Aktualisieren:", error);
  }
};

// Einzelnen Artikel löschen
window.deleteShoppingItem = async function(id) {
  try {
    await db.collection('shoppingList').doc(id).delete();
  } catch (error) {
    console.error("Fehler beim Löschen:", error);
  }
};

// 🗑️ Alle abgehakten/erledigten Artikel auf einmal löschen
window.clearCompletedShoppingItems = async function() {
  const completedItems = shoppingList.filter(item => item.completed);
  if (completedItems.length === 0) {
    alert("Es gibt derzeit keine abgehakten Artikel zum Löschen.");
    return;
  }

  if (confirm(`Möchtest du wirklich alle ${completedItems.length} erledigten Artikel löschen?`)) {
    const batch = db.batch();
    completedItems.forEach(item => {
      const ref = db.collection('shoppingList').doc(item.id);
      batch.delete(ref);
    });

    try {
      await batch.commit();
    } catch (error) {
      console.error("Fehler beim Löschen der erledigten Artikel:", error);
    }
  }
};

// 🏷️ Dynamische Filter-Buttons nach vorhandenen Supermärkten rendern
function renderStoreFilterButtons() {
  const container = document.getElementById('shopping-store-filter-container');
  if (!container) return;

  // Verfügbare Läden ermitteln
  const storesInUse = Array.from(new Set(shoppingList.map(item => item.store || 'Sonstiges'))).sort();
  
  if (storesInUse.length <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; align-items:center;">`;
  html += `<span style="font-size:0.85rem; color:#666;">Filter:</span>`;
  
  const allActiveClass = selectedStoreFilter === "ALLE" ? 'background:#2b6cb0; color:#fff;' : 'background:#e2e8f0; color:#2d3748;';
  html += `<button onclick="setStoreFilter('ALLE')" style="border:none; padding:4px 10px; border-radius:12px; font-size:0.8rem; cursor:pointer; ${allActiveClass}">Alle</button>`;

  storesInUse.forEach(store => {
    const activeClass = selectedStoreFilter === store ? 'background:#2b6cb0; color:#fff;' : 'background:#e2e8f0; color:#2d3748;';
    html += `<button onclick="setStoreFilter('${escapeHtml(store)}')" style="border:none; padding:4px 10px; border-radius:12px; font-size:0.8rem; cursor:pointer; ${activeClass}">${escapeHtml(store)}</button>`;
  });

  html += `</div>`;
  container.innerHTML = html;
}

window.setStoreFilter = function(storeName) {
  selectedStoreFilter = storeName;
  renderShoppingList();
  renderStoreFilterButtons();
};

// 🛒 Einkaufsliste rendern (Gruppiert nach Supermarkt)
function renderShoppingList() {
  const container = document.getElementById('shopping-list-container');
  if (!container) return;

  container.innerHTML = '';

  // Gefilterte Liste je nach gewähltem Store-Filter
  const filteredList = shoppingList.filter(item => {
    if (selectedStoreFilter === "ALLE") return true;
    return (item.store || 'Sonstiges') === selectedStoreFilter;
  });

  if (filteredList.length === 0) {
    container.innerHTML = '<p style="color:#666; font-size:0.9rem; text-align:center; padding: 10px 0;">Keine Artikel in dieser Ansicht.</p>';
    return;
  }

  // 1. Artikel nach Supermarkt gruppieren
  const groupedList = filteredList.reduce((acc, item) => {
    const store = item.store || 'Sonstiges';
    if (!acc[store]) acc[store] = [];
    acc[store].push(item);
    return acc;
  }, {});

  const stores = Object.keys(groupedList).sort();

  // 2. Pro Supermarkt einen eigenen Block rendern
  stores.forEach(storeName => {
    const storeSection = document.createElement('div');
    storeSection.className = 'store-group';
    storeSection.style.cssText = 'margin-bottom: 16px; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0;';

    const storeHeader = document.createElement('h4');
    storeHeader.style.cssText = 'margin: 0 0 8px 0; font-size: 1rem; color: #2d3748; display: flex; align-items: center; justify-content: space-between; border-bottom: 2px solid #cbd5e0; padding-bottom: 4px;';
    storeHeader.innerHTML = `<span>🏪 <strong>${escapeHtml(storeName)}</strong></span> <small style="font-weight:normal; font-size:0.8rem; color:#718096;">${groupedList[storeName].length} Artikel</small>`;
    
    storeSection.appendChild(storeHeader);

    const itemsContainer = document.createElement('div');

    // Abgehakte Artikel innerhalb der Gruppe nach unten sortieren
    groupedList[storeName].sort((a, b) => a.completed - b.completed);

    groupedList[storeName].forEach(item => {
      const el = document.createElement('div');
      el.className = 'shopping-item';
      el.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:6px 0; border-bottom:1px solid #edf2f7;';

      el.innerHTML = `
        <span style="text-decoration: ${item.completed ? 'line-through' : 'none'}; color: ${item.completed ? '#a0aec0' : '#2d3748'}; cursor:pointer; font-size:0.95rem; user-select:none;" 
              onclick="toggleShoppingItem('${item.id}', ${item.completed})">
          ${item.completed ? '✅' : '⬜'} ${escapeHtml(item.name)}
        </span>
        <button onclick="deleteShoppingItem('${item.id}')" title="Löschen" style="color:#e53e3e; background:none; border:none; cursor:pointer; font-size:1.1rem; padding: 0 4px;">&times;</button>
      `;
      itemsContainer.appendChild(el);
    });

    storeSection.appendChild(itemsContainer);
    container.appendChild(storeSection);
  });
}

// ==========================================
// 6. HILFSFUNKTIONEN
// ==========================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, function(m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m];
  });
}