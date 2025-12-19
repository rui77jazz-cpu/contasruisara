
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
  var parts = isoDate.split('-');
  return parts[2] + '/' + parts[1];
}

function getDateDaysAgo(days) {
  var date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

// Renderizar despesa ativa
function renderExpense(doc) {
  var e = doc.data();
  var item = document.createElement("div");
  item.className = "expense-item";

  var emoji = e.payer === 'Sara' ? '👩' : '👨';

  item.innerHTML = 
    '<div class="info">' +
      '<span class="payer">' + emoji + ' ' + e.payer + '</span>' +
      '<span class="desc">' + (e.description || '') + ' · ' + formatDate(e.date) + '</span>' +
    '</div>' +
    '<div class="right">' +
      '<span class="amount">' + (e.amount || 0).toFixed(2) + ' €</span>' +
      '<button class="delete-btn" data-id="' + doc.id + '">🗑️</button>' +
    '</div>';

  item.querySelector('.delete-btn').addEventListener('click', function() {
    deleteExpense(doc.id);
  });
  return item;
}

// Atualizar saldo
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
  } else if (totalSara > totalRui) {
    var diff = (totalSara - totalRui) / 2;
    settlementsEl.className = "settlement pay";
    settlementsEl.innerHTML = '👨 Rui deve <strong>' + diff.toFixed(2) + ' €</strong> a 👩 Sara';
  } else {
    var diff = (totalRui - totalSara) / 2;
    settlementsEl.className = "settlement pay";
    settlementsEl.innerHTML = '👩 Sara deve <strong>' + diff.toFixed(2) + ' €</strong> a 👨 Rui';
  }
}

// --- CRUD ---

function addExpense(payer, amount, date, description) {
  return db.collection("households").doc("sara_rui").collection("expenses").add({
    payer: payer,
    amount: amount,
    date: date,
    description: description
  });
}

function deleteExpense(expenseId) {
  if (!confirm("Apagar esta despesa?")) return;
  
  db.collection("households").doc("sara_rui").collection("expenses").doc(expenseId).delete()
    .then(function() {
      loadExpenses();
    })
    .catch(function(error) {
      alert("Erro ao apagar: " + error.message);
    });
}

// --- Sistema de Dupla Aprovação ---

function loadArchiveVotes() {
  return db.collection("households").doc("sara_rui").get()
    .then(function(doc) {
      if (doc.exists && doc.data().archiveVotes) {
        return doc.data().archiveVotes;
      }
      return { sara: false, rui: false };
    })
    .catch(function() {
      return { sara: false, rui: false };
    });
}

function updateArchiveButtons(votes) {
  var saraBtn = document.getElementById("archiveSara");
  var ruiBtn = document.getElementById("archiveRui");
  var statusEl = document.getElementById("archive-status");

  if (votes.sara) {
    saraBtn.classList.add("approved");
    saraBtn.textContent = "👩 Sara ✓";
  } else {
    saraBtn.classList.remove("approved");
    saraBtn.textContent = "👩 Sara aprova";
  }

  if (votes.rui) {
    ruiBtn.classList.add("approved");
    ruiBtn.textContent = "👨 Rui ✓";
  } else {
    ruiBtn.classList.remove("approved");
    ruiBtn.textContent = "👨 Rui aprova";
  }

  if (votes.sara && votes.rui) {
    statusEl.textContent = "✅ Ambos aprovaram! A arquivar...";
  } else if (votes.sara) {
    statusEl.textContent = "⏳ A aguardar aprovação do Rui...";
  } else if (votes.rui) {
    statusEl.textContent = "⏳ A aguardar aprovação da Sara...";
  } else {
    statusEl.textContent = "";
  }
}

