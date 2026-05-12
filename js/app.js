// WorkTrace Editor - Tasks & Earnings Logic
const firebaseConfig = {
  apiKey: "AIzaSyDdRwSkiB4DjRg_W_dh5B50vUzsJtg-dyA",
  authDomain: "worktrace-agency.firebaseapp.com",
  projectId: "worktrace-agency",
  storageBucket: "worktrace-agency.firebasestorage.app",
  messagingSenderId: "891860270689",
  appId: "1:891860270689:web:31cc3e9047bd79bc15b420",
  measurementId: "G-S1HR173NW8"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();

let myTasks = [];
let myEarnings = 0;

// ─── AUTHENTICATION ───
function login() {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).then(res => {
        checkUserAccess(res.user);
    }).catch(err => {
        console.error("Login Error:", err);
    });
}

async function checkUserAccess(user) {
    if(!user) return;
    
    const doc = await db.collection('users').doc(user.email).get();
    if(doc.exists && doc.data().role === 'editor') {
        document.getElementById('auth-overlay').style.display = 'none';
        startListeners(user.email);
    } else {
        if(!doc.exists) {
            await db.collection('users').doc(user.email).set({
                name: user.displayName,
                email: user.email,
                role: 'pending_editor',
                joinedAt: new Date().toISOString()
            });
        }
        alert("Access Restricted: You are not registered as an Editor.");
        auth.signOut();
    }
}

// ─── LISTENERS ───
function startListeners(email) {
    // Listen for tasks assigned to this editor
    db.collection('projects').where('editorEmail', '==', email).onSnapshot(snap => {
        myTasks = snap.docs.map(d => ({id: d.id, ...d.data()}));
        renderTasks();
        calculateEarnings();
    });
}

// ─── RENDERING ───
function renderTasks() {
    const taskList = document.getElementById('task-list');
    if(!taskList) return;
    
    if(myTasks.length === 0) {
        taskList.innerHTML = '<div style="padding:40px; text-align:center; color:var(--muted);">No tasks assigned yet.</div>';
        return;
    }

    taskList.innerHTML = myTasks.map(t => `
        <div class="task-card">
            <div class="task-info">
                <h4>${t.name}</h4>
                <p>Deadline: ${t.deadline || 'TBA'} | Client: ${t.clientName}</p>
            </div>
            <button class="upload-btn" onclick="uploadWork('${t.id}')">↑ UPLOAD WORK</button>
        </div>
    `).join('');
}

function calculateEarnings() {
    let total = myTasks.reduce((s, t) => s + (parseFloat(t.editorFee) || 0), 0);
    document.getElementById('stat-earnings').textContent = '$' + total.toLocaleString();
    document.getElementById('stat-tasks').textContent = myTasks.length;
}

async function uploadWork(projectId) {
    const link = prompt("Enter the link to your work (Google Drive/Dropbox/Frame.io):");
    if(!link) return;
    
    try {
        await db.collection('projects').doc(projectId).update({
            editorLink: link,
            status: 'Review',
            lastUploadAt: new Date().toISOString()
        });
        alert("Work uploaded for review! ✅");
    } catch(e) {
        alert("Error: " + e.message);
    }
}

// Initial Check
auth.onAuthStateChanged(user => {
    if(user) checkUserAccess(user);
    else document.getElementById('auth-overlay').style.display = 'flex';
});
