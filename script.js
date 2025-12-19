const firebaseConfig = {
  apiKey: "AIzaSyCle9Kx3OVD7mnZfXubKyIGW6COYrGI304",
  authDomain: "contassararui.firebaseapp.com",
  projectId: "contassararui",
  storageBucket: "contassararui.firebasestorage.app",
  messagingSenderId: "760330070358",
  appId: "1:760330070358:web:5d1f213133bfdbe902cef7"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

if(!localStorage.getItem("rui_id")) localStorage.setItem("rui_id", "id_" + Math.random().toString(36).substr(2, 9));
const myId = localStorage.getItem("rui_id");

// 1. ACESSO AO HISTÓRICO COM CÓDIGO
function checkPass() {
    const pass = prompt("Introduza o código:");
    if(pass === "rsc") {
        document.getElementById("hist-section").style.display = "block";
        loadReport();
    } else {
        alert("Código errado!");
    }
}

// 2. CARREGAR DESPESAS
function load() {
  db.collection("households").doc("sara_rui").collection("expenses").orderBy("date","desc").onSnapshot(snap => {
    const list = document.getElementById("list"); list.innerHTML = "";
    let s=0, r=0, t=0;
    snap.forEach(doc => {
      const e = doc.data(); t += e.amount;
      if(e.payer==='Sara') s+=e.amount; else r+=e.amount;
      const d = document.createElement("div"); d.className="expense-item";
      d.innerHTML = `<div><b>${e.payer=='Sara'?'👩':'👨'} ${e.description}</b></div><div>${e.amount.toFixed(2)}€ <button onclick="del('${doc.id}')">🗑️</button></div>`;
      list.appendChild(d);
    });
    document.getElementById("totalSum").innerText = t.toFixed(2) + "€";
    document.getElementById("balanceSara").innerText = s.toFixed(2);
    document.getElementById("balanceRui").innerText = r.toFixed(2);
    const set = document.getElementById("settlements");
    const diff = Math.abs(s-r)/2;
    set.style.background = t===0 || diff<0.01 ? "#d1fae5" : "#fef3c7";
    set.innerHTML = t===0 || diff<0.01 ? "Tudo certo!" : (s>r ? `👨 Rui deve ${diff.toFixed(2)}€` : `👩 Sara deve ${diff.toFixed(2)}€`);
  });
}

// 3. VOTAR PARA ARQUIVAR
const bArquivo = document.getElementById("mainArchiveBtn");

db.collection("households").doc("sara_rui").onSnapshot(doc => {
  const votes = (doc.data() && doc.data().archiveVotes) || [];
  if (votes.length === 0) {
    bArquivo.className = "btn"; bArquivo.innerText = "📁 Arquivar Contas";
  } else if (votes.length === 1) {
    bArquivo.className = "btn waiting";
    bArquivo.innerText = votes.includes(myId) ? "⏳ Aguardando Sara/Rui..." : "⚠️ Falta 1 aprovação";
  }
});

bArquivo.onclick = function() {
  const ref = db.collection("households").doc("sara_rui");
  ref.get().then(doc => {
    let votes = (doc.data() && doc.data().archiveVotes) || [];
    if (votes.includes(myId)) return alert("Já clicaste!");
    
    votes.push(myId);
    ref.update({ archiveVotes: votes }).then(() => {
      if (votes.length >= 2) archiveNow();
    });
  });
};

function archiveNow() {
  db.collection("households").doc("sara_rui").collection("expenses").get().then(snap => {
    let batch = db.batch();
    snap.docs.forEach(doc => {
      const h = db.collection("households").doc("sara_rui").collection("historico").doc();
      batch.set(h, {...doc.data(), archivedAt: new Date().toISOString()});
      batch.delete(doc.ref);
    });
    batch.commit().then(() => {
      db.collection("households").doc("sara_rui").update({ archiveVotes: [] });
      alert("✅ Arquivado!");
    });
  });
}

function loadReport() {
  db.collection("households").doc("sara_rui").collection("historico").get().then(snap => {
    let t=0, s=0, r=0, c=0;
    snap.forEach(doc => {
      const d = doc.data(); t+=d.amount; 
      if(d.payer=='Sara') s+=d.amount; else r+=d.amount; c++;
    });
    document.getElementById("report-total").innerText = t.toFixed(0)+"€";
    document.getElementById("report-sara").innerText = s.toFixed(0)+"€";
    document.getElementById("report-rui").innerText = r.toFixed(0)+"€";
    document.getElementById("report-avg").innerText = c>0 ? (t/30).toFixed(1)+"€" : "0€";
  });
}

function del(id) { if(confirm("Apagar?")) db.collection("households").doc("sara_rui").collection("expenses").doc(id).delete(); }

document.getElementById("expenseForm").onsubmit = (e) => {
  e.preventDefault();
  db.collection("households").doc("sara_rui").collection("expenses").add({
    payer: document.getElementById("payer").value,
    amount: parseFloat(document.getElementById("amount").value),
    description: document.getElementById("description").value,
    date: new Date().toISOString().slice(0, 10)
  }).then(() => e.target.reset());
};

load();
