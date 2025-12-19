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

  // --- GERAR WORD E LIMPAR ---
  async function generateReportAndClear() {
    if (!confirm("Gerar relatório Word e apagar TODO o histórico?")) return;

    const snap = await householdRef.collection("historico").get();
    if (snap.empty) { alert("Histórico vazio."); return; }

    let data = [], tS = 0, tR = 0, total = 0;
    snap.forEach(doc => {
      let d = doc.data();
      data.push(d);
      total += d.amount;
      if (d.payer === "Sara") tS += d.amount; else tR += d.amount;
    });

    // Cálculo do acerto para o Word
    let diff = Math.abs(tS - tR) / 2;
    let fraseAcerto = (tS === tR) ? "Tudo equilibrado." : 
                     (tS > tR) ? `Rui deve ${diff.toFixed(2)}€ à Sara.` : `Sara deve ${diff.toFixed(2)}€ ao Rui.`;

    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } = docx;
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: "Relatório de Contas: Sara & Rui", bold: true, size: 28 })] }),
          new Paragraph({ text: "Exportado em: " + new Date().toLocaleString() }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun({ text: "RESUMO DO PERÍODO:", bold: true })] }),
          new Paragraph({ text: `Total Gasto: ${total.toFixed(2)}€` }),
          new Paragraph({ text: `Gasto pela Sara: ${tS.toFixed(2)}€` }),
          new Paragraph({ text: `Gasto pelo Rui: ${tR.toFixed(2)}€` }),
          new Paragraph({ children: [new TextRun({ text: "ACERTO DE CONTAS: " + fraseAcerto, bold: true, color: "FF0000" })] }),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [
                new TableCell({ children: [new Paragraph("Data")] }),
                new TableCell({ children: [new Paragraph("Payer")] }),
                new TableCell({ children: [new Paragraph("Desc")] }),
                new TableCell({ children: [new Paragraph("Valor")] })
              ]}),
              ...data.map(item => new TableRow({ children: [
                new TableCell({ children: [new Paragraph(item.date || "")] }),
                new TableCell({ children: [new Paragraph(item.payer)] }),
                new TableCell({ children: [new Paragraph(item.description)] }),
                new TableCell({ children: [new Paragraph(item.amount.toFixed(2) + "€")] })
              ]}))
            ]
          })
        ]
      }]
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, "Relatorio_Contas.docx");
      let batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      batch.commit().then(() => { alert("Histórico limpo!"); location.reload(); });
    });
  }

  document.getElementById("clearHistoryBtn").onclick = generateReportAndClear;

  // --- VOTAÇÃO ---
  householdRef.onSnapshot(doc => {
    var votes = doc.data().archiveVotes || {};
    var sV = !!votes.sara, rV = !!votes.rui;
    saraBtn.className = "archive-btn" + (sV ? " voted" : "");
    ruiBtn.className = "archive-btn" + (rV ? " voted" : "");
    if (sV && rV) { statusEl.innerHTML = "✅ Arquivando..."; setTimeout(doArchive, 1500); }
    else { statusEl.innerHTML = sV ? "⏳ Falta o Rui" : (rV ? "⏳ Falta a Sara" : "Aguardando aprovação"); }
  });

  function handleVote(user) {
    householdRef.get().then(doc => {
      var v = doc.data().archiveVotes || {};
      var other = user === "Sara" ? "rui" : "sara";
      if (v[user.toLowerCase()]) return;
      if (v[other + "Device"] === myDeviceId) { alert("Usa o teu telemóvel!"); return; }
      var up = {}; up["archiveVotes." + user.toLowerCase()] = true; 
      up["archiveVotes." + user.toLowerCase() + "Device"] = myDeviceId;
      householdRef.update(up);
    });
  }

  saraBtn.onclick = () => handleVote("Sara");
  ruiBtn.onclick = () => handleVote("Rui");

  function doArchive() {
    householdRef.collection("expenses").get().then(snap => {
      if (snap.empty) { resetVotes(); return; }
      var batch = db.batch(), now = new Date().toISOString();
      snap.docs.forEach(doc => {
        batch.set(householdRef.collection("historico").doc(), { ...doc.data(), archivedAt: now });
        batch.delete(doc.ref);
      });
      batch.commit().then(() => { alert("Arquivado!"); resetVotes(); });
    });
  }

  function resetVotes() {
    householdRef.update({ archiveVotes: { sara: false, saraDevice: null, rui: false, ruiDevice: null } });
  }

  // --- INTERFACE ---
  householdRef.collection("expenses").onSnapshot(snap => {
    var list = document.getElementById("list"); list.innerHTML = "";
    var tS = 0, tR = 0;
    snap.forEach(doc => {
      var e = doc.data(); tS += (e.payer === "Sara" ? e.amount : 0); tR += (e.payer === "Rui" ? e.amount : 0);
      var div = document.createElement("div"); div.className = "expense-item";
      div.innerHTML = `<div><b>${e.payer}</b><small>${e.description}</small></div><b>${e.amount.toFixed(2)}€</b>`;
      list.appendChild(div);
    });
    document.getElementById("balanceSara").textContent = tS.toFixed(2);
    document.getElementById("balanceRui").textContent = tR.toFixed(2);
    var s = document.getElementById("settlements"), diff = Math.abs(tS - tR) / 2;
    if (tS + tR === 0) { s.className = "settlement even"; s.innerHTML = "Tudo certo!"; }
    else if (tS > tR) { s.className = "settlement pay"; s.innerHTML = `👨 Rui deve ${diff.toFixed(2)}€ à 👩 Sara`; }
    else { s.className = "settlement pay"; s.innerHTML = `👩 Sara deve ${diff.toFixed(2)}€ ao 👨 Rui`; }
  });

  document.getElementById("expenseForm").onsubmit = e => {
    e.preventDefault();
    var p = document.getElementById("payer").value, a = parseFloat(document.getElementById("amount").value), d = document.getElementById("description").value;
    householdRef.collection("expenses").add({ payer: p, amount: a, description: d, date: new Date().toISOString().slice(0,10) }).then(() => e.target.reset());
  };

  document.getElementById("histToggle").onclick = function() {
    var s = document.getElementById("hist-section");
    s.style.display = (s.style.display === "none") ? "block" : "none";
    if(s.style.display === "block") {
      householdRef.collection("historico").get().then(snap => {
        let t = 0; snap.forEach(doc => t += doc.data().amount);
        document.getElementById("report-total").textContent = t.toFixed(2) + "€";
      });
    }
  };
});
