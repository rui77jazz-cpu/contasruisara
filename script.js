
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

// Referência ao documento principal
const householdRef = db.collection("households").doc("sara_rui");

// --- ELEMENTOS ---
const saraBtn = document.getElementById("archiveSara");
const ruiBtn = document.getElementById("archiveRui");
const statusEl = document.getElementById("archive-status");

// --- ESCUTAR VOTOS EM TEMPO REAL ---
householdRef.onSnapshot(function(doc) {
  const data = doc.data() || {};
  const votes = data.archiveVotes || { sara: false, rui: false };
  
  updateArchiveUI(votes);
});

function updateArchiveUI(votes) {
  // Botão Sara
  if (votes.sara) {
    saraBtn.classList.add("approved");
    saraBtn.innerHTML = "👩 Sara ✓";
  } else {
    saraBtn.classList.remove("approved");
    saraBtn.classList.remove("done");
    saraBtn.innerHTML = "👩 Sara";
  }
  
  // Botão Rui
  if (votes.rui) {
    ruiBtn.classList.add("approved");
    ruiBtn.innerHTML = "👨 Rui ✓";
  } else {
    ruiBtn.classList.remove("approved");
    ruiBtn.classList.remove("done");
    ruiBtn.innerHTML = "👨 Rui";
  }
  
  // Mensagem de status
  if (votes.sara && votes.rui) {
    statusEl.style.display = "block";
    statusEl.className = "archive-status success";
    statusEl.innerHTML = "✅ Ambos aprovaram! A arquivar...";
  } else if (votes.sara) {
    statusEl.style.display = "block";
    statusEl.className = "archive-status waiting";
    statusEl.innerHTML = "⏳ 👩 Sara já aprovou. Falta o Rui!";
  } else if (votes.rui) {
    statusEl.style.display = "block";
    statusEl.className = "archive-status waiting";
    statusEl.innerHTML = "⏳ 👨 Rui já aprovou. Falta a Sara!";
  } else {
    statusEl.style.display = "none";
  }
}

// --- VOTAR ---
saraBtn.onclick = function() {
  householdRef.get().then(function(doc) {
    const data = doc.data() || {};
    const votes = data.archiveVotes || { sara: false, rui: false };
    
    if (votes.sara) {
      alert("👩 Sara já aprovou! Aguarda o Rui.");
      return;
    }
    
    votes.sara = true;
    householdRef.set({ archiveVotes: votes }, { merge: true }).then(function() {
      checkAndArchive(votes);
    });
  });
};

ruiBtn.onclick = function() {
  householdRef.get().then(function(doc) {
    const data = doc.data() || {};
    const votes = data.archiveVotes || { sara: false, rui: false };
    
    if (votes.rui) {
      alert("👨 Rui já aprovou! Aguarda a Sara.");
      return;
    }
    
    votes.rui = true;
    householdRef.set({ archiveVotes: votes }, { merge: true }).then(function() {
      checkAndArchive(votes);
    });
  });
};

function checkAndArchive(votes) {
  if (votes.sara && votes.rui) {
    // Ambos aprovaram - mudar para verde e arquivar
    saraBtn.classList.add("done");
    ruiBtn.classList.add("done");
    
    setTimeout(function() {
      doArchive();
    }, 1500);
  }
}

function doArchive() {
  householdRef.collection("expenses").get().then(function(snap) {
    if (snap.empty) {
      alert("Não há despesas para arquivar.");
      resetVotes();
      return;
    }
    
    const batch = db.batch();
    let count = 0;
    const archivedAt = new Date().toISOString();
    
    snap.docs.forEach(function(doc) {
      const data = doc.data();
      const histRef = householdRef.collection("historico").doc();
      batch.set(histRef, {
        payer: data.payer,
        amount: data.amount,
        date: data.date,
        description: data.description,
        archivedAt: archivedAt
      });
      batch.delete(doc.ref);
      count++;
    });
    
    batch.commit().then(function() {
      alert("✅ " + count + " despesa(s) arquivada(s)!");
      resetVotes();
      loadReport();
    }).catch(function(error) {
      alert("Erro ao arquivar: " + error.message);
      resetVotes();
    });
  });
}

function resetVotes() {
  householdRef.set({ archiveVotes: { sara: false, rui: false } }, { merge: true });
}

