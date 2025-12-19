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

// Identificar este telemóvel
if(!localStorage.getItem("rui_dev_id")) localStorage.setItem("rui_dev_id", "dev_" + Math.random().toString(36).substr(2, 9));
const myId = localStorage.getItem("rui_dev_id");

// Carregar Despesas
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
    document.getElementById("balanceRui").innerText = r.innerText = r.toFixed(2);
    const set = document.getElementById("settlements");
    const diff = Math.abs(s-r)/2;
    set.style.background = t===0 || diff<0.01 ? "#d1fae5" : "#fef3c7";
    set.innerHTML = t===0 || diff<0.01 ? "Tudo certo!" : (s>r ? `👨 Rui deve ${diff.toFixed(2)}€` : `👩 Sara deve ${diff.toFixed(2)}€`);
  });
}

// Lógica do Botão Único
const bArquivo = document.getElementById("mainArchiveBtn");
const info = document.getElementById("archive-info");

db.collection("households").doc("sara_rui").onSnapshot(doc => {
  const votes = (doc.data() && doc.data().archiveVotes) || [];
  const jaVotei = votes.includes(myId);

  if (votes.length === 0) {
    bArquivo.className = "btn"; bArquivo.innerText = "📁 Arquivar Contas";
    info.innerText = "Aguardando clique de ambos";
  } else if (votes.length === 1) {
    bArquivo.className = "btn waiting";
    bArquivo.innerText = jaVotei ? "⏳ Aguardando o outro..." : "⚠️ Falta 1 aprovação";
    info.innerText = jaVotei ? "Tu já clicaste. Sara/Rui tem de clicar agora." : "Alguém já clicou. Clica para fechar as contas!";
  }
});

bArquivo.onclick = function() {
  // Mudar cor no ecrã ANTES de ir à internet para saberes que funcionou
  bArquivo.classList.add("waiting");
  bArquivo.innerText = "⏳ A processar...";

  const ref = db.collection("households").doc("sara_rui");
  ref.get().then(doc => {
    let votes = (doc.data() && doc.data().archiveVotes) || [];
    if (votes.includes(myId)) {
       alert("Já clicaste! Espera pela outra pessoa.");
       return;
    }
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
      rep(7);
    });
  });
}

function rep(days) {
  db.collection("households").doc("sara_rui").collection("historico").get().then(snap => {
    let t=0, s=0, r=0, c=0;
    const lim = days > 0 ? new Date(Date.now() - days*86400000).toISOString().slice(0,10) : "0";
    snap.forEach(doc => {
      const d = doc.data();
      if(d.date >= lim){ t+=d.amount; if(d.payer=='Sara') s+=d.amount; else r+=d.amount; c++; }
    });
    document.getElementById("report-total").innerText = t.toFixed(0)+"€";
    document.getElementById("report-sara").innerText = s.toFixed(0)+"€";
    document.getElementById("report-rui").innerText = r.toFixed(0)+"€";
    document.getElementById("report-avg").innerText = c>0?(t/(days||30)).toFixed(1)+"€":"0€";
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

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active'); rep(parseInt(btn.dataset.days));
  };
});

load(); rep(7);
