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

// --- CONFIGURAÇÃO DE SEGURANÇA ---
const PINS = {
  "Sara": "1234", // Podes alterar estes números
  "Rui": "4321"
};

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
    
    var saraVotou = !!votes.sara;
    var ruiVotou = !!votes.rui;
    
    saraBtn.className = "archive-btn";
    ruiBtn.className = "archive-btn";
    statusEl.className = "archive-status";
    
    if (saraVotou) {
      saraBtn.classList.add("voted");
      saraBtn.innerHTML = "👩 Sara ✓";
    } else {
      saraBtn.innerHTML = "👩 Sara";
    }
    
    if (ruiVotou) {
      ruiBtn.classList.add("voted");
      ruiBtn.innerHTML = "👨 Rui ✓";
    } else {
      ruiBtn.innerHTML = "👨 Rui";
    }
    
    if (saraVotou && ruiVotou) {
      saraBtn.classList.replace("voted", "done");
      ruiBtn.classList.replace("voted", "done");
      statusEl.classList.add("success");
      statusEl.innerHTML = "✅ Ambos aprovaram! A arquivar...";
    } else if (saraVotou || ruiVotou) {
      statusEl.classList.add("waiting");
      statusEl.innerHTML = saraVotou ? "⏳ Sara aprovou. Falta o Rui!" : "⏳ Rui aprovou. Falta a Sara!";
    }
  });

  // --- LÓGICA DE VOTO COM PIN ---
  function handleVote(user) {
    var pinInserido = prompt("Insere o teu PIN de 4 dígitos, " + user + ":");
    if (pinInserido !== PINS[user]) {
      alert("❌ PIN incorreto!");
      return;
    }

    householdRef.get().then(function(doc) {
      var data = doc.data() || {};
      var votes = data.archiveVotes || {};
      var userLower = user.toLowerCase();

      if (votes[userLower]) {
        alert("Já votaste!");
        return;
      }

      var updateData = {};
      updateData["archiveVotes." + userLower] = true;
      updateData["archiveVotes." + userLower + "Device"] = myDeviceId;

      householdRef.update(updateData).then(function() {
        // Se após o voto os dois estiverem true, arquiva
        householdRef.get().then(function(newDoc) {
          var v = newDoc.data().archiveVotes;
          if (v.sara && v.rui) setTimeout(doArchive, 1500);
        });
      });
    });
  }

  saraBtn.onclick = function() { handleVote("Sara"); };
  ruiBtn.onclick = function() { handleVote("Rui"); };

  // --- ARQUIVAR ---
  function doArchive() {
    householdRef.collection("expenses").get().then(function(snap) {
      if (snap.empty) { resetVotes(); return; }
      
      var batch = db.batch();
      var now = new Date().toISOString();
      
      snap.docs.forEach(function(doc) {
        var d = doc.data();
        batch.set(householdRef.collection("historico").doc(), {
          ...d, archivedAt: now
        });
        batch.delete(doc.ref);
      });
      
      batch.commit().then(function() {
        alert("✅ Contas fechadas e arquivadas!");
        resetVotes();
        loadReport(currentPeriod);
      });
    });
  }

  function resetVotes() {
    householdRef.update({
      archiveVotes: { sara: false, saraDevice: null, rui: false, ruiDevice: null }
    });
  }

  // --- RESTANTE DO CÓDIGO (IGUAL) ---
  householdRef.collection("expenses").orderBy("date", "desc").onSnapshot(function(snap) {
    var list = document.getElementById("list");
    list.innerHTML = "";
    var tS = 0, tR = 0, t = 0;
    snap.forEach(function(doc) {
      var e = doc.data();
      t += e.amount || 0;
      if (e.payer === "Sara") tS += e.amount || 0; else tR += e.amount || 0;
      var div = document.createElement("div");
      div.className = "expense-item";
      div.innerHTML = `<div class="info"><b>${e.payer === "Sara"?'👩':'👨'} ${e.payer}</b><br><small>${e.description}</small></div>
                       <div style="display:flex;align-items:center;gap:8px"><b>${e.amount.toFixed(2)}€</b><button onclick="deleteExpense('${doc.id}')">🗑️</button></div>`;
      list.appendChild(div);
    });
    document.getElementById("totalSum").textContent = t.toFixed(2);
    document.getElementById("balanceSara").textContent = tS.toFixed(2);
    document.getElementById("balanceRui").textContent = tR.toFixed(2);
    var s = document.getElementById("settlements");
    var d = Math.abs(tS - tR) / 2;
    if (t === 0 || d < 0.01) { s.className="settlement even"; s.innerHTML="✅ Tudo certo!"; }
    else { s.className="settlement pay"; s.innerHTML = tS > tR ? `👨 Rui deve <b>${d.toFixed(2)}€</b> a 👩 Sara` : `👩 Sara deve <b>${d.toFixed(2)}€</b> a 👨 Rui`; }
  });

  document.getElementById("expenseForm").onsubmit = function(e) {
    e.preventDefault();
    var p = document.getElementById("payer").value, a = parseFloat(document.getElementById("amount").value), d = document.getElementById("description").value;
    if(!p || !a || !d) return;
    householdRef.collection("expenses").add({ payer: p, amount: a, description: d, date: new Date().toISOString().slice(0,10) })
    .then(() => e.target.reset());
  };

  document.getElementById("histToggle").onclick = function() {
    var s = document.getElementById("hist-section");
    s.style.display = (s.style.display === "none" || s.style.display === "") ? "block" : "none";
    this.textContent = s.style.display === "block" ? "📜 Esconder Histórico" : "📜 Ver Histórico";
    if(s.style.display === "block") loadReport(currentPeriod);
  };

  document.querySelectorAll(".period-tab").forEach(t => {
    t.onclick = function() {
      document.querySelectorAll(".period-tab").forEach(tab => tab.classList.remove("active"));
      this.classList.add("active");
      currentPeriod = parseInt(this.dataset.days);
      loadReport(currentPeriod);
    };
  });

  function loadReport(days) {
    householdRef.collection("historico").get().then(snap => {
      var t = 0, tS = 0, tR = 0, c = 0, start = days > 0 ? getDateDaysAgo(days) : "1900-01-01";
      snap.forEach(doc => {
        var d = doc.data();
        if (d.date >= start) { t += d.amount; if(d.payer === "Sara") tS += d.amount; else tR += d.amount; c++; }
      });
      document.getElementById("report-total").textContent = t.toFixed(0) + "€";
      document.getElementById("report-sara").textContent = tS.toFixed(0) + "€";
      document.getElementById("report-rui").textContent = tR.toFixed(0) + "€";
      document.getElementById("report-avg").textContent = (days > 0 ? t/days : t/30).toFixed(1) + "€";
      document.getElementById("report-period").textContent = c + " despesas encontradas.";
    });
  }
});
