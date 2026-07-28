const firebaseConfig = {
  apiKey: "AIzaSyAk62DFEE6PTiTlUD7XU5Q0B3bb4OI_92k",
  authDomain: "kochplan-65d85.firebaseapp.com",
  projectId: "kochplan-65d85",
  storageBucket: "kochplan-65d85.firebasestorage.app",
  messagingSenderId: "461548419472",
  appId: "1:461548419472:web:69bdc92272857318c99b15"

};
// Firebase sicher initialisieren
let db = null;
try {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  db = firebase.firestore();
} catch (e) {
  console.error("Firebase konnte nicht initialisiert werden:", e);
}

// Globale Variablen für lokalen Speicher
let globalRecipes = [];
let globalMealPlan = {};
let globalShoppingList = [];

// ==========================================
// SEITEN / TAB WECHSEL (Funktioniert immer)
// ==========================================
function switchTab(tabName) {
  // 1. Alle Ansichten ausblenden
  const views = document.querySelectorAll(".view-content");
  views.forEach(v => v.classList.add("hidden"));

  // 2. Gewünschte Ansicht einblenden
  const targetView = document.getElementById(`view-${tabName}`);
  if (targetView) {
    targetView.classList.remove("hidden");
  }

  // 3. Navigation-Buttons stylen
  document.querySelectorAll(".nav-btn").forEach(btn => btn.classList.remove("active"));
  const activeBtn = document.getElementById(`btn-${tabName}`);
  if (activeBtn) {
    activeBtn.classList.add("active");
  }

  // 4. Spezifische Inhalte laden
  if (tabName === 'meal-plan') {
    renderMealPlan();
  } else if (tabName === 'shopping') {
    renderShoppingList();
  } else if (tabName === 'recipes') {
    renderRecipes();
  }
}

// ==========================================
// INITIALISIERUNG
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  if (db) {
    setupRealtimeListeners();
  }

  const searchInput = document.getElementById("recipe-search");
  const filterSelect = document.getElementById("recipe-filter-category");
  const recipeForm = document.getElementById("recipe-form");

  if (searchInput) searchInput.addEventListener("input", renderRecipes);
  if (filterSelect) filterSelect.addEventListener("change", renderRecipes);
  if (recipeForm) recipeForm.addEventListener("submit", handleRecipeSubmit);
});

// ==========================================
// REALTIME LISTENERS (FIREBASE SYNC)
// ==========================================
function setupRealtimeListeners() {
  db.collection("recipes").onSnapshot(snapshot => {
    globalRecipes = [];
    snapshot.forEach(doc => {
      globalRecipes.push({ id: doc.id, ...doc.data() });
    });
    renderRecipes();
  }, err => console.log("Fehler bei Rezepten:", err));

  db.collection("settings").doc("mealplan").onSnapshot(doc => {
    if (doc.exists) {
      globalMealPlan = doc.data().plan || {};
    } else {
      globalMealPlan = {};
    }
  }, err => console.log("Fehler bei Essensplan:", err));

  db.collection("shopping").onSnapshot(snapshot => {
    globalShoppingList = [];
    snapshot.forEach(doc => {
      globalShoppingList.push({ id: doc.id, ...doc.data() });
    });
    renderShoppingList();
  }, err => console.log("Fehler bei Einkaufsliste:", err));
}

