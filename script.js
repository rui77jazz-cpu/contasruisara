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
  var currentPeriod = 7; // Período selecionado (dias)
  
  // --- ESCUTAR VOTOS EM TEMPO REAL ---
  householdRef.onSnapshot(function(doc) {
    var data = doc.data() || {};
    var votes = data.archiveVotes || { sara: null, rui: null };
    updateArchiveUI(votes);
  });

  function updateArchiveUI(votes) {
    var saraVoted = votes.sara !== null;
    var ruiVoted = votes.rui !== null;
    var iVotedSara = votes.sara === myDeviceId;
    var iVotedRui = votes.rui === myDeviceId;
    
    // Botão Sara
    if (saraVoted) {
      saraBtn.classList.add("approved");
      saraBtn.innerHTML = "👩 Sara ✓";
    } else {
      saraBtn.classList.remove("approved");
      saraBtn.classList.remove("done");
      saraBtn.innerHTML = "👩 Sara";
    }
    
    // Botão Rui
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
    } else if (saraVoted) {
      statusEl.style.display = "block";
      statusEl.className = "archive-status waiting";
      if (iVotedSara) {
        statusEl.innerHTML = "⏳ Votaste como Sara. Aguarda o Rui!";
      } else {
        statusEl.innerHTML = "⏳ 👩 Sara já aprovou. Falta o Rui!";
      }
    } else if (ruiVoted) {
      statusEl.style.display = "block";
      statusEl.className = "archive-status waiting";
      if (iVotedRui) {
        statusEl.innerHTML = "⏳ Votaste como Rui. Aguarda a Sara!";
      } else {
        statusEl.innerHTML = "⏳ 👨 Rui já aprovou. Falta a Sara!";
      }
    } else {
      statusEl.style.display = "none";
    }
  }

  // --- VOTAR SARA ---
  saraBtn.onclick = function() {
    householdRef.get().then(function(doc) {
      var data = doc.data() || {};
      var votes = data.archiveVotes || { sara: null, rui: null };
      
      // Verificar se já votou (como Sara ou Rui)
      if (votes.sara === myDeviceId || votes.rui === myDeviceId) {
        alert("⚠️ Este aparelho já votou! Aguarda a outra pessoa votar de outro aparelho.");
        return;
      }
      
      // Verificar se Sara já votou
      if (votes.sara !== null) {
        alert("👩 Sara já aprovou! Aguarda ou vota como Rui.");
        return;
      }
      
      votes.sara = myDeviceId;
      householdRef.set({ archiveVotes: votes }, { merge: true }).then(function() {
        if (votes.sara && votes.rui) {
          saraBtn.classList.add("done");
          ruiBtn.classList.add("done");
          setTimeout(doArchive, 1500);
        }
      });
    });
  };

  // --- VOTAR RUI ---
  ruiBtn.onclick = function() {
    householdRef.get().then(function(doc) {
      var data = doc.data() || {};
      var votes = data.archiveVotes || { sara: null, rui: null };
      
      // Verificar se já votou (como Sara ou Rui)
      if (votes.sara === myDeviceId || votes.rui === myDeviceId) {
        alert("⚠️ Este aparelho já votou! Aguarda a outra pessoa votar de outro aparelho.");
        return;
      }
      
      // Verificar se Rui já votou
      if (votes.rui !== null) {
        alert("👨 Rui já aprovou! Aguarda ou vota como Sara.");
        return;
      }
      
      votes.rui = myDeviceId;
      householdRef.set({ archiveVotes: votes }, { merge: true }).then(function() {
        if (votes.sara && votes.rui) {
          saraBtn.classList.add("done");
          ruiBtn.classList.add("done");
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
        var data = doc.data();
        var histRef = householdRef.collection("historico").doc();
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
        loadReport(currentPeriod);
      }).catch(function(error) {
        alert("Erro ao arquivar: " + error.message);
        resetVotes();
      });
    });
  }

  function resetVotes() {
    householdRef.set({ archiveVotes: { sara: null, rui: null } }, { merge: true });
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
        // Filtrar por data
        if (d.date >= startDate) {
          total += d.amount || 0;
          if (d.payer === "Sara") totalSara += d.amount || 0;
          else totalRui += d.amount || 0;
          count++;
        }
      });
      
      // Calcular média diária
      var avgPerDay = days > 0 ? (total / days) : (count > 0 ? (total / 30) : 0);
      
      document.getElementById("report-total").textContent = total.toFixed(0) + " €";
      document.getElementById("report-sara").textContent = totalSara.toFixed(0) + " €";
      document.getElementById("report-rui").textContent = totalRui.toFixed(0) + " €";
      document.getElementById("report-avg").textContent = avgPerDay.toFixed(1) + " €";
      
      // Mostrar período
      var periodText = "";
      if (days === 0) {
        periodText = count + " despesa(s) no total";
      } else {
        periodText = count + " despesa(s) nos últimos " + days + " dias";
      }
      document.getElementById("report-period").textContent = periodText;
    });
  }

}); // Fim do DOMContentLoaded
