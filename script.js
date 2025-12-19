// CONFIGURAÇÃO FIREBASE (Usa a tua original)
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

// --- 1. GESTÃO DE VOTAÇÃO (APROVAR ARQUIVO) ---
householdRef.onSnapshot(function(doc) {
    var data = doc.data() || {};
    var votes = data.archiveVotes || { sara: false, rui: false };
    
    // Atualiza visual dos botões de aprovação
    var btnS = document.getElementById("archiveSara");
    var btnR = document.getElementById("archiveRui");
    
    if(btnS) btnS.style.background = votes.sara ? "#10b981" : "#e2e8f0";
    if(btnR) btnR.style.background = votes.rui ? "#10b981" : "#e2e8f0";

    // Se os dois aprovarem, move para o histórico
    if(votes.sara && votes.rui) {
        archiveNow();
    }
});

async function toggleVote(pessoa) {
    var doc = await householdRef.get();
    var v = doc.data().archiveVotes || { sara: false, rui: false };
    var campo = pessoa.toLowerCase();
    
    var up = {};
    up["archiveVotes." + campo] = !v[campo];
    await householdRef.update(up);
}

// Ligar os botões de aprovação do teu HTML
document.getElementById("archiveSara").onclick = function() { toggleVote('Sara'); };
document.getElementById("archiveRui").onclick = function() { toggleVote('Rui'); };

// --- 2. MOSTRAR DESPESAS E CÁLCULO CERTO ---
householdRef.collection("expenses").orderBy("date", "desc").onSnapshot(function(snap) {
    var list = document.getElementById("list");
    var ts = 0, tr = 0;
    list.innerHTML = "";

    snap.forEach(function(doc) {
        var e = doc.data();
        if(e.payer === "Sara") ts += e.amount; else tr += e.amount;
        list.innerHTML += `<div class="item"><span>${e.payer}: ${e.description}</span><b>${e.amount.toFixed(2)}€</b></div>`;
    });

    document.getElementById("totalSum").textContent = (ts + tr).toFixed(2);
    document.getElementById("balanceSara").textContent = ts.toFixed(2);
    document.getElementById("balanceRui").textContent = tr.toFixed(2);

    var s = document.getElementById("settlements");
    var diff = (ts - tr) / 2;
    if((ts+tr) === 0 || Math.abs(diff) < 0.01) {
        s.style.background = "#dcfce7"; s.innerHTML = "✅ Tudo certo!";
    } else {
        s.style.background = "#fee2e2";
        s.innerHTML = diff > 0 ? `👨 Rui deve <b>${diff.toFixed(2)}€</b> a 👩 Sara` : `👩 Sara deve <b>${Math.abs(diff).toFixed(2)}€</b> a 👨 Rui`;
    }
});

// --- 3. MOVER PARA HISTÓRICO ---
async function archiveNow() {
    var snap = await householdRef.collection("expenses").get();
    if(snap.empty) return;

    var batch = db.batch();
    snap.docs.forEach(d => {
        batch.set(householdRef.collection("historico").doc(), d.data());
        batch.delete(d.ref);
    });
    
    await batch.commit();
    await householdRef.update({ "archiveVotes": { sara: false, rui: false } });
    alert("Arquivado!");
}

// --- 4. FILTROS DE TEMPO (7, 15, 30 DIAS) ---
async function filtrarHist(dias) {
    var dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);
    var isoDate = dataLimite.toISOString().split('T')[0];

    var snap = await householdRef.collection("historico")
        .where("date", ">=", isoDate)
        .get();

    var totalH = 0;
    snap.forEach(d => totalH += d.data().amount);
    
    document.getElementById("histTotal").textContent = totalH.toFixed(2) + "€";
    document.getElementById("hist-section").style.display = "block";
}

// --- 5. LIMPEZA TOTAL E WORD ---
document.getElementById("clearBtn").onclick = async function() {
    if(!confirm("Gerar Word e LIMPAR TUDO?")) return;

    const cur = await householdRef.collection("expenses").get();
    const hist = await householdRef.collection("historico").get();
    
    let reportData = [];
    cur.forEach(d => reportData.push(d.data()));
    hist.forEach(d => reportData.push(d.data()));

    const { Document, Packer, Paragraph } = docx;
    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({ text: "RELATÓRIO DE CONTAS", heading: "Heading1" }),
                ...reportData.map(e => new Paragraph({ text: `${e.date} | ${e.payer}: ${e.description} - ${e.amount}€` }))
            ]
        }]
    });

    Packer.toBlob(doc).then(blob => {
        saveAs(blob, "Relatorio_Sara_Rui.docx");
        let batch = db.batch();
        cur.docs.forEach(d => batch.delete(d.ref));
        hist.docs.forEach(d => batch.delete(d.ref));
        batch.commit().then(() => location.reload());
    });
};
