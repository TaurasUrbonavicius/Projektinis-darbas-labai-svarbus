// Global for current user
let currentUser = null;

async function getCurrentUser() {
    try {
        const res = await fetch('/me');
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
        }
    } catch (e) {
        // Not logged in
    }
}

async function isLoggedIn() {
    try {
        const res = await fetch('/me');
        if (res.ok) {
            const data = await res.json();
            currentUser = data.user;
            return true;
        }
    } catch(e) {}
    return false;
}

async function loadListings(query) {
    const listingsEl = document.querySelector('.listings');
    if (!listingsEl) return;
    try {
        const res = await fetch('/listings');
        const items = await res.json();
        const loggedIn = await isLoggedIn();
        const savedIds = loggedIn ? await (await fetch('/saved-ids')).json() : [];
        listingsEl.innerHTML = '';
        const filtered = query ? items.filter(item => {
            const name = (item.coolName || item.title || '').toLowerCase();
            const desc = (item.blahBlah || item.description || '').toLowerCase();
            const q = (query || '').toLowerCase();
            return isSubsequence(q, name) || isSubsequence(q, desc);
        }) : items;
        filtered.forEach(i => {
            const coolName = i.coolName || i.title || '';
            const blahBlah = i.blahBlah || i.description || '';
            const moneyNumber = i.price || i.moneyNumber || '';
            const ringRing = i.category || i.ringRing || '';
        
            const el = document.createElement('div');
            el.className = 'listing-card';
            el.style.backgroundImage = i.image ? `url('${i.image}')` : 'none';
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
            const bgOverlay = document.createElement('div');
            bgOverlay.className = 'listing-overlay';
            const content = document.createElement('div');
            content.className = 'listing-card-content';
            content.innerHTML = `
                <h3>${escapeHtml(coolName)}</h3>
                <p class="price">${escapeHtml(moneyNumber)} €</p>
                <button class="show-more-btn" onclick="openListingModal(${i.id})">Show More</button>
            `;
            bgOverlay.appendChild(content);

// only show save star when logged in
            if (loggedIn) {
                const star = document.createElement('button');
                star.className = 'save-star' + (savedIds.includes(i.id) ? ' filled' : '');
                star.innerHTML = '★';
                star.onclick = (ev) => { ev.stopPropagation(); toggleSave(i.id, star); };
                el.appendChild(star);
            }
            el.appendChild(bgOverlay);
            listingsEl.appendChild(el);
        });
    } catch (e) {
        console.error('Failed to load listings', e);
    }
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// simple subsequence matcher: 'tram' matches 'trampoline'
function isSubsequence(q, s) {
    if (!q) return false;
    let i = 0, j = 0;
    q = String(q).toLowerCase();
    s = String(s).toLowerCase();
    while (i < q.length && j < s.length) {
        if (q[i] === s[j]) i++;
        j++;
    }
    return i === q.length;
}

async function toggleSave(id, btn) {
    try {
        const res = await fetch('/toggle-save/' + id, { method: 'POST' });
        if (!res.ok) return;
        const data = await res.json();
        if (data.saved) btn.classList.add('filled'); else btn.classList.remove('filled');
    } catch (e) {
        console.error('Failed to toggle save', e);
    }
}

async function openListingModal(listingId) {
    try {
        const res = await fetch('/listing/' + listingId);
        if (!res.ok) return;
        const item = await res.json();
        
        const coolName = item.coolName || item.title || '';
        const blahBlah = item.blahBlah || item.description || '';
        const moneyNumber = item.price || item.moneyNumber || '';
        const ringRing = item.category || item.ringRing || '';
        const phone = item.phone || '';
        
        const modal = document.getElementById('listingModal');
        document.getElementById('modalImage').style.backgroundImage = item.image ? `url('${item.image}')` : 'none';
        document.getElementById('modalTitle').textContent = coolName;
        document.getElementById('modalPrice').textContent = moneyNumber + ' €';
        document.getElementById('modalCategory').textContent = 'Category: ' + escapeHtml(ringRing);
        document.getElementById('modalDescription').textContent = blahBlah;
        document.getElementById('modalPhone').textContent = 'Phone: ' + escapeHtml(phone);
        
        const editDeleteDiv = document.getElementById('modalEditDelete');
        editDeleteDiv.innerHTML = '';
        
        // Show edit/delete only for owner or admin
        if (currentUser && (currentUser.id === item.guyWhoOwnsIt || currentUser.role === 'admin')) {
            editDeleteDiv.innerHTML = `
                <a href="/edit/${item.id}" class="btn">Edit</a>
                <a href="/delete/${item.id}" class="btn delete-btn" onclick="return confirm('Delete this listing?')">Delete</a>
            `;
        }
        
        modal.classList.add('show');
    } catch (e) {
        console.error('Failed to open listing', e);
    }
}

function closeListingModal() {
    document.getElementById('listingModal').classList.remove('show');
}

async function updateAuthNav() {
    const authLink = document.getElementById('auth-link');
    if (!authLink) return;
    
    try {
        const res = await fetch('/me');
        if (res.ok) {
            authLink.textContent = 'Logout';
            authLink.href = '/logout';
        } else {
            authLink.textContent = 'Login';
            authLink.href = '/auth';
        }
    } catch (e) {
        authLink.textContent = 'Login';
        authLink.href = '/auth';
    }
}

getCurrentUser();
updateAuthNav();
if (document.querySelector('.listings')) {
    loadListings();
}
