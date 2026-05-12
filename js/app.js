// WorkTrace Editor - Professional Workspace Logic
const firebaseConfig = {
  apiKey: "AIzaSyDdRwSkiB4DjRg_W_dh5B50vUzsJtg-dyA",
  authDomain: "worktrace-agency.firebaseapp.com",
  projectId: "worktrace-agency",
  storageBucket: "worktrace-agency.firebasestorage.app",
  messagingSenderId: "891860270689",
  appId: "1:891860270689:web:31cc3e9047bd79bc15b420",
  measurementId: "G-S1HR173NW8"
};

if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

let myTasks = [];

// ─── AUTHENTICATION ───
function login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(e => console.error(e));
}

async function checkUserAccess(user) {
    if(!user) return;
    const doc = await db.collection('users').doc(user.email).get();
    if(doc.exists && (doc.data().role === 'editor' || doc.data().role === 'admin')) {
        document.getElementById('auth-overlay').style.display = 'none';
        startListeners(user.email);
    } else {
        if(!doc.exists) {
            await db.collection('users').doc(user.email).set({
                name: user.displayName, email: user.email, role: 'pending_editor',
                joinedAt: new Date().toISOString()
            });
        }
        alert("Access Restricted: Unauthorized Editor Account.");
        auth.signOut();
    }
}

// ─── NAVIGATION ───
function switchView(viewId, title) {
    document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');
    document.getElementById('view-' + viewId).style.display = 'block';
    document.getElementById('view-title').textContent = title;
    
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
    event.currentTarget.classList.add('active');
}

// ─── LISTENERS ───
function startListeners(email) {
    db.collection('projects').where('editorEmail', '==', email).onSnapshot(snap => {
        myTasks = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderTasks();
        renderEarnings();
        calculateStats();
    });
}

// ─── RENDERING ───
function renderTasks() {
    const list = document.getElementById('task-list');
    if(myTasks.length === 0) {
        list.innerHTML = '<div style="padding:60px; text-align:center; color:var(--muted);">No projects assigned to you yet.</div>';
        return;
    }

    list.innerHTML = myTasks.map(t => `
        <div class="task-card" style="background:var(--surface); border:1px solid var(--border); border-radius:20px; padding:24px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center;">
            <div class="task-info">
                <div style="font-size:12px; color:var(--accent); font-weight:800; margin-bottom:5px;">#${t.id.slice(-6).toUpperCase()}</div>
                <h4 style="font-size:18px; font-weight:800; margin-bottom:5px;">${t.name}</h4>
                <p style="font-size:13px; color:var(--muted);">Client: ${t.clientName} | Deadline: <span style="color:#fff;">${t.deadline || 'TBA'}</span></p>
                <div style="margin-top:15px; display:flex; gap:10px; align-items:center;">
                    <span class="status-badge" style="background:rgba(255,255,255,0.05); font-size:10px;">${t.status}</span>
                    <span style="font-size:11px; color:var(--muted);">Fee: <b style="color:#22c55e;">$${t.editorFee}</b></span>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px;">
                <button class="upload-btn" onclick="uploadWork('${t.id}')" style="background:var(--accent); color:#000; border:none; padding:12px 24px; border-radius:12px; font-weight:800; cursor:pointer;">↑ SUBMIT WORK</button>
                ${t.editorLink ? `<a href="${t.editorLink}" target="_blank" style="font-size:11px; color:var(--muted); text-align:center;">View Submission</a>` : ''}
            </div>
        </div>
    `).join('');
}

function renderEarnings() {
    const list = document.getElementById('earnings-list');
    list.innerHTML = myTasks.map(t => `
        <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:15px 20px; font-size:14px;"><b>${t.name}</b></td>
            <td style="padding:15px 20px;"><span class="status-badge" style="font-size:10px;">${t.status}</span></td>
            <td style="padding:15px 20px; font-family:'JetBrains Mono'; font-weight:700; color:#22c55e;">$${t.editorFee}</td>
        </tr>
    `).join('');
}

function calculateStats() {
    const pending = myTasks.filter(t => t.status === 'Active').length;
    const review = myTasks.filter(t => t.status === 'Review').length;
    const total = myTasks.reduce((s, t) => s + (t.editorFee || 0), 0);

    document.getElementById('stat-tasks').textContent = pending;
    document.getElementById('stat-review').textContent = review;
    document.getElementById('stat-earnings').textContent = '$' + total.toLocaleString();
    document.getElementById('total-earned').textContent = '$' + total.toLocaleString();
}

async function uploadWork(projectId) {
    const link = prompt("Paste your work link (Drive/Frame.io/etc):");
    if(!link) return;
    try {
        await db.collection('projects').doc(projectId).update({
            editorLink: link,
            status: 'Review',
            lastUploadAt: new Date().toISOString()
        });
        alert("Submitted for review! ✅");
    } catch(e) { alert(e.message); }
}

// ─── INIT ───
auth.onAuthStateChanged(user => {
    if(user) checkUserAccess(user);
    else document.getElementById('auth-overlay').style.display = 'flex';
});

// Sidebar Events
document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
        const view = link.textContent.trim().toLowerCase();
        if(view === 'tasks board') switchView('tasks', 'My Assignments');
        else if(view === 'earnings') switchView('earnings', 'Financial Overview');
    });
});
