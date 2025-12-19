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

// ID DO APARELHO PARA BLOQUEIO
var myDeviceId = localStorage.getItem("myId") || "dev_" + Math.random().toString(36).substr(2, 9);
localStorage.setItem("myId", myDeviceId);

// --- 1. HISTÓRICO (ABRIR/FECHAR) ---
document.getElementById("btnToggleHist").onclick = function(e) {
    e.preventDefault();
    var sec = document.getElementById("hist-section");
    if (sec.style.display === "none" || sec.style.display === "") {
        sec.style.setProperty("display", "block", "important");
        this.textContent = "❌ Fechar";
        filtrarHist(30);
    } else {
        sec.style.setProperty("display", "none", "important");
        this.textContent = "📜 Histórico";
    }
};

// --- 2. VOTAÇÃO ---
householdRef.onSnapshot(function(doc) {
    var data = doc.data() || {};
    var v = data.archiveVotes || { sara: false, rui: false, saraDev: "", ruiDev: "" };
    var bS = document.getElementById("archiveSara");
    var bR = document.getElementById("archiveRui");
    bS.style.background = v.sara ? "#d1fae5" : "#f1f5f9";
    bS.style.color = v.sara ? "#065f46" : "#64748b";
    bR.style.background = v.rui ? "#d1fae5" : "#f1f5f9";
    bR.style.color = v.rui ? "#065f46" : "#64748b";
    if(v.sara && v.rui) { setTimeout(archiveData, 1000); }
});

async function processVote(pessoa) {
    var doc = await householdRef.get();
    var data = doc.data() || {};
    var v = data.archiveVotes || { sara: false, rui: false, saraDev: "", ruiDev: "" };
    var campo = pessoa.toLowerCase();
    var outro = (campo === "sara") ? "rui" : "sara";
    if (v[outro + "Dev"] === myDeviceId && !v[campo]) {
        alert("Erro: O outro já votou neste aparelho!");
        return;
    }
    var up = {};
    up["archiveVotes." + campo] = !v[campo];
    up["archiveVotes." + campo + "Dev"] = v[campo] ? "" : myDeviceId;
    await householdRef.update(up);
}

document.getElementById("archiveSara").onclick = () => processVote("Sara");
document.getElementById("archiveRui").onclick = () => processVote("Rui");

// --- 3. LISTA E CÁLCULOS ---
householdRef.collection("expenses").orderBy("date", "desc").onSnapshot(function(snap) {
    var list = document.getElementById("list");
    list.innerHTML = "";
    var ts = 0, tr = 0;
    snap.forEach(function(doc) {
        var e = doc.data();
        if(e.payer === "Sara") ts += e.amount; else tr += e.amount;
        list.innerHTML += `<div class="expense-item"><span>${e.payer}: ${e.description}</span><b>${e.amount.toFixed(2)}€</b></div>`;
    });
    document.getElementById("totalSum").textContent = (ts + tr).toFixed(2);
    document.getElementById("balanceSara").textContent = ts.toFixed(2) + "€";
    document.getElementById("balanceRui").textContent = tr.toFixed(2) + "€";
    var s = document.getElementById("settlements");
    var diff = (ts - tr) / 2;
    if((ts+tr) === 0 || Math.abs(diff) < 0.01) {
        s.className = "settlement even"; s.innerHTML = "✅ Tudo certo!";
    } else {
        s.className = "settlement pay";
        s.innerHTML = diff > 0 ? `👨 Rui deve <b>${diff.toFixed(2)}€</b> a 👩 Sara` : `👩 Sara deve <b>${Math.abs(diff).toFixed(2)}€</b> a 👨 Rui`;
    }
});

// --- 4. GUARDAR E ARQUIVAR ---
document.getElementById("expenseForm").onsubmit = function(e) {
    e.preventDefault();
    householdRef.collection("expenses").add({
        payer: document.getElementById("payer").value,
        amount: parseFloat(document.getElementById("amount").value),
        description: document.getElementById("description").value,
        date: new Date().toISOString().split('T')[0]
    }).then(() => e.target.reset());
};

async function archiveData() {
    var snap = await householdRef.collection("expenses").get();
    if(snap.empty) return resetVotes();
    var batch = db.batch();
    snap.docs.forEach(d => {
        batch.set(householdRef.collection("historico").doc(), d.data());
        batch.delete(d.ref);
    });
    await batch.commit();
    await resetVotes();
}

function resetVotes() {
    return householdRef.update({ "archiveVotes": { sara: false, rui: false, saraDev: "", ruiDev: "" } });
}

async function filtrarHist(dias) {
    var limit = new Date();
    limit.setDate(limit.getDate() - dias);
    var iso = limit.toISOString().split('T')[0];
    var snap = await householdRef.collection("historico").where("date", ">=", iso).get();
    var sum = 0, html = "";
    snap.forEach(d => {
        var e = d.data(); sum += e.amount;
        html += `<div style="padding:5px 0; border-bottom:1px solid #ddd">${e.date} | ${e.payer}: ${e.amount.toFixed(2)}€</div>`;
    });
    document.getElementById("histTotal").textContent = sum.toFixed(2);
    document.getElementById("histList").innerHTML = html || "Sem registos.";
}

// --- 5. LIMPEZA TOTAL COM NOME ÚNICO PARA TELEMÓVEL ---
document.getElementById("clearBtn").onclick = async function() {
    if(!confirm("Gerar relatório e LIMPAR TUDO?")) return;
    const cur = await householdRef.collection("expenses").get();
    const his = await householdRef.collection("historico").get();
    let data = [];
    [...cur.docs, ...his.docs].forEach(d => data.push(d.data()));

    const { Document, Packer, Paragraph } = docx;
    const doc = new Document({ sections: [{ children: [
        new Paragraph({ text: "RELATÓRIO SARA & RUI", heading: "Heading1" }),
        ...data.map(e => new Paragraph({ text: `${e.date} - ${e.payer}: ${e.description} (${e.amount.toFixed(2)}€)` }))
    ]}]});

    Packer.toBlob(doc).then(blob => {
        const agora = new Date();
        const nomeFinal = `Contas_${agora.getDate()}_${agora.getMonth()+1}_${agora.getHours()}h${agora.getMinutes()}.docx`;
        
        saveAs(blob, nomeFinal);
        
        let b = db.batch();
        cur.docs.forEach(d => b.delete(d.ref));
        his.docs.forEach(d => b.delete(d.ref));
        b.commit().then(() => {
            alert("Relatório guardado como: " + nomeFinal);
            location.reload();
        });
    });
};