function voteToArchive(person) {
  var voteField = person === 'Sara' ? 'archiveVotes.sara' : 'archiveVotes.rui';
  
  // Atualizar voto no Firestore
  var updateData = {};
  updateData[voteField] = true;
  
  db.collection("households").doc("sara_rui").set(updateData, { merge: true })
    .then(function() {
      return loadArchiveVotes();
    })
    .then(function(votes) {
      updateArchiveButtons(votes);
      
      // Se ambos aprovaram, arquivar
      if (votes.sara && votes.rui) {
        doArchive();
      }
    })
    .catch(function(error) {
      alert("Erro: " + error.message);
    });
}

function resetArchiveVotes() {
  return db.collection("households").doc("sara_rui").set({
    archiveVotes: { sara: false, rui: false }
  }, { merge: true });
}

function doArchive() {
  var statusEl = document.getElementById("archive-status");
  statusEl.textContent = "📁 A arquivar...";

  db.collection("households").doc("sara_rui").collection("expenses").get()
    .then(function(snap) {
      if (snap.empty) {
        statusEl.textContent = "Não há despesas para arquivar.";
        return resetArchiveVotes();
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
        return count;
      });
    })
    .then(function(count) {
      if (count) {
        alert("✅ " + count + " despesa(s) arquivada(s)!");
      }
      return resetArchiveVotes();
    })
    .then(function() {
      loadExpenses();
      loadArchiveVotes().then(updateArchiveButtons);
      
      var activeTab = document.querySelector('.tab-btn.active');
      if (activeTab) {
        loadReport(parseInt(activeTab.getAttribute('data-days')));
      }
    })
    .catch(function(error) {
      statusEl.textContent = "Erro: " + error.message;
    });
}

function loadExpenses() {
  var list = document.getElementById("list");
  var status = document.getElementById("loading-status");
  list.innerHTML = "";
  status.textContent = "A carregar...";

  db.collection("households").doc("sara_rui").collection("expenses")
    .orderBy("date", "desc")
    .get()
    .then(function(snap) {
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
      status.textContent = "Erro: " + error.message;
    });
}

// --- Relatórios ---

function loadReport(days) {
  var status = document.getElementById("report-status");
  status.textContent = "A carregar...";

  db.collection("households").doc("sara_rui").collection("historico")
    .get()
    .then(function(snap) {
      if (snap.empty) {
        status.textContent = "Sem dados";
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
        
        if (data.date >= startDate) {
          historyData.push(data);
          var amt = data.amount || 0;
          total += amt;
          if (data.payer === 'Sara') totalSara += amt;
          else totalRui += amt;
        }
      });

      if (historyData.length === 0) {
        status.textContent = "Sem dados neste período";
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
      
      status.textContent = historyData.length + " registo(s)";
    })
    .catch(function(error) {
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
  var form = document.getElementById("expenseForm");
  
  if (form) {
    form.addEventListener("submit", function(ev) {
      ev.preventDefault();

      var payerEl = document.getElementById("payer");
      var amountEl = document.getElementById("amount");
      var descriptionEl = document.getElementById("description");
      
      var payer = payerEl.value;
      var amountValue = parseFloat(amountEl.value);
      var amount = Math.round(amountValue * 100) / 100;
      var description = descriptionEl.value.trim();
      var date = new Date().toISOString().slice(0, 10);

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
          form.reset();
          payerEl.value = "";
          return loadExpenses();
        })
        .then(function() {
          status.textContent = "✅ Guardado!";
        })
        .catch(function(error) {
          status.textContent = "Erro: " + error.message;
          alert("Erro ao guardar: " + error.message);
        });
    });
  }

  // Botões de arquivar
  document.getElementById("archiveSara").addEventListener("click", function() {
    voteToArchive('Sara');
  });
  
  document.getElementById("archiveRui").addEventListener("click", function() {
    voteToArchive('Rui');
  });

  // Tabs do relatório
  var tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      tabBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var days = parseInt(btn.getAttribute('data-days'));
      loadReport(days);
    });
  });

  // Carregar dados iniciais
  loadExpenses();
  loadReport(7);
  
  // Carregar estado dos votos de arquivamento
  loadArchiveVotes().then(updateArchiveButtons);
});
