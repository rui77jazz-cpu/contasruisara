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

// 1. HISTÓRICO E IMPORTAÇÃO
document.getElementById("btnToggleHist").onclick = async function() {
    var sec = document.getElementById("hist-section");
    if(sec.style.display === "none" || sec.style.display === "") {
        sec.style.display = "block";
        // Verifica se precisa importar dados antigos
        var perm = await householdRef.collection("arquivo_permanente").limit(1).get();
        var current = await householdRef.collection("expenses").get();
        if(perm.empty && !current.empty) {
            if(confirm("Queres mover as contas atuais para o histórico permanente?")) {
                let b = db.batch();
                current.docs.forEach(d => b.set(householdRef.collection("arquivo_permanente").doc(), d.data()));
                await b.commit();
                alert("Dados importados!");
            }
        }
    } else { sec.style.display = "none"; }
};

// 2. APAGAR ARQUIVO PERMANENTE (PARA TESTES)
async function apagarTudoPermanente() {
    if(!confirm("CUIDADO: Isto vai apagar TODO o histórico de meses/anos para sempre. Continuar?")) return;
    var snap = await householdRef.collection("arquivo_permanente").get();
    let b = db.batch();
    snap.docs.forEach(d => b.delete(d.ref));
    await b.commit();
    document.getElementById("histTotal").textContent = "0.00";
    alert("Arquivo permanente limpo.");
}

// 3. LISTA E SALDOS
householdRef.collection("expenses").orderBy("date", "desc").onSnapshot(function(snap) {
    var list = document.getElementById("list"), ts = 0, tr = 0;
    list.innerHTML = "";
    snap.forEach(function(doc) {
        var e = doc.data();
        if(e.payer === "Sara") ts += e.amount; else tr += e.amount;
        list.innerHTML += `<div class="expense-item"><span>${e.payer}: ${e.description}</span><b>${e.amount.toFixed(2)}€</b></div>`;
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
document.getElementById("expenseForm").onsubmit = async function(e) {
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

// 5. CONSULTAR TOTAL
async function consultarTotal(dias) {
    var limite = new Date();
    limite.setDate(limite.getDate() - dias);
    var iso = limite.toISOString().split('T')[0];
    var snap = await householdRef.collection("arquivo_permanente").where("date", ">=", iso).get();
    var total = 0;
    snap.forEach(d => total += d.data().amount);
    document.getElementById("histTotal").textContent = total.toFixed(2);
}

// 6. APROVAÇÃO E WORD
householdRef.onSnapshot(function(doc) {
    var v = (doc.data() || {}).archiveVotes || { sara: false, rui: false, saraDev: "", ruiDev: "" };
    document.getElementById("archiveSara").style.background = v.sara ? "#d1fae5" : "#f1f5f9";
    document.getElementById("archiveRui").style.background = v.rui ? "#d1fae5" : "#f1f5f9";
    if(v.sara && v.rui) { setTimeout(limparLista, 1000); }
});

async function votar(p) {
    var doc = await householdRef.get();
    var v = (doc.data() || {}).archiveVotes || { sara: false, rui: false, saraDev: "", ruiDev: "" };
    var c = p.toLowerCase(), o = (c === "sara") ? "rui" : "sara";
    if (v[o + "Dev"] === myId && !v[c]) { alert("Este aparelho já votou!"); return; }
    var up = {}; up["archiveVotes."+c] = !v[c]; up["archiveVotes."+c+"Dev"] = v[c] ? "" : myId;
    await householdRef.update(up);
}
document.getElementById("archiveSara").onclick = () => votar("Sara");
document.getElementById("archiveRui").onclick = () => votar("Rui");

async function limparLista() {
    var snap = await householdRef.collection("expenses").get();
    var b = db.batch();
    snap.docs.forEach(d => b.delete(d.ref));
    await b.commit();
    await householdRef.update({ "archiveVotes": { sara: false, rui: false, saraDev: "", ruiDev: "" } });
}

document.getElementById("clearBtn").onclick = async function() {
    if(!confirm("Gerar Word e limpar lista atual?")) return;
    const snap = await householdRef.collection("expenses").get();
    let data = []; snap.forEach(d => data.push(d.data()));
    const { Document, Packer, Paragraph } = docx;
    const doc = new Document({ sections: [{ children: data.map(e => new Paragraph({ text: `${e.date} - ${e.payer}: ${e.amount}€` })) }] });
    Packer.toBlob(doc).then(blob => {
        saveAs(blob, `Contas_${new Date().getTime()}.docx`);
        limparLista();
    });
};
