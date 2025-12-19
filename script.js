
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

let expenses = [];

// --- Funções Auxiliares ---

function formatDate(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  return `${parts[2]}/${parts[1]}`;
}

function getDateDaysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

// Renderizar despesa ativa
function renderExpense(doc) {
  const e = doc.data();
  const item = document.createElement("div");
  item.className = "expense-item";

  const emoji = e.payer === 'Sara' ? '👩' : '👨';

  item.innerHTML = `
    <div class="info">
      <span class="payer">${emoji} ${e.payer}</span>
      <span class="desc">${e.description || ''} · ${formatDate(e.date)}</span>
    </div>
    <div class="right">
      <span class="amount">${(e.amount || 0).toFixed(2)} €</span>
      <button class="delete-btn" data-id="${doc.id}">🗑️</button>
    </div>
  `;

  item.querySelector('.delete-btn').addEventListener('click', function() {
    deleteExpense(doc.id);
  });
  return item;
}

// Renderizar item do histórico
function renderHistoryItem(data) {
  const item = document.createElement("div");
  item.className = "history-item";
  const emoji = data.payer === 'Sara' ? '👩' : '👨';

  item.innerHTML = `
    <div class="info"><strong>${emoji} ${data.payer}</strong> · ${data.description || ''} · ${formatDate(data.date)}</div>
    <span class="amount">${(data.amount || 0).toFixed(2)} €</span>
  `;
  return item;
}

// Atualizar saldo
function updateBalance(expensesList) {
  let totalSara = 0, totalRui = 0, total = 0;

  expensesList.forEach(function(e) {
    const amt = e.amount || 0;
    total += amt;
    if (e.payer === 'Sara') totalSara += amt;
    else totalRui += amt;
  });

  document.getElementById("balanceSara").textContent = totalSara.toFixed(2);
  document.getElementById("balanceRui").textContent = totalRui.toFixed(2);
  document.getElementById("totalSum").textContent = total.toFixed(2);

  const settlementsEl = document.getElementById("settlements");

  if (Math.abs(totalSara - totalRui) < 0.01) {
    settlementsEl.className = "settlement even";
    settlementsEl.innerHTML = "✅ Tudo certo!";
  } else if (totalSara > totalRui) {
    const diff = (totalSara - totalRui) / 2;
    settlementsEl.className = "settlement pay";
    settlementsEl.innerHTML = '👨 Rui deve <strong>' + diff.toFixed(2) + ' €</strong> a 👩 Sara';
  } else {
    const diff = (totalRui - totalSara) / 2;
    settlementsEl.className = "settlement pay";
    settlementsEl.innerHTML = '👩 Sara deve <strong>' + diff.toFixed(2) + ' €</strong> a 👨 Rui';
  }
}

// --- CRUD ---

function addExpense(payer, amount, date, description) {
  console.log("A guardar despesa:", payer, amount, date, description);
  
  return db.collection("households").doc("sara_rui").collection("expenses").add({
    payer: payer,
    amount: amount,
    date: date,
    description: description
  }).then(function(docRef) {
    console.log("Despesa guardada com ID:", docRef.id);
    return docRef;
  }).catch(function(error) {
    console.error("Erro ao guardar despesa:", error);
    throw error;
  });
}

function deleteExpense(expenseId) {
  if (!confirm("Apagar esta despesa?")) return;
  
  console.log("A apagar despesa:", expenseId);
  
  db.collection("households").doc("sara_rui").collection("expenses").doc(expenseId).delete()
    .then(function() {
      console.log("Despesa apagada");
      loadExpenses();
    })
    .catch(function(error) {
      console.error("Erro ao apagar:", error);
      alert("Erro ao apagar: " + error.message);
    });
}

function clearAllExpenses() {
  if (!confirm("📁 Arquivar todas as despesas?\n\nFicam guardadas no histórico.")) return;

  console.log("A arquivar despesas...");
  var status = document.getElementById("loading-status");
  status.textContent = "A arquivar...";

  db.collection("households").doc("sara_rui").collection("expenses").get()
    .then(function(snap) {
      if (snap.empty) {
        alert("Não há despesas para arquivar.");
        return Promise.resolve();
      }

      var batch = db.batch();
      var archivedAt = new Date().toISOString();
      var count = 0;

      snap.docs.forEach(function(doc) {
        var data = doc.data();
        var historyRef = db.collection("households").doc("sara_rui").collection("historico").doc();
        batch.set(historyRef, {
          payer: data.payer,
          amount: data.amount,
          date: data.date,
          description: data.description,
          archivedAt: archivedAt
        });
        batch.delete(doc.ref);
        count++;
      });

      return batch.commit().then(function() {
        alert("✅ " + count + " despesa(s) arquivada(s)!");
      });
    })
    .then(function() {
      loadExpenses();
      var activeTab = document.querySelector('.tab-btn.active');
      if (activeTab) {
        loadReport(parseInt(activeTab.getAttribute('data-days')));
      }
    })
    .catch(function(error) {
      console.error("Erro ao arquivar:", error);
      alert("Erro ao arquivar: " + error.message);
    });
}

function loadExpenses() {
  var list = document.getElementById("list");
  var status = document.getElementById("loading-status");
  list.innerHTML = "";
  status.textContent = "A carregar...";

  console.log("A carregar despesas...");

  db.collection("households").doc("sara_rui").collection("expenses")
    .orderBy("date", "desc")
    .get()
    .then(function(snap) {
      console.log("Despesas carregadas:", snap.size);
      expenses = [];
      
      snap.forEach(function(doc) {
        list.appendChild(renderExpense(doc));
        expenses.push(doc.data());
      });

      updateBalance(expenses);
      
      if (snap.empty) {
        status.textContent = "Sem despesas ativas";
      } else {
        status.textContent = snap.size + " despesa(s)";
      }
    })
    .catch(function(error) {
      console.error("Erro ao carregar despesas:", error);
      status.textContent = "Erro: " + error.message;
    });
}

