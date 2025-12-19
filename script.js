
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
var db = firebase.firestore();
var householdRef = db.collection("households").doc("sara_rui");

// --- ID ÚNICO DO APARELHO ---
if (!localStorage.getItem("deviceId")) {
  localStorage.setItem("deviceId", "dev_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now());
}
var myDeviceId = localStorage.getItem("deviceId");

// --- APAGAR DESPESA (global) ---
window.deleteExpense = function(id) {
  if (confirm("Apagar esta despesa?")) {
    householdRef.collection("expenses").doc(id).delete();
  }
};

// --- CALCULAR DATA DE HÁ X DIAS ---
function getDateDaysAgo(days) {
  var date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

// --- ESPERAR PELO DOM ---
document.addEventListener("DOMContentLoaded", function() {
  
  var saraBtn = document.getElementById("archiveSara");
  var ruiBtn = document.getElementById("archiveRui");
  var statusEl = document.getElementById("archive-status");
  var currentPeriod = 7;
  
  // --- ESCUTAR VOTOS EM TEMPO REAL ---
  householdRef.onSnapshot(function(doc) {
    var data = doc.data() || {};
    var votes = data.archiveVotes || { saraDevice: null, ruiDevice: null };
    updateArchiveUI(votes);
  });

  function updateArchiveUI(votes) {
    var saraVoted = votes.saraDevice !== null;
    var ruiVoted = votes.ruiDevice !== null;
    
    // Botão Sara - só muda se Sara votou
    if (saraVoted) {
      saraBtn.classList.add("approved");
      saraBtn.innerHTML = "👩 Sara ✓";
    } else {
      saraBtn.classList.remove("approved");
      saraBtn.classList.remove("done");
      saraBtn.innerHTML = "👩 Sara";
    }
    
    // Botão Rui - só muda se Rui votou
    if (ruiVoted) {
      ruiBtn.classList.add("approved");
      ruiBtn.innerHTML = "👨 Rui ✓";
    } else {
      ruiBtn.classList.remove("approved");
      ruiBtn.classList.remove("done");
      ruiBtn.innerHTML = "👨 Rui";
    }
    
    // Mensagem de status
    if (saraVoted && ruiVoted) {
      statusEl.style.display = "block";
      statusEl.className = "archive-status success";
      statusEl.innerHTML = "✅ Ambos aprovaram! A arquivar...";
    } else if (saraVoted && !ruiVoted) {
      statusEl.style.display = "block";
      statusEl.className = "archive-status waiting";
      statusEl.innerHTML = "⏳ 👩 Sara aprovou. Falta o 👨 Rui!";
    } else if (ruiVoted && !saraVoted) {
      statusEl.style.display = "block";
      statusEl.className = "archive-status waiting";
      statusEl.innerHTML = "⏳ 👨 Rui aprovou. Falta a 👩 Sara!";
    } else {
      statusEl.style.display = "none";
    }
  }

  // --- VOTAR SARA ---
  saraBtn.onclick = function() {
    householdRef.get().then(function(doc) {
      var data = doc.data() || {};
      var votes = data.archiveVotes || { saraDevice: null, ruiDevice: null };
      
      // JÁ VOTOU COMO SARA?
      if (votes.saraDevice !== null) {
        alert("👩 Sara já votou!");
        return;
      }
      
      // ESTE APARELHO JÁ VOTOU COMO RUI?
      if (votes.ruiDevice === myDeviceId) {
        alert("⚠️ Este aparelho já votou como Rui!\nPrecisas de outro aparelho para votar como Sara.");
        return;
      }
      
      // REGISTAR VOTO DA SARA
      votes.saraDevice = myDeviceId;
      householdRef.set({ archiveVotes: votes }, { merge: true }).then(function() {
        // Verificar se ambos votaram
        if (votes.saraDevice && votes.ruiDevice) {
          setTimeout(doArchive, 1500);
        }
      });
    });
  };

  // --- VOTAR RUI ---
  ruiBtn.onclick = function() {
    householdRef.get().then(function(doc) {
      var data = doc.data() || {};
      var votes = data.archiveVotes || { saraDevice: null, ruiDevice: null };
      
      // JÁ VOTOU COMO RUI?
      if (votes.ruiDevice !== null) {
        alert("👨 Rui já votou!");
        return;
      }
      
      // ESTE APARELHO JÁ VOTOU COMO SARA?
      if (votes.saraDevice === myDeviceId) {
        alert("⚠️ Este aparelho já votou como Sara!\nPrecisas de outro aparelho para votar como Rui.");
        return;
      }
      
      // REGISTAR VOTO DO RUI
      votes.ruiDevice = myDeviceId;
      householdRef.set({ archiveVotes: votes }, { merge: true }).then(function() {
        // Verificar se ambos votaram
        if (votes.saraDevice && votes.ruiDevice) {
          setTimeout(doArchive, 1500);
        }
      });
    });
  };

  function doArchive() {
    householdRef.collection("expenses").get().then(function(snap) {
      if (snap.empty) {
        alert("Não há despesas para arquivar.");
        resetVotes();
        return;
      }
      
      var batch = db.batch();
      var count = 0;
      var archivedAt = new Date().toISOString();
      
      snap.docs.forEach(function(doc) {
        var expData = doc.data();
        var histRef = householdRef.collection("historico").doc();
        batch.set(histRef, {
          payer: expData.payer,
          amount: expData.amount,
          date: expData.date,
          description: expData.description,
          archivedAt: archivedAt
        });
        batch.delete(doc.ref);
        count++;
      });
      
      batch.commit().then(function() {
        alert("✅ " + count + " despesa(s) arquivada(s)!");
        resetVotes();
        loadReport(currentPeriod);
      }).catch(function(error) {
        alert("Erro ao arquivar: " + error.message);
        resetVotes();
      });
    });
  }

  function resetVotes() {
    householdRef.set({ archiveVotes: { saraDevice: null, ruiDevice: null } }, { merge: true });
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

  // --- ADICIONAR DESPESA ---
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
    }).catch(function(error) {
      alert("Erro: " + error.message);
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

  // --- TABS DE PERÍODO ---
  var periodTabs = document.querySelectorAll(".period-tab");
  periodTabs.forEach(function(tab) {
    tab.onclick = function() {
      periodTabs.forEach(function(t) { t.classList.remove("active"); });
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
      
      var avgPerDay = days > 0 ? (total / days) : (count > 0 ? (total / 30) : 0);
      
      document.getElementById("report-total").textContent = total.toFixed(0) + " €";
      document.getElementById("report-sara").textContent = totalSara.toFixed(0) + " €";
      document.getElementById("report-rui").textContent = totalRui.toFixed(0) + " €";
      document.getElementById("report-avg").textContent = avgPerDay.toFixed(1) + " €";
      
      var periodText = days === 0 
        ? count + " despesa(s) no total" 
        : count + " despesa(s) nos últimos " + days + " dias";
      document.getElementById("report-period").textContent = periodText;
    });
  }

});
