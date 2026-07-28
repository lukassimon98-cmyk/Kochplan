const firebaseConfig = {
  apiKey: "AIzaSyAk62DFEE6PTiTlUD7XU5Q0B3bb4OI_92k",
  authDomain: "kochplan-65d85.firebaseapp.com",
  projectId: "kochplan-65d85",
  storageBucket: "kochplan-65d85.firebasestorage.app",
  messagingSenderId: "461548419472",
  appId: "1:461548419472:web:69bdc92272857318c99b15"

};

// ==========================================
// FIREBASE KONFIGURATION
// ==========================================
const firebaseConfig = {
  apiKey: "DEINE_API_KEY",
  authDomain: "DEIN_PROJECT_ID.firebaseapp.com",
  projectId: "DEIN_PROJECT_ID",
  storageBucket: "DEIN_PROJECT_ID.appspot.com",
  messagingSenderId: "DEINE_SENDER_ID",
  appId: "DEINE_APP_ID"
};

// Firebase initialisieren
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();

// Globale Variablen für lokalen Speicher
let globalRecipes = [];
let globalMealPlan = {}; // Format: { "YYYY-MM-DD": "recipeId" }
let globalShoppingList = [];

// ==========================================
// INITIALISIERUNG & TABS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  setupRealtimeListeners();

  // Event-Listener für Suche/Filter
  document.getElementById("recipe-search").addEventListener("input", renderRecipes);
  document.getElementById("recipe-filter-category").addEventListener("change", renderRecipes);
  document.getElementById("recipe-form").addEventListener("submit", handleRecipeSubmit);
});

function switchTab(tabName) {
  document.querySelectorAll(".view-content").forEach(el => el.classList.add("hidden"));
  document.querySelectorAll(".nav-btn").forEach(el => el.classList.remove("active"));

  document.getElementById(`view-${tabName}`).classList.remove("hidden");
  
  // Aktiven Nav-Button hervorheben
  const navBtns = document.querySelectorAll(".nav-btn");
  if (tabName === 'recipes') navBtns[0].classList.add("active");
  if (tabName === 'add-recipe') navBtns[1].classList.add("active");
  if (tabName === 'meal-plan') {
    navBtns[2].classList.add("active");
    renderMealPlan();
  }
  if (tabName === 'shopping') {
    navBtns[3].classList.add("active");
    renderShoppingList();
  }
}

// ==========================================
// REALTIME LISTENERS (FIREBASE SYNC)
// ==========================================
function setupRealtimeListeners() {
  // 1. Rezepte laden
  db.collection("recipes").onSnapshot(snapshot => {
    globalRecipes = [];
    snapshot.forEach(doc => {
      globalRecipes.push({ id: doc.id, ...doc.data() });
    });
    renderRecipes();
  });

  // 2. Essensplan laden
  db.collection("settings").doc("mealplan").onSnapshot(doc => {
    if (doc.exists) {
      globalMealPlan = doc.data().plan || {};
    } else {
      globalMealPlan = {};
    }
  });

  // 3. Einkaufszettel laden
  db.collection("shopping").onSnapshot(snapshot => {
    globalShoppingList = [];
    snapshot.forEach(doc => {
      globalShoppingList.push({ id: doc.id, ...doc.data() });
    });
    renderShoppingList();
  });
}

