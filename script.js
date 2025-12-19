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
var myId = localStorage.getItem("myId") || "dev_" + Math.random().toString(36).substr(2, 9);
localStorage.setItem("myId", myId);

let dadosAtuais = { ts: 0, tr: 0, divida: "", lista: [] };

// --- 1. LISTA ATUAL (DESPESAS NÃO SALDADAS) ---
householdRef.collection("expenses").orderBy("date", "desc").onSnapshot(snap => {
    var list = document.getElementById("list");
    list.innerHTML = "";
    dadosAtuais.ts = 0; dadosAtuais.tr = 0; dadosAtuais.lista = [];

    snap.forEach(doc => {
        var e = doc.data();
        dadosAtuais.lista.push(e);
        if(e.payer === "Sara") dadosAtuais.ts += e.amount; else dadosAtuais.tr += e.amount;
        list.innerHTML += `<div class="expense-item">
            <div class="exp-info"><span class="exp-date">${e.date}</span><span><b>${e.payer}</b>: ${e.description}</span></div>
            <b>${e.amount.toFixed(2)}€</b></div>`;
    });

    document.getElementById("totalSum").textContent = (dadosAtuais.ts + dadosAtuais.tr).toFixed(2);
    document.getElementById("balanceSara").textContent = dadosAtuais.ts.toFixed(2) + "€";
    document.getElementById("balanceRui").textContent = dadosAtuais.tr.toFixed(2) + "€";

    var s = document.getElementById("settlements"), diff = (dadosAtuais.ts - dadosAtuais.tr) / 2;
    if(dadosAtuais.lista.length === 0) {
        s.style.background = "#f1f5f9"; s.innerHTML = "Tudo saldado!";
        dadosAtuais.divida = "Sem dívidas pendentes.";
    } else {
        s.style.background = diff > 0 ? "#fee2e2" : "#fee2e2";
        dadosAtuais.divida = diff > 0 ? `👨 Rui deve ${diff.toFixed(2)}€ a 👩 Sara` : `👩 Sara deve ${Math.abs(diff).toFixed(2)}€ a 👨 Rui`;
        if(Math.abs(diff) < 0.01) { s.style.background="#d1fae5"; dadosAtuais.divida="Contas certas."; }
        s.innerHTML = `<b>${dadosAtuais.divida}</b>`;
    }
});

// --- 2. LÓGICA DE ARQUIVAR (SALDAR CONTAS) ---
householdRef.onSnapshot(async doc => {
    var v = (doc.data() || {}).archiveVotes || { sara: false, rui: false };
    document.getElementById("archiveSara").style.background = v.sara ? "#10b981" : "#f1f5f9";
    document.getElementById("archiveSara").style.color = v.sara ? "#fff" : "#64748b";
    document.getElementById("archiveRui").style.background = v.rui ? "#10b981" : "#f1f5f9";
    document.getElementById("archiveRui").style.color = v.rui ? "#fff" : "#64748b";

    if(v.sara && v.rui && dadosAtuais.lista.length > 0) {
        // Gera o relatório final do que está a ser saldado AGORA
        await gerarRelatorio(dadosAtuais.lista, "FECHO_DE_CONTAS_SALDADAS", dadosAtuais.ts, dadosAtuais.tr, dadosAtuais.divida);
        // Limpa a lista atual
        var snap = await householdRef.collection("expenses").get();
        let b = db.batch();
        snap.docs.forEach(d => b.delete(d.ref));
        await b.commit();
        await householdRef.update({ "archiveVotes": { sara: false, rui: false, saraDev: "" } });
        alert("Contas saldadas e arquivadas!");
    }
});

