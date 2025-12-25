// --- KONFIGURATION ---
// ÄNDERE DIESE IP nach dem Terraform Apply! (Beispiel: 'http://3.123.45.67:3000')
const API_BASE = 'REPLACE_ME_API_URL';

const App = {
    user: null,
    userId: null, 
    currentListName: null,
    currentList: [], 
    favorites: [],
    savedLists: {},

    init: () => {
        const storedUserId = localStorage.getItem('shoppingUserId');
        const storedUserName = localStorage.getItem('shoppingUserName');
        
        if (storedUserId && storedUserName) {
            App.userId = storedUserId;
            App.user = storedUserName;
            document.getElementById('loginView').classList.add('hidden');
            document.getElementById('appView').classList.remove('hidden');
            document.getElementById('displayUser').textContent = App.user;
            App.loadUserData();
        }
    },

    login: async (nameInput = null) => {
        const name = nameInput || document.getElementById('usernameInput').value.trim();
        if (!name) return alert("Bitte Namen eingeben");

        try {
            const response = await fetch(`${API_BASE}/api/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: name })
            });
            
            if (!response.ok) throw new Error('Login fehlgeschlagen');
            const data = await response.json();
            
            App.userId = data.id;
            App.user = data.username;
            localStorage.setItem('shoppingUserId', App.userId);
            localStorage.setItem('shoppingUserName', App.user);

            document.getElementById('loginView').classList.add('hidden');
            document.getElementById('appView').classList.remove('hidden');
            document.getElementById('displayUser').textContent = App.user;
            App.loadUserData();

        } catch (error) {
            console.error(error);
            alert("Fehler: Server nicht erreichbar. Hast du die IP in app.js eingetragen?");
        }
    },

    logout: () => {
        localStorage.removeItem('shoppingUserId');
        localStorage.removeItem('shoppingUserName');
        location.reload();
    },

    loadUserData: async () => {
        if (!App.userId) return;
        try {
            const favRes = await fetch(`${API_BASE}/api/favorites?userId=${App.userId}`);
            const favData = await favRes.json(); 
            App.favorites = favData.map(f => f.item_name); 

            const listRes = await fetch(`${API_BASE}/api/lists?userId=${App.userId}`);
            const listData = await listRes.json();
            
            App.savedLists = {};
            listData.forEach(entry => {
                App.savedLists[entry.list_name] = typeof entry.list_data === 'string' 
                    ? JSON.parse(entry.list_data) 
                    : entry.list_data;
            });

            App.renderFavorites();
            App.renderSavedLists();
        } catch (error) {
            console.error("Ladefehler", error);
        }
    },

    addItemManual: () => {
        const input = document.getElementById('itemInput');
        const qtyInput = document.getElementById('qtyInput');
        const name = input.value.trim();
        const menge = parseInt(qtyInput.value) || 1;

        if (name) {
            App.addItem(name, menge);
            input.value = '';
            qtyInput.value = 1;
            input.focus();
        }
    },

    addItem: (name, mengeToAdd) => {
        const existingItem = App.currentList.find(item => item.name.toLowerCase() === name.toLowerCase());
        if (existingItem) {
            existingItem.menge += mengeToAdd;
            existingItem.checked = false;
        } else {
            App.currentList.push({ name: name, menge: mengeToAdd, checked: false, id: Date.now() });
        }
        App.renderList();
    },

    toggleCheck: (index) => {
        App.currentList[index].checked = !App.currentList[index].checked;
        App.renderList();
    },

    deleteItem: (index) => {
        App.currentList.splice(index, 1);
        App.renderList();
    },

    clearList: () => {
        if(confirm("Liste leeren?")) {
            App.currentList = [];
            App.currentListName = null;
            App.renderList();
        }
    },

    renderList: () => {
        const listEl = document.getElementById('shoppingList');
        listEl.innerHTML = '';
        App.currentList.forEach((item, index) => {
            const li = document.createElement('li');
            if (item.checked) li.classList.add('checked');
            li.innerHTML = `
                <div class="item-left" onclick="App.toggleCheck(${index})">
                    <span class="badge">${item.menge}x</span>
                    <span class="item-text">${item.name}</span>
                </div>
                <button onclick="App.deleteItem(${index})" class="btn-text" style="color:red">×</button>
            `;
            listEl.appendChild(li);
        });
    },

    renderFavorites: () => {
        document.getElementById('favContainer').innerHTML = App.favorites.map(fav => `
            <div class="fav-btn" onclick="App.addItem('${fav}', 1)">
                ${fav} <span class="fav-del" onclick="event.stopPropagation(); App.removeFavorite('${fav}')">x</span>
            </div>
        `).join('');
    },

    renderSavedLists: () => {
        const names = Object.keys(App.savedLists);
        const html = names.length === 0 ? '<li style="color:#aaa;text-align:center;">Leer</li>' 
            : names.map(name => `
                <li onclick="App.loadList('${name}')">
                    <span>📂 ${name}</span>
                    <button onclick="event.stopPropagation(); App.deleteSavedList('${name}')" class="btn-text">🗑️</button>
                </li>`).join('');
        document.getElementById('savedListContainer').innerHTML = html;
    },

    addFavoritePrompt: async () => {
        const newFav = prompt("Neuer Favorit:");
        if (newFav && !App.favorites.includes(newFav)) {
            App.favorites.push(newFav);
            App.renderFavorites();
            fetch(`${API_BASE}/api/favorites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: App.userId, itemName: newFav })
            }).catch(() => alert("Speicherfehler"));
        }
    },

    removeFavorite: async (favName) => {
        if(!confirm("Löschen?")) return;
        App.favorites = App.favorites.filter(f => f !== favName);
        App.renderFavorites();
        fetch(`${API_BASE}/api/favorites`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: App.userId, itemName: favName })
        });
    },

    saveList: async () => {
        if (App.currentList.length === 0) return alert("Liste leer!");
        const name = prompt("Name der Liste:", App.currentListName || `Einkauf ${new Date().toLocaleDateString()}`);
        if (name) {
            try {
                await fetch(`${API_BASE}/api/lists`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: App.userId, listName: name, listData: App.currentList })
                });
                App.savedLists[name] = App.currentList;
                App.currentListName = name;
                App.renderSavedLists();
                alert("Gespeichert!");
            } catch (e) { alert("Server Fehler"); }
        }
    },

    loadList: (name) => {
        if (confirm(`"${name}" laden?`)) {
            App.currentList = JSON.parse(JSON.stringify(App.savedLists[name]));
            App.currentListName = name;
            App.renderList();
        }
    },

    deleteSavedList: async (name) => {
        if(confirm("Wirklich löschen?")) {
            delete App.savedLists[name];
            App.renderSavedLists();
            fetch(`${API_BASE}/api/lists`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: App.userId, listName: name })
            });
        }
    }
};

document.getElementById('usernameInput').addEventListener('keypress', e => { if(e.key === 'Enter') App.login() });
document.getElementById('itemInput').addEventListener('keypress', e => { if(e.key === 'Enter') App.addItemManual() });


App.init();
