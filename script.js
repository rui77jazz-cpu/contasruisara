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

// Identificador do dispositivo para a votação
var myDevId = localStorage.getItem("devId") || "d_" + Math.random().toString(36).substr(2, 9);
localStorage.setItem("devId", myDevId);

// --- ATUALIZAÇÃO EM TEMPO REAL E VOTAÇÃO ---
householdRef.onSnapshot(function(doc) {
    var data = doc.data() || {};
    var votes = data.archiveVotes || {};
    
    // Atualiza o aspeto dos botões de aprovação
    var btnS = document.getElementById("archiveSara");
    var btnR = document.getElementById("archiveRui");
    
    if(btnS) btnS.className = "v-btn" + (votes.sara ? " voted" : "");
    if(btnR) btnR.className = "v-btn" + (votes.rui ? " voted" : "");

    // Se ambos votarem, arquiva automaticamente
    if(votes.sara && votes.rui) {
        setTimeout(archiveCurrentExpenses, 1000);
    }
});

// --- LISTA DE DESPESAS ATUAIS ---
householdRef.collection("expenses").orderBy("date", "desc").onSnapshot(function(snap) {
    var list = document.getElementById("list");
    if(list) list.innerHTML = "";
    var ts = 0, tr = 0;

    snap.forEach(function(doc) {
        var e = doc.data();
        if(e.payer === "Sara") ts += e.amount; else tr += e.amount;
        if(list) list.innerHTML += `<div class="expense-item"><span>${e.payer}: ${e.description}</span><b>${e.amount.toFixed(2)}€</b></div>`;
    });

    document.getElementById("totalSum").textContent = (ts + tr).toFixed(2);
    document.getElementById("balanceSara").textContent = ts.toFixed(2);
    document.getElementById("balanceRui").textContent = tr.toFixed(2);

    var s = document.getElementById("settlements");
    var diff = (ts - tr) / 2;
    if((ts+tr) === 0 || Math.abs(diff) < 0.01) {
        s.className = "settlement even"; s.innerHTML = "✅ Tudo certo!";
    } else {
        s.className = "settlement pay";
        s.innerHTML = diff > 0 ? `👨 Rui deve <b>${diff.toFixed(2)}€</b> a 👩 Sara` : `👩 Sara deve <b>${Math.abs(diff).toFixed(2)}€</b> a 👨 Rui`;
    }
});

// --- FUNÇÃO DE VOTAÇÃO ---
async function vote(user) {
    var doc = await householdRef.get();
    var votes = doc.data().archiveVotes || {};
    var field = user.toLowerCase();

    if(votes[field]) return; // Já votou
    
    var update = {};
    update["archiveVotes." + field] = true;
    update["archiveVotes." + field + "Dev"] = myDevId;
    
    await householdRef.update(update);
}

document.getElementById("archiveSara").onclick = function() { vote("Sara"); };
document.getElementById("archiveRui").onclick = function() { vote("Rui"); };

// --- ARQUIVAR DESPESAS (QUANDO AMBOS APROVAM) ---
async function archiveCurrentExpenses() {
    var snap = await householdRef.collection("expenses").get();
    if(snap.empty) return resetVotes();

    var batch = db.batch();
    snap.docs.forEach(function(d) {
        var data = d.data();
        data.archivedAt = new Date().toISOString();
        batch.set(householdRef.collection("historico").doc(), data);
        batch.delete(d.ref);
    });

    await batch.commit();
    await resetVotes();
    alert("Despesas arquivadas no histórico!");
}

function resetVotes() {
    return householdRef.update({ archiveVotes: { sara: false, rui: false } });
}

// --- BOTÃO DO HISTÓRICO (ABRIR E FILTRAR) ---
document.getElementById("histToggle").onclick = function() {
    var section = document.getElementById("hist-section");
    section.style.display = section.style.display === "none" ? "block" : "none";
    if(section.style.display === "block") loadHistory(30); // Padrão 30 dias
};

async function loadHistory(days) {
    var limitDate = new Date();
    limitDate.setDate(limitDate.getDate() - days);
    var dateStr = limitDate.toISOString().slice(0,10);

    var snap = await householdRef.collection("historico")
        .where("date", ">=", dateStr)
        .get();

    var totalH = 0;
    snap.forEach(d => totalH += d.data().amount);
    document.getElementById("histTotal").textContent = totalH.toFixed(2) + "€";
}

// --- GERAR DOCX E LIMPAR TUDO ---
document.getElementById("clearBtn").onclick = async function() {
    if(!confirm("Gerar Word e APAGAR TODO o histórico e despesas atuais?")) return;

    var cur = await householdRef.collection("expenses").get();
    var hist = await householdRef.collection("historico").get();
    
    var all = [], ts = 0, tr = 0;
    [...cur.docs, ...hist.docs].forEach(d => {
        var e = d.data(); all.push(e);
        if(e.payer === "Sara") ts += e.amount; else tr += e.amount;
    });

    var diff = (ts - tr) / 2;
    var acerto = diff > 0 ? `Rui deve ${diff.toFixed(2)}€` : `Sara deve ${Math.abs(diff).toFixed(2)}€`;

    const { Document, Packer, Paragraph, TextRun } = docx;
    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({ text: "RELATÓRIO FINAL", heading: "Heading1" }),
                new Paragraph({ text: "Acerto Final: " + acerto, bold: true }),
                ...all.map(e => new Paragraph({ text: `${e.date} - ${e.payer}: ${e.description} (${e.amount}€)` }))
            ]
        }]
    });

    Packer.toBlob(doc).then(blob => {
        saveAs(blob, "Relatorio_Contas.docx");
        var batch = db.batch();
        cur.docs.forEach(d => batch.delete(d.ref));
        hist.docs.forEach(d => batch.delete(d.ref));
        batch.commit().then(() => location.reload());
    });
};