// --- Relatórios ---

function loadReport(days) {
  var reportList = document.getElementById("report-list");
  var status = document.getElementById("report-status");

  reportList.innerHTML = "";
  status.textContent = "A carregar...";

  console.log("A carregar relatório para", days, "dias");

  // Buscar todos os dados do histórico e filtrar no cliente
  // (evita necessidade de índice composto no Firestore)
  db.collection("households").doc("sara_rui").collection("historico")
    .get()
    .then(function(snap) {
      console.log("Histórico carregado:", snap.size, "registos");

      if (snap.empty) {
        status.textContent = "Sem dados";
        reportList.innerHTML = '<div class="no-data">📭 Nada por aqui</div>';
        document.getElementById("report-total").textContent = "0 €";
        document.getElementById("report-sara").textContent = "0 €";
        document.getElementById("report-rui").textContent = "0 €";
        document.getElementById("report-avg").textContent = "0 €";
        return;
      }

      var startDate = days > 0 ? getDateDaysAgo(days) : "1900-01-01";
      var historyData = [];
      var total = 0, totalSara = 0, totalRui = 0;

      snap.forEach(function(doc) {
        var data = doc.data();
        
        // Filtrar por data
        if (data.date >= startDate) {
          historyData.push(data);
          var amt = data.amount || 0;
          total += amt;
          if (data.payer === 'Sara') totalSara += amt;
          else totalRui += amt;
        }
      });

      // Ordenar por data (mais recente primeiro)
      historyData.sort(function(a, b) {
        return (b.date || '').localeCompare(a.date || '');
      });

      if (historyData.length === 0) {
        status.textContent = "Sem dados neste período";
        reportList.innerHTML = '<div class="no-data">📭 Nada por aqui</div>';
        document.getElementById("report-total").textContent = "0 €";
        document.getElementById("report-sara").textContent = "0 €";
        document.getElementById("report-rui").textContent = "0 €";
        document.getElementById("report-avg").textContent = "0 €";
        return;
      }

      var diasPeriodo = days > 0 ? days : calcularDias(historyData);
      var media = diasPeriodo > 0 ? total / diasPeriodo : 0;

      document.getElementById("report-total").textContent = total.toFixed(0) + " €";
      document.getElementById("report-sara").textContent = totalSara.toFixed(0) + " €";
      document.getElementById("report-rui").textContent = totalRui.toFixed(0) + " €";
      document.getElementById("report-avg").textContent = media.toFixed(1) + " €";

      historyData.forEach(function(data) {
        reportList.appendChild(renderHistoryItem(data));
      });
      
      status.textContent = historyData.length + " registo(s)";
    })
    .catch(function(error) {
      console.error("Erro ao carregar relatório:", error);
      status.textContent = "Erro: " + error.message;
    });
}

function calcularDias(historyData) {
  if (historyData.length === 0) return 1;
  
  var datas = historyData.map(function(d) { 
    return new Date(d.date || '2000-01-01').getTime(); 
  });
  var maxDate = Math.max.apply(null, datas);
  var minDate = Math.min.apply(null, datas);
  var diff = Math.abs(maxDate - minDate);
  var dias = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return dias || 1;
}

// --- Init ---

document.addEventListener("DOMContentLoaded", function() {
  console.log("DOM carregado, a inicializar...");
  
  var form = document.getElementById("expenseForm");
  
  if (form) {
    form.addEventListener("submit", function(ev) {
      ev.preventDefault();
      console.log("Formulário submetido");

      var payerEl = document.getElementById("payer");
      var amountEl = document.getElementById("amount");
      var descriptionEl = document.getElementById("description");
      
      var payer = payerEl.value;
      var amountValue = parseFloat(amountEl.value);
      var amount = Math.round(amountValue * 100) / 100;
      var description = descriptionEl.value.trim();
      var date = new Date().toISOString().slice(0, 10);

      console.log("Valores:", payer, amount, description, date);

      if (!payer) {
        alert("Escolhe quem pagou");
        return;
      }
      if (isNaN(amount) || amount <= 0) {
        alert("Valor inválido");
        return;
      }
      if (!description) {
        alert("Adiciona uma descrição");
        return;
      }

      var status = document.getElementById("loading-status");
      status.textContent = "A guardar...";

      addExpense(payer, amount, date, description)
        .then(function() {
          console.log("Despesa adicionada com sucesso");
          form.reset();
          payerEl.value = "";
          return loadExpenses();
        })
        .then(function() {
          status.textContent = "✅ Guardado!";
        })
        .catch(function(error) {
          console.error("Erro:", error);
          status.textContent = "Erro: " + error.message;
          alert("Erro ao guardar: " + error.message);
        });
    });
  } else {
    console.error("Formulário não encontrado!");
  }

  var clearBtn = document.getElementById("clearAllBtn");
  if (clearBtn) {
    clearBtn.addEventListener("click", clearAllExpenses);
  }

  var tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      tabBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var days = parseInt(btn.getAttribute('data-days'));
      console.log("Tab clicado:", days, "dias");
      loadReport(days);
    });
  });

  // Carregar dados iniciais
  loadExpenses();
  loadReport(7);
});
