// --- Firebase Config ---
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

// --- Auxiliares ---
function formatDate(isoDate) {
  if (!isoDate) return '';
  var p = isoDate.split('-'); return p[2] + '/' + p[1];
}

function getDateDaysAgo(days) {
  var d = new Date(); d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// --- Funções Principais ---
function loadExpenses() {
  db.collection("households").doc("sara_rui").collection("expenses").orderBy("date", "desc").onSnapshot(snap => {
    const list = document.getElementById("list");
    list.innerHTML = "";
    let totalSara = 0, totalRui = 0, total = 0;

    snap.forEach(doc => {
      const e = doc.data();
      total += e.amount;
      if (e.payer === 'Sara') totalSara += e.amount; else totalRui += e.amount;

      const div = document.createElement("div");
      div.className = "expense-item";
      div.innerHTML = `
        <div><strong>${e.payer === 'Sara'?'👩':'👨'} ${e.description}</strong><br><small>${formatDate(e.date)}</small></div>
        <div>${e.amount.toFixed(2)}€ <button onclick="deleteExpense('${doc.id}')">🗑️</button></div>
      `;
      list.appendChild(div);
    });

    document.getElementById("totalSum").textContent = total.toFixed(2);
    document.getElementById("balanceSara").textContent = totalSara.toFixed(2);
    document.getElementById("balanceRui").textContent = totalRui.toFixed(2);

    const sett = document.getElementById("settlements");
    const diff = Math.abs(totalSara - totalRui) / 2;
    if (diff < 0.01) {
      sett.className = "settlement even"; sett.textContent = "✅ Tudo certo!";
    } else {
      sett.className = "settlement pay";
      sett.innerHTML = totalSara > totalRui ? `👨 Rui deve <strong>${diff.toFixed(2)}€</strong> a 👩 Sara` : `👩 Sara deve <strong>${diff.toFixed(2)}€</strong> a 👨 Rui`;
    }
  });
}

function voteToArchive(person) {
  const btn = document.getElementById(person === 'Sara' ? "archiveSara" : "archiveRui");
  btn.classList.add("approved");
  btn.textContent = (person === 'Sara' ? "👩" : "👨") + " ✓";

  let data = {}; data[`archiveVotes.${person.toLowerCase()}`] = true;
  db.collection("households").doc("sara_rui").update(data).then(() => {
    checkVotes();
  });
}

function checkVotes() {
  db.collection("households").doc("sara_rui").get().then(doc => {
    const v = doc.data().archiveVotes || {sara:false, rui:false};
    if (v.sara) document.getElementById("archiveSara").classList.add("approved");
    if (v.rui) document.getElementById("archiveRui").classList.add("approved");
    
    if (v.sara && v.rui) {
      document.getElementById("archive-status").textContent = "📁 A arquivar...";
      doArchive();
    }
  });
}

function doArchive() {
  db.collection("households").doc("sara_rui").collection("expenses").get().then(snap => {
    if (snap.empty) return resetVotes();
    let batch = db.batch();
    snap.docs.forEach(doc => {
      const hRef = db.collection("households").doc("sara_rui").collection("historico").doc();
      batch.set(hRef, {...doc.data(), archivedAt: new Date().toISOString()});
      batch.delete(doc.ref);
    });
    batch.commit().then(() => {
      alert("✅ Arquivado!");
      resetVotes();
      loadReport(7);
    });
  });
}

function resetVotes() {
  db.collection("households").doc("sara_rui").update({"archiveVotes.sara":false, "archiveVotes.rui":false}).then(() => {
    document.getElementById("archiveSara").classList.remove("approved");
    document.getElementById("archiveRui").classList.remove("approved");
    document.getElementById("archiveSara").textContent = "👩 Sara aprova";
    document.getElementById("archiveRui").textContent = "👨 Rui aprova";
    document.getElementById("archive-status").textContent = "";
  });
}

function loadReport(days) {
  db.collection("households").doc("sara_rui").collection("historico").get().then(snap => {
    let t = 0, s = 0, r = 0, count = 0;
    const limit = days > 0 ? getDateDaysAgo(days) : "1900-01-01";
    snap.forEach(doc => {
      const d = doc.data();
      if (d.date >= limit) { t += d.amount; if (d.payer === 'Sara') s += d.amount; else r += d.amount; count++; }
    });
    document.getElementById("report-total").textContent = t.toFixed(0) + "€";
    document.getElementById("report-sara").textContent = s.toFixed(0) + "€";
    document.getElementById("report-rui").textContent = r.toFixed(0) + "€";
    document.getElementById("report-avg").textContent = (t / (days || 30)).toFixed(1) + "€";
  });
}

function deleteExpense(id) { if(confirm("Apagar?")) db.collection("households").doc("sara_rui").collection("expenses").doc(id).delete(); }

// --- Init ---
document.addEventListener("DOMContentLoaded", () => {
  loadExpenses(); loadReport(7); checkVotes();
  document.getElementById("expenseForm").onsubmit = (e) => {
    e.preventDefault();
    db.collection("households").doc("sara_rui").collection("expenses").add({
      payer: document.getElementById("payer").value,
      amount: parseFloat(document.getElementById("amount").value),
      description: document.getElementById("description").value,
      date: new Date().toISOString().slice(0, 10)
    }).then(() => e.target.reset());
  };
  document.getElementById("archiveSara").onclick = () => voteToArchive('Sara');
  document.getElementById("archiveRui").onclick = () => voteToArchive('Rui');
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(x => x.classList.remove('active'));
      b.classList.add('active'); loadReport(parseInt(b.dataset.days));
    };
  });
});