// ==========================================
// REZEPTE LOGIK
// ==========================================
function renderRecipes() {
  const listContainer = document.getElementById("recipe-list");
  if (!listContainer) return;

  const searchQuery = (document.getElementById("recipe-search")?.value || "").toLowerCase();
  const categoryFilter = document.getElementById("recipe-filter-category")?.value || "";

  listContainer.innerHTML = "";

  const filtered = globalRecipes.filter(r => {
    const matchesSearch = (r.title || "").toLowerCase().includes(searchQuery) || 
                          (r.ingredients || "").toLowerCase().includes(searchQuery);
    const matchesCategory = categoryFilter === "" || r.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  if (filtered.length === 0) {
    listContainer.innerHTML = "<p style='color:#a0aec0; text-align:center;'>Keine Rezepte vorhanden.</p>";
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
          <strong>Zutaten:</strong>\n${r.ingredients || ''}\n\n<strong>Anleitung:</strong>\n${r.instructions || ''}
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
  if (!db) return alert("Firebase ist nicht verbunden!");

  const id = document.getElementById("recipe-id").value;
  const title = document.getElementById("recipe-title").value;
  const category = document.getElementById("recipe-category").value;
  const time = document.getElementById("recipe-time").value;
  const servings = document.getElementById("recipe-servings").value;
  const ingredients = document.getElementById("recipe-ingredients").value;
  const instructions = document.getElementById("recipe-instructions").value;
  const fileInput = document.getElementById("recipe-image");

  let imageUrl = "";

  if (fileInput && fileInput.files.length > 0) {
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
  if (confirm("Möchtest du dieses Rezept wirklich löschen?") && db) {
    await db.collection("recipes").doc(id).delete();
  }
}

function resetRecipeForm() {
  document.getElementById("recipe-form")?.reset();
  document.getElementById("recipe-id").value = "";
  document.getElementById("recipe-form-title").innerText = "Neues Rezept anlegen";
}

// ==========================================
// 14-TAGE ESSENSPLAN LOGIK
// ==========================================
function renderMealPlan() {
  const container = document.getElementById("meal-plan-list");
  if (!container) return;

  container.innerHTML = "";
  const today = new Date();
  const daysOptions = { weekday: 'short', day: '2-digit', month: '2-digit' };

  for (let i = 0; i < 14; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
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

  if (db) {
    await db.collection("settings").doc("mealplan").set({ plan: globalMealPlan });
  }
}

// ==========================================
// ZUTATEN ZUSAMMENFASSEN & AUF EINKAUFSZETTEL SETZEN
// ==========================================
async function transferMealPlanToShoppingList() {
  if (!db) return alert("Firebase ist nicht verbunden!");

  const activeRecipeIds = Object.values(globalMealPlan).filter(id => id && id !== "");

  if (activeRecipeIds.length === 0) {
    alert("Es wurden keine Gerichte im 14-Tage-Plan ausgewählt!");
    return;
  }

  const ingredientMap = {};

  activeRecipeIds.forEach(id => {
    const recipe = globalRecipes.find(r => r.id === id);
    if (recipe && recipe.ingredients) {
      const lines = recipe.ingredients.split("\n");
      lines.forEach(line => {
        const cleanLine = line.trim();
        if (!cleanLine) return;

        const parsed = parseIngredientLine(cleanLine);
        
        // Schlüssel zum Erkennen von Duplikaten (z. B. "milch_ml")
        const key = `${parsed.normalizedName}_${parsed.unit}`.toLowerCase();

        if (!ingredientMap[key]) {
          ingredientMap[key] = {
            displayName: parsed.displayName,
            amount: parsed.amount,
            unit: parsed.unit
          };
        } else {
          // Gleiche Zutat gefunden -> Menge aufaddieren!
          ingredientMap[key].amount += parsed.amount;
        }
      });
    }
  });

  const batch = db.batch();

  Object.values(ingredientMap).forEach(item => {
    let itemText = item.displayName;

    if (item.amount > 0) {
      const formattedAmount = Math.round(item.amount * 100) / 100;
      // Sorgt für ein sauberes Leerzeichen zwischen Menge, Einheit und Name
      itemText = `${formattedAmount} ${item.unit ? item.unit + ' ' : ''}${item.displayName}`;
    }

    const docRef = db.collection("shopping").doc();
    batch.set(docRef, {
      name: itemText,
      store: "Sonstiges", // Standard-Kategorie
      completed: false,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  });

  await batch.commit();
  alert("Zutaten wurden erfolgreich zusammengefasst und auf den Einkaufszettel gesetzt!");
  switchTab("shopping");
}

// Erweitertes Parsing: Erkennt "gr", "ml", "l", "g", Brüche etc.
function parseIngredientLine(line) {
  if (!line) return { amount: 0, unit: "", displayName: "", normalizedName: "" };

  // Erfassung von Mengenangaben & Einheiten (inkl. "gr" aus deinem Screenshot)
  const regex = /^([\d.,]+|\d+\/\d+)?\s*(gr|g|kg|ml|l|el|tl|pck|packung|dose|dosen|becher|zehe|zehen|stk|stück|prise|prisen)?\s*(.*)$/i;
  const match = line.match(regex);

  if (match) {
    let rawAmount = match[1] || "0";
    let amount = 0;

    if (rawAmount.includes('/')) {
      const parts = rawAmount.split('/');
      amount = parseFloat(parts[0]) / parseFloat(parts[1]);
    } else {
      amount = parseFloat(rawAmount.replace(',', '.')) || 0;
    }

    let unit = match[2] ? match[2].toLowerCase() : "";
    let name = match[3] ? match[3].trim() : line;

    // "gr" einheitlich zu "g" machen, um Duplikate zu vermeiden
    if (unit === "gr") unit = "g";

    if (!match[1] && !match[2]) {
      name = line;
      amount = 0;
    }

    // Name bereinigen (Groß-/Kleinschreibung & Plural-Endungen ignorieren)
    const normalizedName = name.toLowerCase().replace(/s$/, '').trim();

    // Den ersten Buchstaben des Namens großschreiben für schöne Optik
    const displayName = name.charAt(0).toUpperCase() + name.slice(1);

    return {
      amount,
      unit,
      displayName,
      normalizedName
    };
  }

  return { amount: 0, unit: "", displayName: line, normalizedName: line.toLowerCase() };
}

// ==========================================
// EINKAUFSZETTEL LOGIK
// ==========================================
function renderShoppingList() {
  const container = document.getElementById("shopping-list-container");
  if (!container) return;

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

  const availableStores = ["Edeka", "Rewe", "Aldi", "Lidl", "DM", "Sonstiges"];

  for (const [store, items] of Object.entries(grouped)) {
    const section = document.createElement("div");
    section.className = "store-section";

    let itemsHtml = "";
    items.forEach(item => {
      // Dropdown-Optionen für den Supermarkt dieses spezifischen Items generieren
      let storeOptionsHtml = "";
      availableStores.forEach(s => {
        storeOptionsHtml += `<option value="${s}" ${item.store === s ? 'selected' : ''}>${s}</option>`;
      });

      itemsHtml += `
        <div class="shopping-item-row ${item.completed ? 'completed' : ''}">
          <label style="display:flex; align-items:center; gap:8px; font-weight:normal; cursor:pointer; flex:1;">
            <input type="checkbox" ${item.completed ? 'checked' : ''} onchange="toggleShoppingItem('${item.id}', ${!item.completed})">
            <span>${item.name}</span>
          </label>
          
          <!-- Dropdown zur Zuordnung an einen Supermarkt -->
          <select onchange="updateItemStore('${item.id}', this.value)" style="width: auto; padding: 2px 6px; font-size: 0.8rem; margin-right: 8px;">
            ${storeOptionsHtml}
          </select>

          <button onclick="deleteShoppingItem('${item.id}')" style="background:none; border:none; color:var(--danger); cursor:pointer; font-weight:bold;">✕</button>
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

// Funktion zum Ändern des Supermarktes eines Items
async function updateItemStore(id, newStore) {
  if (db) {
    await db.collection("shopping").doc(id).update({ store: newStore });
  }
}
async function toggleShoppingItem(id, completed) {
  if (db) await db.collection("shopping").doc(id).update({ completed });
}

async function deleteShoppingItem(id) {
  if (db) await db.collection("shopping").doc(id).delete();
}

async function clearCompletedShoppingItems() {
  if (!db) return;
  const completedItems = globalShoppingList.filter(i => i.completed);
  const batch = db.batch();

  completedItems.forEach(item => {
    const ref = db.collection("shopping").doc(item.id);
    batch.delete(ref);
  });

  await batch.commit();
}