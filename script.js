
// --- Firebase Config ---
var firebaseConfig = {
  apiKey: "AIzaSyCle9Kx3OVD7mnZfXubKyIGW6COYrGI304",
  authDomain: "contassararui.firebaseapp.com",
  projectId: "contassararui",
  storageBucket: "contassararui.firebasestorage.app",
  messagingSenderId: "760330070358",
  appId: "1:760330070358:web:5d1f213133bfdbe902cef7"
};

firebase.initializeApp(firebaseConfig);
var db = firebase.firestore();
var householdRef = db.collection("households").doc("sara_rui");

// --- ID DO APARELHO ---
function getDeviceId() {
  var id = localStorage.getItem("myDeviceId");
  if (!id) {
    id = "device_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
    localStorage.setItem("myDeviceId", id);
  }
  return id;
}
var myDeviceId = getDeviceId();

// --- APAGAR DESPESA ---
window.deleteExpense = function(id) {
  if (confirm("Apagar esta despesa?")) {
    householdRef.collection("expenses").doc(id).delete();
  }
};

// --- DATA ---
function getDateDaysAgo(days) {
  var d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

// --- ESPERAR PELO DOM ---
document.addEventListener("DOMContentLoaded", function() {
  
  var saraBtn = document.getElementById("archiveSara");
  var ruiBtn = document.getElementById("archiveRui");
  var statusEl = document.getElementById("archive-status");
  var currentPeriod = 7;
  
  // --- OUVIR MUDANÇAS EM TEMPO REAL ---
  householdRef.onSnapshot(function(doc) {
    var data = doc.data() || {};
    var votes = data.archiveVotes || {};
    
    var saraVotou = votes.sara ? true : false;
    var ruiVotou = votes.rui ? true : false;
    
    // RESETAR CLASSES
    saraBtn.className = "archive-btn";
    ruiBtn.className = "archive-btn";
    statusEl.className = "archive-status";
    
    // ATUALIZAR BOTÃO SARA
    if (saraVotou) {
      saraBtn.classList.add("voted");
      saraBtn.innerHTML = "👩 Sara ✓";
    } else {
      saraBtn.innerHTML = "👩 Sara";
    }
    
    // ATUALIZAR BOTÃO RUI
    if (ruiVotou) {
      ruiBtn.classList.add("voted");
      ruiBtn.innerHTML = "👨 Rui ✓";
    } else {
      ruiBtn.innerHTML = "👨 Rui";
    }
    
    // MENSAGEM DE STATUS
    if (saraVotou && ruiVotou) {
      saraBtn.classList.remove("voted");
      saraBtn.classList.add("done");
      ruiBtn.classList.remove("voted");
      ruiBtn.classList.add("done");
      statusEl.classList.add("success");
      statusEl.innerHTML = "✅ Ambos aprovaram! A arquivar...";
    } else if (saraVotou) {
      statusEl.classList.add("waiting");
      statusEl.innerHTML = "⏳ 👩 Sara aprovou. Falta o 👨 Rui!";
    } else if (ruiVotou) {
      statusEl.classList.add("waiting");
      statusEl.innerHTML = "⏳ 👨 Rui aprovou. Falta a 👩 Sara!";
    }
  });

  // --- CLIQUE SARA ---
  saraBtn.onclick = function() {
    householdRef.get().then(function(doc) {
      var data = doc.data() || {};
      var votes = data.archiveVotes || {};
      
      // Já votou como Sara?
      if (votes.sara) {
        alert("👩 Sara já votou!");
        return;
      }
      
      // Este aparelho já votou como Rui?
      if (votes.ruiDevice === myDeviceId) {
        alert("⚠️ Este aparelho já votou como Rui!\nUsa outro aparelho para votar como Sara.");
        return;
      }
      
      // Votar
      householdRef.set({
        archiveVotes: {
          sara: true,
          saraDevice: myDeviceId,
          rui: votes.rui || false,
          ruiDevice: votes.ruiDevice || null
        }
      }, { merge: true }).then(function() {
        // Verificar se ambos votaram
        if (votes.rui) {
          setTimeout(doArchive, 1500);
        }
      });
    });
  };

  // --- CLIQUE RUI ---
  ruiBtn.onclick = function() {
    householdRef.get().then(function(doc) {
      var data = doc.data() || {};
      var votes = data.archiveVotes || {};
      
      // Já votou como Rui?
      if (votes.rui) {
        alert("👨 Rui já votou!");
        return;
      }
      
      // Este aparelho já votou como Sara?
      if (votes.saraDevice === myDeviceId) {
        alert("⚠️ Este aparelho já votou como Sara!\nUsa outro aparelho para votar como Rui.");
        return;
      }
      
      // Votar
      householdRef.set({
        archiveVotes: {
          rui: true,
          ruiDevice: myDeviceId,
          sara: votes.sara || false,
          saraDevice: votes.saraDevice || null
        }
      }, { merge: true }).then(function() {
        // Verificar se ambos votaram
        if (votes.sara) {
          setTimeout(doArchive, 1500);
        }
      });
    });
  };

  // --- ARQUIVAR ---
  function doArchive() {
    householdRef.collection("expenses").get().then(function(snap) {
      if (snap.empty) {
        alert("Não há despesas para arquivar.");
        resetVotes();
        return;
      }
      
      var batch = db.batch();
      var count = 0;
      var now = new Date().toISOString();
      
      snap.docs.forEach(function(doc) {
        var d = doc.data();
        var histRef = householdRef.collection("historico").doc();
        batch.set(histRef, {
          payer: d.payer,
          amount: d.amount,
          date: d.date,
          description: d.description,
          archivedAt: now
        });
        batch.delete(doc.ref);
        count++;
      });
      
      batch.commit().then(function() {
        alert("✅ " + count + " despesa(s) arquivada(s)!");
        resetVotes();
        loadReport(currentPeriod);
      });
    });
  }

  function resetVotes() {
    householdRef.set({
      archiveVotes: {
        sara: false,
        saraDevice: null,
        rui: false,
        ruiDevice: null
      }
    }, { merge: true });
  }

  // --- DESPESAS EM TEMPO REAL ---
  householdRef.collection("expenses").orderBy("date", "desc").onSnapshot(function(snap) {
    var list = document.getElementById("list");
    list.innerHTML = "";
    
    var totalSara = 0, totalRui = 0, total = 0;
    
    snap.forEach(function(doc) {
      var e = doc.data();
      total += e.amount || 0;
      if (e.payer === "Sara") totalSara += e.amount || 0;
      else totalRui += e.amount || 0;
      
      var emoji = e.payer === "Sara" ? "👩" : "👨";
      var date = e.date ? e.date.split("-").slice(1).reverse().join("/") : "";
      
      var div = document.createElement("div");
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
    
    document.getElementById("totalSum").textContent = total.toFixed(2);
    document.getElementById("balanceSara").textContent = totalSara.toFixed(2);
    document.getElementById("balanceRui").textContent = totalRui.toFixed(2);
    
    var settlementsEl = document.getElementById("settlements");
    var diff = Math.abs(totalSara - totalRui) / 2;
    
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
    
    if (snap.empty) {
      list.innerHTML = '<p style="text-align:center;color:#64748b;padding:1rem">Sem despesas</p>';
    }
  });

  // --- FORMULÁRIO ---
  document.getElementById("expenseForm").onsubmit = function(e) {
    e.preventDefault();
    
    var payer = document.getElementById("payer").value;
    var amount = parseFloat(document.getElementById("amount").value);
    var description = document.getElementById("description").value.trim();
    var date = new Date().toISOString().slice(0, 10);
    
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
    });
  };

  // --- HISTÓRICO ---
  document.getElementById("histToggle").onclick = function() {
    var section = document.getElementById("hist-section");
    if (section.style.display === "none" || section.style.display === "") {
      section.style.display = "block";
      this.textContent = "📜 Esconder Histórico";
      loadReport(currentPeriod);
    } else {
      section.style.display = "none";
      this.textContent = "📜 Ver Histórico";
    }
  };

  // --- TABS ---
  var tabs = document.querySelectorAll(".period-tab");
  tabs.forEach(function(tab) {
    tab.onclick = function() {
      tabs.forEach(function(t) { t.classList.remove("active"); });
      tab.classList.add("active");
      currentPeriod = parseInt(tab.getAttribute("data-days"));
      loadReport(currentPeriod);
    };
  });

  function loadReport(days) {
    householdRef.collection("historico").get().then(function(snap) {
      var total = 0, totalSara = 0, totalRui = 0, count = 0;
      var startDate = days > 0 ? getDateDaysAgo(days) : "1900-01-01";
      
      snap.forEach(function(doc) {
        var d = doc.data();
        if (d.date >= startDate) {
          total += d.amount || 0;
          if (d.payer === "Sara") totalSara += d.amount || 0;
          else totalRui += d.amount || 0;
          count++;
        }
      });
      
      var avg = days > 0 ? (total / days) : (count > 0 ? (total / 30) : 0);
      
      document.getElementById("report-total").textContent = total.toFixed(0) + " €";
      document.getElementById("report-sara").textContent = totalSara.toFixed(0) + " €";
      document.getElementById("report-rui").textContent = totalRui.toFixed(0) + " €";
      document.getElementById("report-avg").textContent = avg.toFixed(1) + " €";
      document.getElementById("report-period").textContent = 
        days === 0 ? count + " despesa(s) total" : count + " despesa(s) - últimos " + days + " dias";
    });
  }

});
