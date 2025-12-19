var firebaseConfig = {
  apiKey: "AIzaSyCle9Kx3OVD7mnZfXubKyIGW6COYrGI304",
  authDomain: "contassararui.firebaseapp.com",
  projectId: "contassararui",
  storageBucket: "contassararui.firebasestorage.app",
  messagingSenderId: "760330070358",
  appId: "1:760330070358:web:5d1f213133bfdbe902cef7"
};

if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
var db = firebase.firestore();
var householdRef = db.collection("households").doc("sara_rui");
var myId = localStorage.getItem("myId") || "dev_" + Math.random().toString(36).substr(2, 9);
localStorage.setItem("myId", myId);

// 1. GESTÃO DO HISTÓRICO
document.getElementById("btnToggleHist").onclick = () => {
    var s = document.getElementById("hist-section");
    s.style.display = (s.style.display === "block") ? "none" : "block";
    if(s.style.display === "block") consultarTotal(30);
};

// 2. APAGAR TUDO (COM DUPLO AVISO)
async function apagarTudoPermanente() {
    if(confirm("AVISO 1: Deseja apagar TODO o histórico permanente?")) {
        if(confirm("AVISO FINAL: Tem a certeza absoluta? Não poderá recuperar estes dados.")) {
            var snap = await householdRef.collection("arquivo_permanente").get();
            let b = db.batch();
            snap.docs.forEach(d => b.delete(d.ref));
            await b.commit();
            alert("Histórico apagado com sucesso.");
            location.reload();
        }
    }
}

// 3. LISTA ATUAL COM DATA E DESIGN
householdRef.collection("expenses").orderBy("date", "desc").onSnapshot(snap => {
    var list = document.getElementById("list"), ts = 0, tr = 0;
    list.innerHTML = "";
    snap.forEach(doc => {
        var e = doc.data();
        if(e.payer === "Sara") ts += e.amount; else tr += e.amount;
        list.innerHTML += `
            <div class="expense-item">
                <div class="exp-info">
                    <span class="exp-date">${e.date.split('-').reverse().join('/')}</span>
                    <span class="exp-desc"><b>${e.payer}</b>: ${e.description}</span>
                </div>
                <span class="exp-amt">${e.amount.toFixed(2)}€</span>
            </div>`;
    });
    document.getElementById("totalSum").textContent = (ts + tr).toFixed(2);
    document.getElementById("balanceSara").textContent = ts.toFixed(2) + "€";
    document.getElementById("balanceRui").textContent = tr.toFixed(2) + "€";
    var s = document.getElementById("settlements"), diff = (ts - tr) / 2;
    if((ts+tr) === 0 || Math.abs(diff) < 0.01) {
        s.style.background = "#d1fae5"; s.innerHTML = "✅ Tudo certo!";
    } else {
        s.style.background = "#fee2e2";
        s.innerHTML = diff > 0 ? `👨 Rui deve <b>${diff.toFixed(2)}€</b>` : `👩 Sara deve <b>${Math.abs(diff).toFixed(2)}€</b>`;
    }
});

// 4. GUARDAR
document.getElementById("expenseForm").onsubmit = async (e) => {
    e.preventDefault();
    var obj = {
        payer: document.getElementById("payer").value,
        amount: parseFloat(document.getElementById("amount").value),
        description: document.getElementById("description").value,
        date: new Date().toISOString().split('T')[0]
    };
    await householdRef.collection("expenses").add(obj);
    await householdRef.collection("arquivo_permanente").add(obj);
    e.target.reset();
};

// 5. FILTROS DE TEMPO
async function consultarTotal(dias) {
    var limite = new Date();
    limite.setHours(0,0,0,0);
    if(dias > 0) limite.setDate(limite.getDate() - dias);
    var iso = limite.toISOString().split('T')[0];
    
    var snap = await householdRef.collection("arquivo_permanente").where("date", ">=", iso).get();
    var total = 0;
    snap.forEach(d => total += d.data().amount);
    document.getElementById("histTotal").textContent = total.toFixed(2);
}

// 6. APROVAÇÃO BLOQUEADA
var podeLimpar = false;
householdRef.onSnapshot(doc => {
    var v = (doc.data() || {}).archiveVotes || { sara: false, rui: false };
    document.getElementById("archiveSara").style.background = v.sara ? "#10b981" : "#f1f5f9";
    document.getElementById("archiveSara").style.color = v.sara ? "#fff" : "#64748b";
    document.getElementById("archiveRui").style.background = v.rui ? "#10b981" : "#f1f5f9";
    document.getElementById("archiveRui").style.color = v.rui ? "#fff" : "#64748b";
    
    podeLimpar = (v.sara && v.rui);
    document.getElementById("msgAviso").style.display = podeLimpar ? "none" : "block";
});

async function votar(p) {
    var doc = await householdRef.get();
    var v = (doc.data() || {}).archiveVotes || { sara: false, rui: false, saraDev: "", ruiDev: "" };
    var c = p.toLowerCase(), o = (c === "sara") ? "rui" : "sara";
    if (v[o+"Dev"] === myId && !v[c]) { alert("Este aparelho já votou por outra pessoa!"); return; }
    var up = {}; up["archiveVotes."+c] = !v[c]; up["archiveVotes."+c+"Dev"] = v[c] ? "" : myId;
    await householdRef.update(up);
}
document.getElementById("archiveSara").onclick = () => votar("Sara");
document.getElementById("archiveRui").onclick = () => votar("Rui");

// 7. DOWNLOAD E LIMPEZA (SEPARADOS)
document.getElementById("btnDownload").onclick = async () => {
    const snap = await householdRef.collection("expenses").get();
    if(snap.empty) return alert("Nada para exportar.");
    
    const { Document, Packer, Paragraph, TextRun } = docx;
    let lines = [];
    snap.forEach(d => {
        let e = d.data();
        lines.push(new Paragraph({ children: [new TextRun(`${e.date} | ${e.payer}: ${e.description} - ${e.amount}€`)] }));
    });

    const doc = new Document({ sections: [{ children: lines }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Relatorio_Contas_${new Date().getTime()}.docx`);
};

document.getElementById("btnClearList").onclick = async () => {
    if(!podeLimpar) return alert("Erro: Sara e Rui precisam de aprovar primeiro nos botões verdes!");
    if(!confirm("Tem a certeza que quer apagar a lista atual? O histórico permanente será mantido.")) return;
    
    var snap = await householdRef.collection("expenses").get();
    let b = db.batch();
    snap.docs.forEach(d => b.delete(d.ref));
    await b.commit();
    await householdRef.update({ "archiveVotes": { sara: false, rui: false, saraDev: "", ruiDev: "" } });
    alert("Lista limpa!");
};
