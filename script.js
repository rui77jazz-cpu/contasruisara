// CONFIGURAÇÃO FIREBASE (Igual à tua)
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
  if (!id) { id = "dev_" + Math.random().toString(36).substr(2, 9); localStorage.setItem("myDeviceId", id); }
  return id;
}
var myDeviceId = getDeviceId();

document.addEventListener("DOMContentLoaded", function() {
  var saraBtn = document.getElementById("archiveSara");
  var ruiBtn = document.getElementById("archiveRui");

  // --- FUNÇÃO DE RELATÓRIO MESTRE ---
  async function generateFinalReport() {
    if(!confirm("Deseja gerar o relatório final e limpar todos os dados?")) return;

    // Buscar as duas coleções
    const currentSnap = await householdRef.collection("expenses").get();
    const historySnap = await householdRef.collection("historico").get();

    let allExpenses = [];
    let tS = 0, tR = 0;

    // Juntar tudo
    [...currentSnap.docs, ...historySnap.docs].forEach(doc => {
      let d = doc.data();
      allExpenses.push(d);
      if(d.payer === "Sara") tS += d.amount; else tR += d.amount;
    });

    if(allExpenses.length === 0) { alert("Sem dados."); return; }

    // Cálculo de Acerto
    let total = tS + tR;
    let diff = (tS - tR) / 2;
    let acertoTexto = (Math.abs(diff) < 0.01) ? "Contas Certas" : 
                     (diff > 0) ? `👨 Rui deve ${diff.toFixed(2)}€ à 👩 Sara` : `👩 Sara deve ${Math.abs(diff).toFixed(2)}€ ao 👨 Rui`;

    // Gerar DOCX
    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } = docx;
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({ children: [new TextRun({ text: "RELATÓRIO FINAL: SARA & RUI", bold: true, size: 32 })] }),
          new Paragraph({ text: "Data: " + new Date().toLocaleString() }),
          new Paragraph({ text: "" }),
          new Paragraph({ children: [new TextRun({ text: "RESUMO CONSOLIDADO (Pendente + Histórico)", bold: true })] }),
          new Paragraph({ text: `Total Global: ${total.toFixed(2)}€` }),
          new Paragraph({ text: `Pago pela Sara: ${tS.toFixed(2)}€` }),
          new Paragraph({ text: `Pago pelo Rui: ${tR.toFixed(2)}€` }),
          new Paragraph({ children: [new TextRun({ text: acertoTexto, bold: true, color: "FF0000", size: 28 })] }),
          new Paragraph({ text: "" }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ children: [new TableCell({children:[new Paragraph("Data")]}), new TableCell({children:[new Paragraph("Quem")]}), new TableCell({children:[new Paragraph("Descrição")]}), new TableCell({children:[new Paragraph("Valor")]})] }),
              ...allExpenses.sort((a,b) => b.date.localeCompare(a.date)).map(e => new TableRow({
                children: [
                  new TableCell({children:[new Paragraph(e.date || "")]}),
                  new TableCell({children:[new Paragraph(e.payer)]}),
                  new TableCell({children:[new Paragraph(e.description)]}),
                  new TableCell({children:[new Paragraph(e.amount.toFixed(2)+"€")]}),
                ]
              }))
            ]
          })
        ]
      }]
    });

    Packer.toBlob(doc).then(blob => {
      saveAs(blob, "Relatorio_Final_Contas.docx");
      // LIMPEZA TOTAL
      let batch = db.batch();
      currentSnap.docs.forEach(d => batch.delete(d.ref));
      historySnap.docs.forEach(d => batch.delete(d.ref));
      batch.commit().then(() => { alert("Tudo limpo! A recomeçar do zero."); location.reload(); });
    });
  }

  document.getElementById("clearHistoryBtn").onclick = generateFinalReport;

  // --- LÓGICA DE VOTOS ---
  householdRef.onSnapshot(doc => {
    let v = doc.data().archiveVotes || {};
    saraBtn.className = "archive-btn" + (v.sara ? " voted" : "");
    ruiBtn.className = "archive-btn" + (v.rui ? " voted" : "");
    if(v.sara && v.rui) setTimeout(doArchive, 1000);
  });

  function handleVote(user) {
    householdRef.get().then(doc => {
      let v = doc.data().archiveVotes || {};
      let userL = user.toLowerCase();
      if(v[userL]) return;
      if(v[(user === "Sara" ? "rui" : "sara") + "Device"] === myDeviceId) { alert("Usa o teu telemóvel!"); return; }
      let up = {}; up[`archiveVotes.${userL}`] = true; up[`archiveVotes.${userL}Device`] = myDeviceId;
      householdRef.update(up);
    });
  }
  saraBtn.onclick = () => handleVote("Sara");
  ruiBtn.onclick = () => handleVote("Rui");

  function doArchive() {
    householdRef.collection("expenses").get().then(snap => {
      if(snap.empty) { resetVotes(); return; }
      let batch = db.batch(), now = new Date().toISOString();
      snap.docs.forEach(d => {
        batch.set(householdRef.collection("historico").doc(), {...d.data(), archivedAt: now});
        batch.delete(d.ref);
      });
      batch.commit().then(() => { resetVotes(); alert("Arquivado no histórico!"); });
    });
  }
  function resetVotes() { householdRef.update({ archiveVotes: { sara: false, rui: false, saraDevice: null, ruiDevice: null }}); }

  // --- INTERFACE ---
  householdRef.collection("expenses").onSnapshot(snap => {
    let list = document.getElementById("list"), tS = 0, tR = 0;
    list.innerHTML = "";
    snap.forEach(doc => {
      let e = doc.data(); tS += (e.payer === "Sara" ? e.amount : 0); tR += (e.payer === "Rui" ? e.amount : 0);
      let div = document.createElement("div"); div.className = "expense-item";
      div.innerHTML = `<div><b>${e.payer}</b><br><small>${e.description}</small></div>
                       <div style="display:flex;align-items:center;gap:10px"><b>${e.amount.toFixed(2)}€</b><button onclick="deleteExpense('${doc.id}')" style="background:none;border:none;cursor:pointer">🗑️</button></div>`;
      list.appendChild(div);
    });
    let total = tS + tR;
    document.getElementById("totalSum").textContent = total.toFixed(2);
    document.getElementById("balanceSara").textContent = tS.toFixed(2);
    document.getElementById("balanceRui").textContent = tR.toFixed(2);
    let s = document.getElementById("settlements"), diff = (tS - tR) / 2;
    if(total === 0 || Math.abs(diff) < 0.01) { s.className = "settlement even"; s.innerHTML = "✅ Tudo certo!"; }
    else if(diff > 0) { s.className = "settlement pay"; s.innerHTML = `👨 Rui deve <b>${diff.toFixed(2)}€</b> a 👩 Sara`; }
    else { s.className = "settlement pay"; s.innerHTML = `👩 Sara deve <b>${Math.abs(diff).toFixed(2)}€</b> a 👨 Rui`; }
  });

  window.deleteExpense = id => { if(confirm("Apagar?")) householdRef.collection("expenses").doc(id).delete(); };
  
  document.getElementById("expenseForm").onsubmit = e => {
    e.preventDefault();
    let p = document.getElementById("payer").value, a = parseFloat(document.getElementById("amount").value), d = document.getElementById("description").value;
    householdRef.collection("expenses").add({ payer: p, amount: a, description: d, date: new Date().toISOString().slice(0,10) }).then(() => e.target.reset());
  };

  document.getElementById("histToggle").onclick = function() {
    let s = document.getElementById("hist-section");
    s.style.display = (s.style.display === "none") ? "block" : "none";
    if(s.style.display === "block") {
      householdRef.collection("historico").get().then(snap => {
        let t = 0; snap.forEach(doc => t += doc.data().amount);
        document.getElementById("report-total").textContent = t.toFixed(2) + " €";
      });
    }
  };
});\
