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

// IDENTIFICAÇÃO DO APARELHO (Segurança)
var deviceId = localStorage.getItem("myDeviceId") || "dev_" + Math.random().toString(36).substr(2, 9);
localStorage.setItem("myDeviceId", deviceId);

// 1. SINCRONIZAÇÃO DE VOTOS E ARQUIVO
householdRef.onSnapshot(function(doc) {
    var data = doc.data() || {};
    var v = data.archiveVotes || { sara: false, rui: false, saraDev: "", ruiDev: "" };
    
    var bS = document.getElementById("archiveSara");
    var bR = document.getElementById("archiveRui");

    // Cores: Cinza se não votou, Verde se votou
    bS.style.background = v.sara ? "#d1fae5" : "#f1f5f9";
    bS.style.color = v.sara ? "#065f46" : "#64748b";
    bR.style.background = v.rui ? "#d1fae5" : "#f1f5f9";
    bR.style.color = v.rui ? "#065f46" : "#64748b";

    if(v.sara && v.rui) { 
        setTimeout(archiveData, 1000); 
    }
});

async function processVote(person) {
    var doc = await householdRef.get();
    var data = doc.data() || {};
    var v = data.archiveVotes || { sara: false, rui: false, saraDev: "", ruiDev: "" };
    var field = person.toLowerCase();
    var other = (field === "sara") ? "rui" : "sara";

    // BLOQUEIO: Não deixa votar pelos dois no mesmo telemóvel
    if (v[other + "Dev"] === deviceId && !v[field]) {
        alert("Já foi feito um voto neste aparelho. O " + other + " tem de votar no telemóvel dele!");
        return;
    }

    var update = {};
    update["archiveVotes." + field] = !v[field];
    update["archiveVotes." + field + "Dev"] = deviceId;
    await householdRef.update(update);
}

document.getElementById("archiveSara").onclick = () => processVote("Sara");
document.getElementById("archiveRui").onclick = () => processVote("Rui");

// 2. LISTA ATUAL E CÁLCULOS (45 vs 58 corrigido)
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

// 3. GUARDAR DESPESA
document.getElementById("expenseForm").onsubmit = function(e) {
    e.preventDefault();
    var val = parseFloat(document.getElementById("amount").value);
    householdRef.collection("expenses").add({
        payer: document.getElementById("payer").value,
        amount: val,
        description: document.getElementById("description").value,
        date: new Date().toISOString().split('T')[0]
    }).then(() => e.target.reset());
};

// 4. HISTÓRICO E ARQUIVO
function toggleHistSection() {
    var sec = document.getElementById("hist-section");
    sec.style.display = sec.style.display === "none" ? "block" : "none";
}

async function archiveData() {
    var snap = await householdRef.collection("expenses").get();
    if(snap.empty) return resetAllVotes();

    var batch = db.batch();
    snap.docs.forEach(d => {
        batch.set(householdRef.collection("historico").doc(), d.data());
        batch.delete(d.ref);
    });
    await batch.commit();
    await resetAllVotes();
    alert("Arquivado com sucesso!");
}

function resetAllVotes() {
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
        html += `<div>${e.date} | ${e.payer}: ${e.amount.toFixed(2)}€</div>`;
    });
    document.getElementById("histTotal").textContent = sum.toFixed(2);
    document.getElementById("histList").innerHTML = html;
}

// 5. LIMPEZA TOTAL E DOCX
document.getElementById("clearBtn").onclick = async function() {
    if(!confirm("Gerar Word e LIMPAR TUDO permanentemente?")) return;
    const cur = await householdRef.collection("expenses").get();
    const his = await householdRef.collection("historico").get();
    let data = [];
    [...cur.docs, ...his.docs].forEach(d => data.push(d.data()));

    const { Document, Packer, Paragraph } = docx;
    const doc = new Document({ sections: [{ children: [
        new Paragraph({ text: "RELATÓRIO DE CONTAS - SARA & RUI", heading: "Heading1" }),
        ...data.map(e => new Paragraph({ text: `${e.date} - ${e.payer}: ${e.description} (${e.amount}€)` }))
    ]}]});

    Packer.toBlob(doc).then(blob => {
        saveAs(blob, "Contas_SaraRui.docx");
        let b = db.batch();
        cur.docs.forEach(d => b.delete(d.ref));
        his.docs.forEach(d => b.delete(d.ref));
        b.commit().then(() => location.reload());
    });
};