// --- DESPESAS EM TEMPO REAL ---
householdRef.collection("expenses").orderBy("date", "desc").onSnapshot(function(snap) {
  const list = document.getElementById("list");
  list.innerHTML = "";
  
  let totalSara = 0, totalRui = 0, total = 0;
  
  snap.forEach(function(doc) {
    const e = doc.data();
    total += e.amount || 0;
    if (e.payer === "Sara") totalSara += e.amount || 0;
    else totalRui += e.amount || 0;
    
    const emoji = e.payer === "Sara" ? "👩" : "👨";
    const date = e.date ? e.date.split("-").slice(1).reverse().join("/") : "";
    
    const div = document.createElement("div");
    div.className = "expense-item";
    div.innerHTML = 
      '<div class="info">' +
        '<span class="payer">' + emoji + ' ' + e.payer + '</span>' +
        '<span class="desc">' + (e.description || '') + ' · ' + date + '</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px">' +
        '<span class="amount">' + (e.amount || 0).toFixed(2) + ' €</span>' +
        '<button onclick="deleteExpense(\'' + doc.id + '\')">🗑️</button>' +
      '</div>';
    
    list.appendChild(div);
  });
  
  // Atualizar saldo
  document.getElementById("totalSum").textContent = total.toFixed(2);
  document.getElementById("balanceSara").textContent = totalSara.toFixed(2);
  document.getElementById("balanceRui").textContent = totalRui.toFixed(2);
  
  const settlementsEl = document.getElementById("settlements");
  const diff = Math.abs(totalSara - totalRui) / 2;
  
  if (total === 0 || diff < 0.01) {
    settlementsEl.className = "settlement even";
    settlementsEl.innerHTML = "✅ Tudo certo!";
  } else if (totalSara > totalRui) {
    settlementsEl.className = "settlement pay";
    settlementsEl.innerHTML = "👨 Rui deve <strong>" + diff.toFixed(2) + " €</strong> a 👩 Sara";
  } else {
    settlementsEl.className = "settlement pay";
    settlementsEl.innerHTML = "👩 Sara deve <strong>" + diff.toFixed(2) + " €</strong> a 👨 Rui";
  }
  
  // Mostrar contagem
  if (snap.empty) {
    list.innerHTML = '<p style="text-align:center;color:#64748b;padding:1rem">Sem despesas</p>';
  }
});

// --- APAGAR DESPESA ---
window.deleteExpense = function(id) {
  if (confirm("Apagar esta despesa?")) {
    householdRef.collection("expenses").doc(id).delete();
  }
};

// --- ADICIONAR DESPESA ---
document.getElementById("expenseForm").onsubmit = function(e) {
  e.preventDefault();
  
  const payer = document.getElementById("payer").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const description = document.getElementById("description").value.trim();
  const date = new Date().toISOString().slice(0, 10);
  
  if (!payer || !amount || !description) {
    alert("Preenche todos os campos");
    return;
  }
  
  householdRef.collection("expenses").add({
    payer: payer,
    amount: Math.round(amount * 100) / 100,
    description: description,
    date: date
  }).then(function() {
    e.target.reset();
  }).catch(function(error) {
    alert("Erro: " + error.message);
  });
};

// --- HISTÓRICO ---
document.getElementById("histToggle").onclick = function() {
  const section = document.getElementById("hist-section");
  if (section.style.display === "none" || section.style.display === "") {
    section.style.display = "block";
    this.textContent = "📜 Esconder Histórico";
    loadReport();
  } else {
    section.style.display = "none";
    this.textContent = "📜 Ver Histórico";
  }
};

function loadReport() {
  householdRef.collection("historico").get().then(function(snap) {
    let total = 0, totalSara = 0, totalRui = 0, count = 0;
    
    snap.forEach(function(doc) {
      const d = doc.data();
      total += d.amount || 0;
      if (d.payer === "Sara") totalSara += d.amount || 0;
      else totalRui += d.amount || 0;
      count++;
    });
    
    document.getElementById("report-total").textContent = total.toFixed(0) + " €";
    document.getElementById("report-sara").textContent = totalSara.toFixed(0) + " €";
    document.getElementById("report-rui").textContent = totalRui.toFixed(0) + " €";
    document.getElementById("report-avg").textContent = count > 0 ? (total / 30).toFixed(1) + " €" : "0 €";
  });
}
