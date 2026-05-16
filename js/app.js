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
        list.innerHTML = '<div style="padding:100px; text-align:center; color:var(--muted); font-weight:600;">No assignments found in your queue.</div>';
        return;
    }

    list.innerHTML = myTasks.map(t => `
        <div class="task-card" id="task-${t.id}">
            <div class="upload-area" id="upload-${t.id}" onclick="triggerUpload('${t.id}')">
                <span id="icon-${t.id}">+</span>
                <div class="upload-progress" id="progress-${t.id}"></div>
                <input type="file" id="file-${t.id}" style="display:none;" onchange="handleTaskUpload(event, '${t.id}')">
            </div>
            
            <div class="task-details">
                <div style="font-size:11px; color:var(--accent); font-weight:800; margin-bottom:5px; letter-spacing:1px;">ID: #${t.id.slice(-6).toUpperCase()}</div>
                <h4>${t.name}</h4>
                <div style="font-size:13px; color:var(--muted);">Client: <span style="color:#fff;">${t.clientName}</span> | Due: <span style="color:#fff;">${t.deadline || 'TBA'}</span></div>
                
                <div class="task-links">
                    <a href="${t.scriptLink || '#'}" target="_blank" class="link-btn">📜 Script</a>
                    <a href="${t.rawAssets || '#'}" target="_blank" class="link-btn" style="color:var(--accent); border-color:var(--accent-glow);">🎬 Footage</a>
                    ${t.editorLink ? `<a href="${t.editorLink}" target="_blank" class="link-btn" style="background:var(--accent); color:#000;">✓ View Upload</a>` : ''}
                </div>
            </div>

            <div class="task-action">
                <span class="status-badge">${t.currentPhase || 'Editing'}</span>
                <div style="margin-top:12px; font-size:11px; color:var(--muted); font-weight:700;">PAYOUT: <span style="color:var(--accent);">$${t.editorFee || 0}</span></div>
            </div>
        </div>
    `).join('');
}

function triggerUpload(id) {
    document.getElementById(`file-${id}`).click();
}

async function handleTaskUpload(event, projectId) {
    const file = event.target.files[0];
    if(!file) return;

    const area = document.getElementById(`upload-${projectId}`);
    const icon = document.getElementById(`icon-${projectId}`);
    const progress = document.getElementById(`progress-${projectId}`);

    area.classList.add('uploading');
    icon.textContent = '...';

    const storageRef = firebase.storage().ref(`edits/${projectId}/${file.name}`);
    const uploadTask = storageRef.put(file);

    uploadTask.on('state_changed', 
        (snap) => {
            const pct = (snap.bytesTransferred / snap.totalBytes) * 100;
            progress.style.width = pct + '%';
        }, 
        (err) => {
            alert("Upload failed!");
            area.classList.remove('uploading');
            icon.textContent = '+';
        }, 
        async () => {
            const url = await uploadTask.snapshot.ref.getDownloadURL();
            
            // UPDATE PROJECT & MOVE TO SUPERVISION
            await db.collection('projects').doc(projectId).update({
                editorLink: url,
                lastUploadAt: new Date().toISOString(),
                currentPhase: 'Supervision', // Moving to Supervision Approval
                status: 'Review',
                progress: 57 // Based on 7 steps (Editing is step 3, Supervision is 4)
            });

            alert("Work uploaded & moved to Supervision! 🚀");
            area.classList.remove('uploading');
            icon.textContent = '✓';
        }
    );
}

function renderEarnings() {
    const list = document.getElementById('earnings-list');
    list.innerHTML = myTasks.map(t => `
        <tr style="border-bottom:1px solid var(--border);">
            <td style="padding:24px; font-size:14px;"><b>${t.name}</b></td>
            <td style="padding:24px;"><span class="status-badge">${t.currentPhase}</span></td>
            <td style="padding:24px; font-weight:800; color:var(--accent);">$${t.editorFee || 0}</td>
        </tr>
    `).join('');
}

function calculateStats() {
    const pending = myTasks.filter(t => t.currentPhase === 'Editing').length;
    const review = myTasks.filter(t => t.status === 'Review').length;
    const total = myTasks.reduce((s, t) => s + (t.editorFee || 0), 0);

    document.getElementById('stat-tasks').textContent = pending;
    document.getElementById('stat-review').textContent = review;
    document.getElementById('stat-earnings').textContent = '$' + total.toLocaleString();
    document.getElementById('total-earned').textContent = '$' + total.toLocaleString();
}

// ─── INIT ───
auth.onAuthStateChanged(user => {
    if(user) {
        // Update Sidebar Initials
        const initials = user.displayName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
        document.getElementById('user-initials').textContent = initials;
        document.getElementById('user-name').textContent = user.displayName;
        checkUserAccess(user);
    } else {
        document.getElementById('auth-overlay').style.display = 'flex';
    }
});

// Sidebar Events
document.querySelectorAll('.nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
        const view = link.textContent.trim().toLowerCase();
        if(view === 'tasks board') switchView('tasks', 'My Assignments');
        else if(view === 'earnings') switchView('earnings', 'Financial Overview');
    });
});
