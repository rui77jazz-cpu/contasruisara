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

// --- IDENTIFICAÇÃO DO APARELHO ---
function getDeviceId() {
  var id = localStorage.getItem("myDeviceId");
  if (!id) {
    id = "dev_" + Math.random().toString(36).substr(2, 9) + "_" + Date.now();
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

document.addEventListener("DOMContentLoaded", function() {
  
  var saraBtn = document.getElementById("archiveSara");
  var ruiBtn = document.getElementById("archiveRui");
  var statusEl = document.getElementById("archive-status");
  var currentPeriod = 7;
  
  // --- MONITORIZAÇÃO EM TEMPO REAL ---
  householdRef.onSnapshot(function(doc) {
    var data = doc.data() || {};
    var votes = data.archiveVotes || {};
    
    var sV = !!votes.sara;
    var rV = !!votes.rui;
    
    saraBtn.className = "archive-btn" + (sV ? " voted" : "");
    ruiBtn.className = "archive-btn" + (rV ? " voted" : "");
    saraBtn.innerHTML = sV ? "👩 Sara ✓" : "👩 Sara";
    ruiBtn.innerHTML = rV ? "👨 Rui ✓" : "👨 Rui";
    
    statusEl.className = "archive-status";
    if (sV && rV) {
      saraBtn.className = "archive-btn done";
      ruiBtn.className = "archive-btn done";
      statusEl.classList.add("success");
      statusEl.innerHTML = "✅ Tudo aprovado! A arquivar...";
    } else if (sV || rV) {
      statusEl.classList.add("waiting");
      statusEl.innerHTML = sV ? "⏳ Sara aprovou. Falta o Rui!" : "⏳ Rui aprovou. Falta a Sara!";
    } else {
      statusEl.innerHTML = "Aprovação pendente dos dois";
    }
  });

  // --- LÓGICA DE VOTO (SEM PIN - APENAS APARELHO) ---
  function handleVote(user) {
    householdRef.get().then(function(doc) {
      var data = doc.data() || {};
      var votes = data.archiveVotes || {};
      var userKey = user.toLowerCase();
      var otherUserKey = user === "Sara" ? "rui" : "sara";
      
      // 1. Já votou?
      if (votes[userKey]) {
        alert("Já deste a tua aprovação!");
        return;
      }

      // 2. O mesmo aparelho tentou votar pelo outro?
      if (votes[otherUserKey + "Device"] === myDeviceId) {
        alert("⚠️ Bloqueio: Este aparelho já foi usado pelo(a) " + (user === "Sara" ? "Rui" : "Sara") + ". Usa o teu telemóvel!");
        return;
      }

      // 3. Gravar voto e ID do aparelho
      var updateData = {};
      updateData["archiveVotes." + userKey] = true;
      updateData["archiveVotes." + userKey + "Device"] = myDeviceId;

      householdRef.update(updateData).then(function() {
        // Verifica se ambos votaram
        householdRef.get().then(function(newDoc) {
          var v = newDoc.data().archiveVotes;
          if (v.sara && v.rui) setTimeout(doArchive, 1500);
        });
      });
    });
  }

  saraBtn.onclick = function() { handleVote("Sara"); };
  ruiBtn.onclick = function() { handleVote("Rui"); };

  function doArchive() {
    householdRef.collection("expenses").get().then(function(snap) {
      if (snap.empty) { resetVotes(); return; }
      var batch = db.batch();
      var now = new Date().toISOString();
      snap.docs.forEach(function(doc) {
        batch.set(householdRef.collection("historico").doc(), { ...doc.data(), archivedAt: now });
        batch.delete(doc.ref);
      });
      batch.commit().then(function() {
        alert("✅ Contas arquivadas!");
        resetVotes();
      });
    });
  }

  function resetVotes() {
    householdRef.update({
      archiveVotes: { sara: false, saraDevice: null, rui: false, ruiDevice: null }
    });
  }

  // --- INTERFACE (LISTA E FORMULÁRIO) ---
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
      div.innerHTML = `<div class="info"><b>${e.payer === 'Sara'?'👩':'👨'} ${e.payer}</b><br><small>${e.description}</small></div>
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
    householdRef.collection("expenses").add({ payer: p, amount: a, description: d, date: new Date().toISOString().slice(0,10) }).then(() => e.target.reset());
  };

  document.getElementById("histToggle").onclick = function() {
    var s = document.getElementById("hist-section");
    s.style.display = (s.style.display === "none" || s.style.display === "") ? "block" : "none";
    this.textContent = s.style.display === "block" ? "📜 Esconder Histórico" : "📜 Ver Histórico";
    if(s.style.display === "block") loadReport(currentPeriod);
  };

  function loadReport(days) {
    householdRef.collection("historico").get().then(snap => {
      var t = 0, c = 0, start = days > 0 ? getDateDaysAgo(days) : "1900-01-01";
      snap.forEach(doc => { if (doc.data().date >= start) { t += doc.data().amount; c++; } });
      document.getElementById("report-total").textContent = t.toFixed(0) + "€";
    });
  }
});
