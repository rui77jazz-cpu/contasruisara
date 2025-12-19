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

// 1. ATUALIZAÇÃO E CÁLCULO DE DÍVIDA (RESOLVE O BUG DO "TUDO CERTO")
householdRef.collection("expenses").onSnapshot(function(snap) {
    var list = document.getElementById("list");
    list.innerHTML = "";
    var ts = 0, tr = 0;

    snap.forEach(function(doc) {
        var e = doc.data();
        if(e.payer === "Sara") ts += e.amount; else tr += e.amount;
        list.innerHTML += `<div style="display:flex;justify-content:space-between;padding:8px;border-bottom:1px solid #eee">
            <span>${e.payer}: ${e.description}</span><b>${e.amount.toFixed(2)}€</b>
        </div>`;
    });

    var total = ts + tr;
    document.getElementById("totalSum").textContent = total.toFixed(2) + " €";
    document.getElementById("balanceSara").textContent = ts.toFixed(2);
    document.getElementById("balanceRui").textContent = tr.toFixed(2);

    var s = document.getElementById("settlements");
    var diff = (ts - tr) / 2; // Ex: (45 - 58) / 2 = -6.50

    if (total === 0 || Math.abs(diff) < 0.01) {
        s.style.background = "#d1fae5"; s.style.color = "#065f46";
        s.innerHTML = "✅ Tudo certo!";
    } else if (diff > 0) {
        s.style.background = "#fee2e2"; s.style.color = "#991b1b";
        s.innerHTML = `👨 Rui deve <b>${diff.toFixed(2)}€</b> a 👩 Sara`;
    } else {
        s.style.background = "#fee2e2"; s.style.color = "#991b1b";
        s.innerHTML = `👩 Sara deve <b>${Math.abs(diff).toFixed(2)}€</b> ao 👨 Rui`;
    }
});

// 2. GUARDAR DESPESA (RESOLVE O BUG DE NÃO GRAVAR)
document.getElementById("expenseForm").onsubmit = function(e) {
    e.preventDefault();
    var val = parseFloat(document.getElementById("amount").value);
    var pay = document.getElementById("payer").value;
    var des = document.getElementById("description").value;

    if(!val || !des) { alert("Preenche os campos!"); return; }

    householdRef.collection("expenses").add({
        payer: pay, amount: val, description: des, date: new Date().toISOString()
    }).then(function() {
        e.target.reset();
        console.log("Gravado!");
    }).catch(function(err) { alert("Erro ao gravar: " + err.message); });
};

// 3. LIMPEZA E RELATÓRIO (ACUMULADO)
document.getElementById("clearBtn").onclick = async function() {
    if(!confirm("Gerar relatório e limpar tudo?")) return;
    const cur = await householdRef.collection("expenses").get();
    const hist = await householdRef.collection("historico").get();
    
    let all = [], ts = 0, tr = 0;
    [...cur.docs, ...hist.docs].forEach(d => {
        let e = d.data(); all.push(e);
        if(e.payer === "Sara") ts += e.amount; else tr += e.amount;
    });

    // Aqui o Word vai com o valor de acerto final (Histórico + Atual)
    let finalDiff = (ts - tr) / 2;
    let acertoDoc = (finalDiff > 0) ? `Rui deve ${finalDiff.toFixed(2)}€ à Sara` : `Sara deve ${Math.abs(finalDiff).toFixed(2)}€ ao Rui`;

    const { Document, Packer, Paragraph, TextRun } = docx;
    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({ text: "RELATÓRIO ACUMULADO", heading: "Heading1" }),
                new Paragraph({ text: "Acerto Final: " + acertoDoc, bold: true }),
                ...all.map(e => new Paragraph({ text: `${e.payer}: ${e.description} - ${e.amount}€` }))
            ]
        }]
    });

    Packer.toBlob(doc).then(blob => {
        saveAs(blob, "Contas_Sara_Rui.docx");
        let batch = db.batch();
        cur.docs.forEach(d => batch.delete(d.ref));
        hist.docs.forEach(d => batch.delete(d.ref));
        batch.commit().then(() => location.reload());
    });
};