// ==========================================
// REZEPTE LOGIK
// ==========================================
function renderRecipes() {
  const listContainer = document.getElementById("recipe-list");
  const searchQuery = document.getElementById("recipe-search").value.toLowerCase();
  const categoryFilter = document.getElementById("recipe-filter-category").value;

  listContainer.innerHTML = "";

  const filtered = globalRecipes.filter(r => {
    const matchesSearch = r.title.toLowerCase().includes(searchQuery) || 
                          (r.ingredients && r.ingredients.toLowerCase().includes(searchQuery));
    const matchesCategory = categoryFilter === "" || r.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = "<p style='color:#a0aec0; text-align:center;'>Keine Rezepte gefunden.</p>";
    return;
  }

  filtered.forEach(r => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div class="item-header">
        <h3 style="font-size:1.1rem;">${r.title}</h3>
        <span class="badge">${r.category || 'Hauptspeise'}</span>
      </div>
      ${r.imageUrl ? `<img src="${r.imageUrl}" style="width:100%; max-height:200px; object-fit:cover; border-radius:6px; margin:8px 0;">` : ''}
      <p style="font-size:0.85rem; color:#718096; margin:4px 0;">⏱️ ${r.time || '-'} Min. | 👥 ${r.servings || '2'} Portionen</p>
      
      <details style="margin-top:8px;">
        <summary style="cursor:pointer; font-weight:600; color:var(--primary);">Zutaten & Zubereitung anzeigen</summary>
        <div style="margin-top:8px; white-space: pre-line; font-size:0.9rem;">
          <strong>Zutaten:</strong>\n${r.ingredients}\n\n<strong>Anleitung:</strong>\n${r.instructions}
        </div>
      </details>

      <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:10px;">
        <button onclick="editRecipe('${r.id}')" class="btn btn-secondary btn-small">✏️ Bearbeiten</button>
        <button onclick="deleteRecipe('${r.id}')" class="btn btn-secondary btn-small" style="color:var(--danger);">🗑️ Löschen</button>
      </div>
    `;
    listContainer.appendChild(item);
  });
}

async function handleRecipeSubmit(e) {
  e.preventDefault();
  const id = document.getElementById("recipe-id").value;
  const title = document.getElementById("recipe-title").value;
  const category = document.getElementById("recipe-category").value;
  const time = document.getElementById("recipe-time").value;
  const servings = document.getElementById("recipe-servings").value;
  const ingredients = document.getElementById("recipe-ingredients").value;
  const instructions = document.getElementById("recipe-instructions").value;
  const fileInput = document.getElementById("recipe-image");

  let imageUrl = "";

  // Bild als Base64 konvertieren (falls ausgewählt)
  if (fileInput.files.length > 0) {
    imageUrl = await convertFileToBase64(fileInput.files[0]);
  } else if (id) {
    const existing = globalRecipes.find(r => r.id === id);
    if (existing) imageUrl = existing.imageUrl || "";
  }

  const recipeData = { title, category, time, servings, ingredients, instructions, imageUrl };

  if (id) {
    await db.collection("recipes").doc(id).update(recipeData);
  } else {
    await db.collection("recipes").add(recipeData);
  }

  resetRecipeForm();
  switchTab("recipes");
}

function convertFileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
  });
}

function editRecipe(id) {
  const r = globalRecipes.find(item => item.id === id);
  if (!r) return;

  document.getElementById("recipe-id").value = r.id;
  document.getElementById("recipe-title").value = r.title;
  document.getElementById("recipe-category").value = r.category;
  document.getElementById("recipe-time").value = r.time;
  document.getElementById("recipe-servings").value = r.servings;
  document.getElementById("recipe-ingredients").value = r.ingredients;
  document.getElementById("recipe-instructions").value = r.instructions;
  document.getElementById("recipe-form-title").innerText = "Rezept bearbeiten";

  switchTab("add-recipe");
}

async function deleteRecipe(id) {
  if (confirm("Möchtest du dieses Rezept wirklich löschen?")) {
    await db.collection("recipes").doc(id).delete();
  }
}

function resetRecipeForm() {
  document.getElementById("recipe-form").reset();
  document.getElementById("recipe-id").value = "";
  document.getElementById("recipe-form-title").innerText = "Neues Rezept anlegen";
}

// ==========================================
// 14-TAGE ESSENSPLAN LOGIK
// ==========================================
function renderMealPlan() {
  const container = document.getElementById("meal-plan-list");
  container.innerHTML = "";

  const today = new Date();
  const daysOptions = { weekday: 'short', day: '2-digit', month: '2-digit' };

  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    // Datum-Schlüssel im Format YYYY-MM-DD
    const dateKey = date.toISOString().split('T')[0];
    const dateString = date.toLocaleDateString('de-DE', daysOptions);

    const selectedRecipeId = globalMealPlan[dateKey] || "";

    const card = document.createElement("div");
    card.className = "meal-day-card";

    let selectOptions = `<option value="">-- Kein Gericht geplant --</option>`;
    globalRecipes.forEach(r => {
      const isSelected = r.id === selectedRecipeId ? "selected" : "";
      selectOptions += `<option value="${r.id}" ${isSelected}>${r.title}</option>`;
    });

    card.innerHTML = `
      <div class="meal-day-header">
        <span>${i === 0 ? 'Heute' : (i === 1 ? 'Morgen' : dateString)}</span>
        <span style="font-size:0.8rem; color:#718096;">${dateKey}</span>
      </div>
      <select onchange="updateMealPlanDay('${dateKey}', this.value)">
        ${selectOptions}
      </select>
    `;

    container.appendChild(card);
  }
}

async function updateMealPlanDay(dateKey, recipeId) {
  if (recipeId) {
    globalMealPlan[dateKey] = recipeId;
  } else {
    delete globalMealPlan[dateKey];
  }

  await db.collection("settings").doc("mealplan").set({ plan: globalMealPlan });
}

// ==========================================
// ZUTATEN ADDITION & EINKAUFSZETTEL-TRANSFER
// ==========================================
async function transferMealPlanToShoppingList() {
  // Alle gewählten Rezepte ermitteln
  const activeRecipeIds = Object.values(globalMealPlan).filter(id => id !== "");

  if (activeRecipeIds.length === 0) {
    alert("Es wurden keine Gerichte im 14-Tage-Plan ausgewählt!");
    return;
  }

  const ingredientMap = {}; // { "hackfleisch_g": { amount: 750, unit: "g", name: "Hackfleisch" } }

  activeRecipeIds.forEach(id => {
    const recipe = globalRecipes.find(r => r.id === id);
    if (recipe && recipe.ingredients) {
      const lines = recipe.ingredients.split("\n");
      lines.forEach(line => {
        const parsed = parseIngredientLine(line.trim());
        if (parsed.name) {
          const key = (parsed.name + "_" + parsed.unit).toLowerCase();
          if (!ingredientMap[key]) {
            ingredientMap[key] = { ...parsed };
          } else {
            ingredientMap[key].amount += parsed.amount;
          }
        }
      });
    }
  });

  // In Firestore hochladen
  const batch = db.batch();

  Object.values(ingredientMap).forEach(item => {
    let itemText = item.name;
    if (item.amount > 0) {
      itemText = `${item.amount}${item.unit ? item.unit + ' ' : ' '}${item.name}`;
    }

    const docRef = db.collection("shopping").doc();
    batch.set(docRef, {
      name: itemText,
      store: "Sonstiges",
      completed: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();
  alert("Zutaten wurden erfolgreich zusammengerechnet und auf den Einkaufszettel gesetzt!");
  switchTab("shopping");
}

// Hilfsfunktion: Zerlegt "500g Hackfleisch" in Menge, Einheit & Name
function parseIngredientLine(line) {
  if (!line) return { amount: 0, unit: "", name: "" };

  // RegEx sucht nach Zahlen am Anfang (z. B. 500, 1.5, 1/2) und Einheiten (g, kg, ml, el, tl, dose, dosten, etc.)
  const regex = /^([\d.,]+)?\s*(g|kg|ml|l|el|tl|pck|packung|dose|dosen|becher|zehe|zehen|stk|stück)?\s*(.*)$/i;
  const match = line.match(regex);

  if (match) {
    let amountStr = match[1] ? match[1].replace(",", ".") : "0";
    let amount = parseFloat(amountStr) || 0;
    let unit = match[2] ? match[2].toLowerCase() : "";
    let name = match[3] ? match[3].trim() : line;

    // Wenn keine Mengenangabe vorhanden war
    if (!match[1] && !match[2]) {
      name = line;
      amount = 0;
    }

    return { amount, unit, name };
  }

  return { amount: 0, unit: "", name: line };
}

// ==========================================
// EINKAUFSZETTEL LOGIK
// ==========================================
function renderShoppingList() {
  const container = document.getElementById("shopping-list-container");
  container.innerHTML = "";

  if (globalShoppingList.length === 0) {
    container.innerHTML = "<p style='color:#a0aec0; text-align:center;'>Der Einkaufszettel ist leer.</p>";
    return;
  }

  // Gruppierung nach Supermärkten
  const grouped = {};
  globalShoppingList.forEach(item => {
    const store = item.store || "Sonstiges";
    if (!grouped[store]) grouped[store] = [];
    grouped[store].push(item);
  });

  for (const [store, items] of Object.entries(grouped)) {
    const section = document.createElement("div");
    section.className = "store-section";

    let itemsHtml = "";
    items.forEach(item => {
      itemsHtml += `
        <div class="shopping-item-row ${item.completed ? 'completed' : ''}">
          <label style="display:flex; align-items:center; gap:8px; font-weight:normal; cursor:pointer;">
            <input type="checkbox" ${item.completed ? 'checked' : ''} onchange="toggleShoppingItem('${item.id}', ${!item.completed})">
            <span>${item.name}</span>
          </label>
          <button onclick="deleteShoppingItem('${item.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer;">✕</button>
        </div>
      `;
    });

    section.innerHTML = `
      <div class="store-title">🏪 ${store}</div>
      ${itemsHtml}
    `;

    container.appendChild(section);
  }
}

async function addShoppingItemManual(e) {
  e.preventDefault();
  const input = document.getElementById("shopping-input");
  const store = document.getElementById("shopping-store").value;

  if (!input.value.trim()) return;

  await db.collection("shopping").add({
    name: input.value.trim(),
    store: store,
    completed: false,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  input.value = "";
}

async function toggleShoppingItem(id, completed) {
  await db.collection("shopping").doc(id).update({ completed });
}

async function deleteShoppingItem(id) {
  await db.collection("shopping").doc(id).delete();
}

async function clearCompletedShoppingItems() {
  const completedItems = globalShoppingList.filter(i => i.completed);
  const batch = db.batch();

  completedItems.forEach(item => {
    const ref = db.collection("shopping").doc(item.id);
    batch.delete(ref);
  });

  await batch.commit();
}