async function votar(p) {
    var doc = await householdRef.get();
    var v = (doc.data() || {}).archiveVotes || { sara: false, rui: false, saraDev: "", ruiDev: "" };
    var c = p.toLowerCase(), o = (c === "sara") ? "rui" : "sara";
    if (v[o+"Dev"] === myId && !v[c]) return alert("Dispositivo já votou!");
    var up = {}; up["archiveVotes."+c] = !v[c]; up["archiveVotes."+c+"Dev"] = v[c] ? "" : myId;
    await householdRef.update(up);
}
document.getElementById("archiveSara").onclick = () => votar("Sara");
document.getElementById("archiveRui").onclick = () => votar("Rui");

// --- 3. RELATÓRIOS DO HISTÓRICO (ARQUIVADOS) ---
async function consultarTotal(dias) {
    let lim = new Date(); lim.setHours(0,0,0,0);
    if(dias > 0) lim.setDate(lim.getDate() - dias);
    let snap = await householdRef.collection("arquivo_permanente").where("date", ">=", lim.toISOString().split('T')[0]).get();
    let t = 0; snap.forEach(d => t += d.data().amount);
    document.getElementById("histTotal").textContent = t.toFixed(2);
}

document.getElementById("btnDownloadHist").onclick = async () => {
    let dias = document.getElementById("timeFilter").value;
    let lim = new Date(); lim.setHours(0,0,0,0);
    if(dias > 0) lim.setDate(lim.getDate() - dias);
    
    let snap = await householdRef.collection("arquivo_permanente").where("date", ">=", lim.toISOString().split('T')[0]).get();
    let listaH = [], tsH = 0, trH = 0;
    
    snap.forEach(d => {
        let e = d.data(); listaH.push(e);
        if(e.payer === "Sara") tsH += e.amount; else trH += e.amount;
    });

    let diffH = (tsH - trH) / 2;
    let resumoH = diffH > 0 ? `👨 Rui deve ${diffH.toFixed(2)}€` : `👩 Sara deve ${Math.abs(diffH).toFixed(2)}€`;
    
    await gerarRelatorio(listaH, `Historico_${dias}_dias`, tsH, trH, resumoH);
};

// --- 4. FUNÇÃO UNIVERSAL DE RELATÓRIO ---
async function gerarRelatorio(lista, nome, s, r, balanco) {
    if(lista.length === 0) return alert("Sem dados!");
    const { Document, Packer, Paragraph, TextRun } = docx;
    let corpo = [
        new Paragraph({ children: [new TextRun({ text: nome.replace(/_/g," "), bold: true, size: 28 })] }),
        new Paragraph({ text: `Total Sara: ${s.toFixed(2)}€` }),
        new Paragraph({ text: `Total Rui: ${r.toFixed(2)}€` }),
        new Paragraph({ children: [new TextRun({ text: `BALANÇO: ${balanco}`, bold: true, color: "FF0000" })] }),
        new Paragraph({ text: "----------------------------------------" })
    ];
    lista.forEach(e => corpo.push(new Paragraph({ text: `${e.date} | ${e.payer}: ${e.description} - ${e.amount.toFixed(2)}€` })));
    
    const doc = new Document({ sections: [{ children: corpo }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${nome}_${new Date().getTime()}.docx`);
}

// RESTANTE
document.getElementById("expenseForm").onsubmit = async (e) => {
    e.preventDefault();
    var obj = { payer: document.getElementById("payer").value, amount: parseFloat(document.getElementById("amount").value), description: document.getElementById("description").value, date: new Date().toISOString().split('T')[0] };
    await householdRef.collection("expenses").add(obj);
    await householdRef.collection("arquivo_permanente").add(obj);
    e.target.reset();
};
document.getElementById("btnToggleHist").onclick = () => {
    var s = document.getElementById("hist-section");
    s.style.display = s.style.display === "block" ? "none" : "block";
    if(s.style.display === "block") consultarTotal(30);
};
async function apagarTudoPermanente() {
    if(confirm("Apagar TUDO?")) {
        let snap = await householdRef.collection("arquivo_permanente").get();
        let b = db.batch(); snap.docs.forEach(d => b.delete(d.ref));
        await b.commit(); location.reload();
    }
}
