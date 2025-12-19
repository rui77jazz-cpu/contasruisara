// CONFIGURAÇÃO FIREBASE
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

// 1. SINCRONIZAÇÃO DE VOTOS E ARQUIVO AUTOMÁTICO
householdRef.onSnapshot(function(doc) {
    var data = doc.data() || {};
    var votes = data.archiveVotes || { sara: false, rui: false };
    
    var bS = document.getElementById("archiveSara");
    var bR = document.getElementById("archiveRui");

    // Aplica a classe 'active' se o voto for true
    if(votes.sara) bS.classList.add("active"); else bS.classList.remove("active");
    if(votes.rui) bR.classList.add("active"); else bR.classList.remove("active");

    // Se ambos votaram, executa o arquivo
    if(votes.sara && votes.rui) {
        setTimeout(executarArquivo, 800);
    }
});

async function toggleVoto(quem) {
    var doc = await householdRef.get();
    var data = doc.data() || {};
    var currentVotes = data.archiveVotes || { sara: false, rui: false };
    var campo = quem.toLowerCase();
    
    var obj = {};
    obj["archiveVotes." + campo] = !currentVotes[campo];
    await householdRef.update(obj);
}

document.getElementById("archiveSara").onclick = () => toggleVoto("Sara");
document.getElementById("archiveRui").onclick = () => toggleVoto("Rui");

async function executarArquivo() {
    var snap = await householdRef.collection("expenses").get();
    if(snap.empty) return resetVotos();

    var batch = db.batch();
    snap.docs.forEach(d => {
        batch.set(householdRef.collection("historico").doc(), d.data());
        batch.delete(d.ref);
    });
    
    await batch.commit();
    await resetVotos();
    alert("Despesas movidas para o histórico!");
}

function resetVotos() {
    return householdRef.update({ "archiveVotes.sara": false, "archiveVotes.rui": false });
}

// 2. LISTA E CÁLCULOS
householdRef.collection("expenses").orderBy("date", "desc").onSnapshot(function(snap) {
    var list = document.getElementById("list");
    list.innerHTML = "";
    var ts = 0, tr = 0;

    snap.forEach(function(doc) {
        var e = doc.data();
        if(e.payer === "Sara") ts += e.amount; else tr += e.amount;
        list.innerHTML += `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9">
            <span>${e.payer}: ${e.description}</span><b>${e.amount.toFixed(2)}€</b>
        </div>`;
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

// 3. GUARDAR E HISTÓRICO
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

document.getElementById("histToggle").onclick = () => {
    var sec = document.getElementById("hist-section");
    sec.style.display = sec.style.display === "none" ? "block" : "none";
};

async function filtrarHist(dias) {
    var dataCorte = new Date();
    dataCorte.setDate(dataCorte.getDate() - dias);
    var iso = dataCorte.toISOString().split('T')[0];

    var snap = await householdRef.collection("historico").where("date", ">=", iso).get();
    var total = 0, html = "";
    snap.forEach(d => {
        var e = d.data(); total += e.amount;
        html += `<div>${e.date} - ${e.payer}: ${e.amount.toFixed(2)}€</div>`;
    });
    document.getElementById("histTotal").textContent = total.toFixed(2);
    document.getElementById("histList").innerHTML = html;
}

// 4. LIMPEZA TOTAL E DOCX
document.getElementById("clearBtn").onclick = async function() {
    if(!confirm("Gerar relatório e LIMPAR TUDO?")) return;
    const cur = await householdRef.collection("expenses").get();
    const his = await householdRef.collection("historico").get();
    let data = [];
    [...cur.docs, ...his.docs].forEach(d => data.push(d.data()));

    const { Document, Packer, Paragraph } = docx;
    const doc = new Document({ sections: [{ children: [
        new Paragraph({ text: "RELATÓRIO FINAL DE CONTAS", heading: "Heading1" }),
        ...data.map(e => new Paragraph({ text: `${e.date} | ${e.payer}: ${e.description} - ${e.amount}€` }))
    ]}]});

    Packer.toBlob(doc).then(blob => {
        saveAs(blob, "Relatorio_Final.docx");
        let batch = db.batch();
        cur.docs.forEach(d => batch.delete(d.ref));
        his.docs.forEach(d => batch.delete(d.ref));
        batch.commit().then(() => location.reload());
    });
};
