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

function loadExpenses() {
  db.collection("households").doc("sara_rui").collection("expenses").orderBy("date", "desc").onSnapshot(snap => {
    const list = document.getElementById("list"); list.innerHTML = "";
    let s=0, r=0, t=0;
    snap.forEach(doc => {
      const e = doc.data(); t += e.amount;
      if (e.payer === 'Sara') s += e.amount; else r += e.amount;
      const div = document.createElement("div"); div.className = "expense-item";
      div.innerHTML = `<div><strong>${e.payer=='Sara'?'👩':'👨'} ${e.description}</strong><br><small>${e.date}</small></div>
                       <div>${e.amount.toFixed(2)}€ <button onclick="deleteExp('${doc.id}')">🗑️</button></div>`;
      list.appendChild(div);
    });
    document.getElementById("totalSum").textContent = t.toFixed(2);
    document.getElementById("balanceSara").textContent = s.toFixed(2);
    document.getElementById("balanceRui").textContent = r.toFixed(2);
    const sett = document.getElementById("settlements");
    const diff = Math.abs(s - r) / 2;
    if (diff < 0.01) { sett.className="settlement even"; sett.textContent="✅ Tudo certo!"; }
    else { sett.className="settlement pay"; sett.innerHTML = s > r ? `👨 Rui deve <strong>${diff.toFixed(2)}€</strong> a 👩 Sara` : `👩 Sara deve <strong>${diff.toFixed(2)}€</strong> a 👨 Rui`; }
  });
}

// --- Lógica de Arquivo Melhorada ---
const btn = document.getElementById("mainArchiveBtn");
const info = document.getElementById("archive-info");

function updateArchiveUI() {
  db.collection("households").doc("sara_rui").get().then(doc => {
    const votes = doc.data().archiveVotes || { count: 0 };
    const hasVoted = localStorage.getItem("voted_archive");

    if (votes.count === 0) {
      btn.className = "btn"; btn.textContent = "📁 Arquivar Contas";
      info.textContent = "Falta a aprovação dos dois";
      localStorage.removeItem("voted_archive");
    } else if (votes.count === 1) {
      btn.className = "btn waiting";
      btn.textContent = hasVoted ? "⏳ Aguardando o outro..." : "⚠️ Falta 1 aprovação!";
      info.textContent = hasVoted ? "Tu já aprovaste. Falta a outra pessoa." : "Uma pessoa já aprovou. Clica para confirmar.";
    }
  });
}

btn.onclick = () => {
  if (localStorage.getItem("voted_archive")) {
    alert("Tu já aprovaste! Agora a outra pessoa tem de clicar no telemóvel dela.");
    return;
  }

  db.collection("households").doc("sara_rui").get().then(doc => {
    let votes = doc.data().archiveVotes || { count: 0 };
    votes.count += 1;
    
    localStorage.setItem("voted_archive", "true"); // Marca este aparelho
    
    db.collection("households").doc("sara_rui").update({ archiveVotes: votes }).then(() => {
      if (votes.count >= 2) {
        doArchive();
      } else {
        updateArchiveUI();
      }
    });
  });
};

function doArchive() {
  info.textContent = "🚀 A arquivar tudo...";
  db.collection("households").doc("sara_rui").collection("expenses").get().then(snap => {
    let batch = db.batch();
    snap.docs.forEach(doc => {
      const hRef = db.collection("households").doc("sara_rui").collection("historico").doc();
      batch.set(hRef, {...doc.data(), archivedAt: new Date().toISOString()});
      batch.delete(doc.ref);
    });
    batch.commit().then(() => {
      db.collection("households").doc("sara_rui").update({ "archiveVotes.count": 0 });
      localStorage.removeItem("voted_archive");
      alert("✅ Contas enviadas para o histórico!");
      loadReport(7);
    });
  });
}

function loadReport(days) {
  db.collection("households").doc("sara_rui").collection("historico").get().then(snap => {
    let t=0, s=0, r=0, c=0; const limit = days > 0 ? new Date(Date.now() - days*86400000).toISOString().slice(0,10) : "0";
    snap.forEach(doc => { const d = doc.data(); if(d.date >= limit){ t+=d.amount; if(d.payer=='Sara') s+=d.amount; else r+=d.amount; c++; }});
    document.getElementById("report-total").textContent = t.toFixed(0)+"€";
    document.getElementById("report-sara").textContent = s.toFixed(0)+"€";
    document.getElementById("report-rui").textContent = r.toFixed(0)+"€";
    document.getElementById("report-avg").textContent = (t/(days||30)).toFixed(1)+"€";
  });
}

function deleteExp(id) { if(confirm("Apagar?")) db.collection("households").doc("sara_rui").collection("expenses").doc(id).delete(); }

document.addEventListener("DOMContentLoaded", () => {
  loadExpenses(); loadReport(7); updateArchiveUI();
  document.getElementById("expenseForm").onsubmit = (e) => {
    e.preventDefault();
    db.collection("households").doc("sara_rui").collection("expenses").add({
      payer: document.getElementById("payer").value,
      amount: parseFloat(document.getElementById("amount").value),
      description: document.getElementById("description").value,
      date: new Date().toISOString().slice(0, 10)
    }).then(() => e.target.reset());
  };
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); loadReport(parseInt(b.dataset.days));
    };
  });
});
