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

// --- Funções de Interface ---
function formatDate(isoDate) {
  if (!isoDate) return '';
  var parts = isoDate.split('-');
  return parts[2] + '/' + parts[1];
}

function getDateDaysAgo(days) {
  var date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function renderExpense(doc) {
  var e = doc.data();
  var item = document.createElement("div");
  item.className = "expense-item";
  var emoji = e.payer === 'Sara' ? '👩' : '👨';
  item.innerHTML = `
    <div class="info">
      <span class="payer">${emoji} ${e.payer}</span>
      <span class="desc">${e.description || ''} · ${formatDate(e.date)}</span>
    </div>
    <div class="right">
      <span class="amount">${(e.amount || 0).toFixed(2)} €</span>
      <button class="delete-btn" onclick="deleteExpense('${doc.id}')">🗑️</button>
    </div>`;
  return item;
}

// --- Lógica de Negócio ---
function updateBalance(expensesList) {
  var totalSara = 0, totalRui = 0, total = 0;
  expensesList.forEach(function(e) {
    var amt = e.amount || 0;
    total += amt;
    if (e.payer === 'Sara') totalSara += amt;
    else totalRui += amt;
  });

  document.getElementById("balanceSara").textContent = totalSara.toFixed(2);
  document.getElementById("balanceRui").textContent = totalRui.toFixed(2);
  document.getElementById("totalSum").textContent = total.toFixed(2);

  var settlementsEl = document.getElementById("settlements");
  if (Math.abs(totalSara - totalRui) < 0.01) {
    settlementsEl.className = "settlement even";
    settlementsEl.innerHTML = "✅ Tudo certo!";
  } else {
    var diff = Math.abs(totalSara - totalRui) / 2;
    var devedor = totalSara > totalRui ? "👨 Rui deve" : "👩 Sara deve";
    var credor = totalSara > totalRui ? "👩 Sara" : "👨 Rui";
    settlementsEl.className = "settlement pay";
    settlementsEl.innerHTML = `${devedor} <strong>${diff.toFixed(2)} €</strong> a ${credor}`;
  }
}

// --- Votos e Arquivo ---
function voteToArchive(person) {
  const btnId = person === 'Sara' ? "archiveSara" : "archiveRui";
  const btn = document.getElementById(btnId);
  
  // Feedback visual imediato
  btn.classList.add("approved");
  btn.textContent = (person === 'Sara' ? "👩" : "👨") + " ✓";
  
  var updateData = {};
  updateData[`archiveVotes.${person.toLowerCase()}`] = true;

  db.collection("households").doc("sara_rui").update(updateData)
    .then(() => {
      checkVotesAndArchive();
    })
    .catch(err => console.error("Erro ao votar:", err));
}

function checkVotesAndArchive() {
  db.collection("households").doc("sara_rui").get().then(doc => {
    const votes = doc.data().archiveVotes || { sara: false, rui: false };
    
    // Atualiza status visual
    if (votes.sara) document.getElementById("archiveSara").classList.add("approved");
    if (votes.rui) document.getElementById("archiveRui").classList.add("approved");

    if (votes.sara && votes.rui) {
      doArchive();
    }
  });
}

function doArchive() {
  const statusEl = document.getElementById("archive-status");
  statusEl.textContent = "📁 A arquivar despesas...";

  db.collection("households").doc("sara_rui").collection("expenses").get().then(snap => {
    if (snap.empty) return resetVotes();

    var batch = db.batch();
    snap.docs.forEach(doc => {
      var historyRef = db.collection("households").doc("sara_rui").collection("historico").doc();
      batch.set(historyRef, {...doc.data(), archivedAt: new Date().toISOString()});
      batch.delete(doc.ref);
    });

    batch.commit().then(() => {
      alert("✅ Despesas arquivadas com sucesso!");
      resetVotes();
      loadExpenses();
      loadReport(7);
    });
  });
}

function resetVotes() {
  db.collection("households").doc("sara_rui").update({
    "archiveVotes.sara": false,
    "archiveVotes.rui": false
  }).then(() => {
    document.getElementById("archiveSara").classList.remove("approved");
    document.getElementById("archiveRui").classList.remove("approved");
    document.getElementById("archiveSara").textContent = "👩 Sara aprova";
    document.getElementById("archiveRui").textContent = "👨 Rui aprova";
    document.getElementById("archive-status").textContent = "";
  });
}

// --- Carregamento de Dados ---
function loadExpenses() {
  const list = document.getElementById("list");
  db.collection("households").doc("sara_rui").collection("expenses").orderBy("date", "desc").onSnapshot(snap => {
    list.innerHTML = "";
    let currentExpenses = [];
    snap.forEach(doc => {
      list.appendChild(renderExpense(doc));
      currentExpenses.push(doc.data());
    });
    updateBalance(currentExpenses);
    document.getElementById("loading-status").textContent = snap.empty ? "Sem despesas" : "";
  });
}

function loadReport(days) {
  db.collection("households").doc("sara_rui").collection("historico").get().then(snap => {
    let total = 0, sara = 0, rui = 0;
    const limitDate = days > 0 ? getDateDaysAgo(days) : "1900-01-01";
    let count = 0;

    snap.forEach(doc => {
      const data = doc.data();
      if (data.date >= limitDate) {
        total += data.amount;
        if (data.payer === 'Sara') sara += data.amount;
        else rui += data.amount;
        count++;
      }
    });

    document.getElementById("report-total").textContent = total.toFixed(0) + " €";
    document.getElementById("report-sara").textContent = sara.toFixed(0) + " €";
    document.getElementById("report-rui").textContent = rui.toFixed(0) + " €";
    document.getElementById("report-avg").textContent = count > 0 ? (total / (days || 30)).toFixed(1) + " €" : "0 €";
  });
}

// --- Inicialização ---
document.addEventListener("DOMContentLoaded", () => {
  loadExpenses();
  loadReport(7);
  checkVotesAndArchive();

  document.getElementById("expenseForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {
      payer: document.getElementById("payer").value,
      amount: parseFloat(document.getElementById("amount").value),
      description: document.getElementById("description").value,
      date: new Date().toISOString().slice(0, 10)
    };
    db.collection("households").doc("sara_rui").collection("expenses").add(data).then(() => {
      e.target.reset();
    });
  });

  document.getElementById("archiveSara").onclick = () => voteToArchive('Sara');
  document.getElementById("archiveRui").onclick = () => voteToArchive('Rui');

  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      loadReport(parseInt(btn.dataset.days));
    };
  });
});

function deleteExpense(id) {
  if(confirm("Apagar despesa?")) {
    db.collection("households").doc("sara_rui").collection("expenses").doc(id).delete();
  }
}
