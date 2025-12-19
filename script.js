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

document.addEventListener("DOMContentLoaded", function() {
  
  var saraBtn = document.getElementById("archiveSara");
  var ruiBtn = document.getElementById("archiveRui");
  var statusEl = document.getElementById("archive-status");
  var currentPeriod = 7;

  // --- FUNÇÃO PARA GERAR DOCX ---
  async function generateReportAndClear() {
    if (!confirm("Isto vai gerar um relatório Word e APAGAR TODO o histórico permanentemente. Continuar?")) return;

    const snap = await householdRef.collection("historico").get();
    if (snap.empty) {
      alert("Não há histórico para exportar.");
      return;
    }

    let data = [];
    let tS = 0, tR = 0, total = 0;

    snap.forEach(doc => {
      let d = doc.data();
      data.push(d);
      total += d.amount;
      if (d.payer === "Sara") tS += d.amount; else tR += d.amount;
    });

    // Criar documento Word usando a biblioteca 'docx'
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } = docx;

    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: "Relatório de Contas: Sara & Rui", bold: true, size: 32 })] }),
          new Paragraph({ text: "Data de Exportação: " + new Date().toLocaleString() }),
          new Paragraph({ text: "" }),
          new Paragraph({ text: `Resumo Total: ${total.toFixed(2)}€` }),
          new Paragraph({ text: `Sara: ${tS.toFixed(2)}€ | Rui: ${tR.toFixed(2)}€` }),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph("Data")] }),
                  new TableCell({ children: [new Paragraph("Quem")] }),
                  new TableCell({ children: [new Paragraph("Descrição")] }),
                  new TableCell({ children: [new Paragraph("Valor")] }),
                ],
              }),
              ...data.map(item => new TableRow({
                children: [
                  new TableCell({ children: [new Paragraph(item.date || "---")] }),
                  new TableCell({ children: [new Paragraph(item.payer)] }),
                  new TableCell({ children: [new Paragraph(item.description)] }),
                  new TableCell({ children: [new Paragraph(item.amount.toFixed(2) + "€")] }),
                ],
              }))
            ],
          }),
        ],
      }],
    });

    // Descarregar o ficheiro
    Packer.toBlob(doc).then(blob => {
      saveAs(blob, "Relatorio_Contas_Sara_Rui.docx");
      
      // APAGAR TUDO DO FIREBASE APÓS DOWNLOAD
      let batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      batch.commit().then(() => {
        alert("Histórico limpo com sucesso!");
        location.reload(); // Recarrega para limpar os gráficos
      });
    });
  }

  document.getElementById("clearHistoryBtn").onclick = generateReportAndClear;

  // --- MONITORIZAÇÃO DE VOTOS ---
  householdRef.onSnapshot(function(doc) {
    var data = doc.data() || {};
    var votes = data.archiveVotes || {};
    var sV = !!votes.sara, rV = !!votes.rui;
    
    saraBtn.className = "archive-btn" + (sV ? " voted" : "");
    ruiBtn.className = "archive-btn" + (rV ? " voted" : "");
    saraBtn.innerHTML = sV ? "👩 Sara ✓" : "👩 Sara";
    ruiBtn.innerHTML = rV ? "👨 Rui ✓" : "👨 Rui";
    
    if (sV && rV) {
      statusEl.innerHTML = "✅ Tudo aprovado! A arquivar...";
      setTimeout(doArchive, 1500);
    }
  });

  function handleVote(user) {
    householdRef.get().then(function(doc) {
      var data = doc.data() || {};
      var votes = data.archiveVotes || {};
      var userKey = user.toLowerCase();
      var otherKey = user === "Sara" ? "rui" : "sara";
      
      if (votes[userKey]) return;
      if (votes[otherKey + "Device"] === myDeviceId) {
        alert("⚠️ Bloqueio: Usa o teu próprio telemóvel!");
        return;
      }

      var up = {};
      up["archiveVotes." + userKey] = true;
      up["archiveVotes." + userKey + "Device"] = myDeviceId;
      householdRef.update(up);
    });
  }

  saraBtn.onclick = () => handleVote("Sara");
  ruiBtn.onclick = () => handleVote("Rui");

  function doArchive() {
    householdRef.collection("expenses").get().then(snap => {
      if (snap.empty) { resetVotes(); return; }
      var batch = db.batch();
      var now = new Date().toISOString();
      snap.docs.forEach(doc => {
        batch.set(householdRef.collection("historico").doc(), { ...doc.data(), archivedAt: now });
        batch.delete(doc.ref);
      });
      batch.commit().then(() => {
        alert("✅ Despesas movidas para o histórico!");
        resetVotes();
      });
    });
  }

  function resetVotes() {
    householdRef.update({ archiveVotes: { sara: false, saraDevice: null, rui: false, ruiDevice: null } });
  }

  // --- LISTAGEM DE DESPESAS ATUAIS ---
  householdRef.collection("expenses").orderBy("date", "desc").onSnapshot(snap => {
    var list = document.getElementById("list");
    list.innerHTML = "";
    var tS = 0, tR = 0, t = 0;
    snap.forEach(doc => {
      var e = doc.data();
      t += e.amount;
      if (e.payer === "Sara") tS += e.amount; else tR += e.amount;
      var div = document.createElement("div");
      div.className = "expense-item";
      div.innerHTML = `<div class="info"><b>${e.payer}</b><br><small>${e.description}</small></div>
                       <div style="display:flex;align-items:center;gap:8px"><b>${e.amount.toFixed(2)}€</b></div>`;
      list.appendChild(div);
    });
    document.getElementById("totalSum").textContent = t.toFixed(2);
    document.getElementById("balanceSara").textContent = tS.toFixed(2);
    document.getElementById("balanceRui").textContent = tR.toFixed(2);
  });

  // --- FORMULÁRIO ---
  document.getElementById("expenseForm").onsubmit = function(e) {
    e.preventDefault();
    var p = document.getElementById("payer").value, a = parseFloat(document.getElementById("amount").value), d = document.getElementById("description").value;
    householdRef.collection("expenses").add({ payer: p, amount: a, description: d, date: new Date().toISOString().slice(0,10) }).then(() => e.target.reset());
  };

  // --- HISTÓRICO VISUAL ---
  document.getElementById("histToggle").onclick = function() {
    var s = document.getElementById("hist-section");
    s.style.display = (s.style.display === "none") ? "block" : "none";
    if(s.style.display === "block") loadReport(currentPeriod);
  };

  function loadReport(days) {
    householdRef.collection("historico").get().then(snap => {
      var t = 0, start = days > 0 ? getDateDaysAgo(days) : "1900-01-01";
      snap.forEach(doc => { if (doc.data().date >= start) t += doc.data().amount; });
      document.getElementById("report-total").textContent = t.toFixed(2) + "€";
    });
  }

  function getDateDaysAgo(days) {
    var d = new Date(); d.setDate(d.getDate() - days); return d.toISOString().slice(0, 10);
  }
});
