// CONFIGURAÇÃO
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

// 1. ATUALIZAÇÃO EM TEMPO REAL
householdRef.collection("expenses").onSnapshot(function(snap) {
    var list = document.getElementById("list");
    list.innerHTML = "";
    var ts = 0, tr = 0;

    snap.forEach(function(doc) {
        var e = doc.data();
        if(e.payer === "Sara") ts += e.amount; else tr += e.amount;
        list.innerHTML += `<div class="expense-item"><span>${e.payer}: ${e.description}</span><b>${e.amount.toFixed(2)}€</b></div>`;
    });

    document.getElementById("totalSum").textContent = (ts + tr).toFixed(2);
    document.getElementById("balanceSara").textContent = ts.toFixed(2);
    document.getElementById("balanceRui").textContent = tr.toFixed(2);

    // CÁLCULO DE QUEM DEVE A QUEM
    var s = document.getElementById("settlements");
    var diff = (ts - tr) / 2;
    if((ts+tr) === 0 || Math.abs(diff) < 0.01) {
        s.className = "settlement even"; s.innerHTML = "✅ Tudo certo!";
    } else if (diff > 0) {
        s.className = "settlement pay"; s.innerHTML = `👨 Rui deve <b>${diff.toFixed(2)}€</b> a 👩 Sara`;
    } else {
        s.className = "settlement pay"; s.innerHTML = `👩 Sara deve <b>${Math.abs(diff).toFixed(2)}€</b> a 👨 Rui`;
    }
});

// 2. GUARDAR DESPESA
document.getElementById("expenseForm").onsubmit = function(e) {
    e.preventDefault();
    var val = parseFloat(document.getElementById("amount").value);
    householdRef.collection("expenses").add({
        payer: document.getElementById("payer").value,
        amount: val,
        description: document.getElementById("description").value,
        date: new Date().toISOString().slice(0,10)
    }).then(() => e.target.reset());
};

// 3. RELATÓRIO WORD E LIMPEZA (CONTAS ACUMULADAS)
document.getElementById("clearBtn").onclick = async function() {
    if(!confirm("Gerar Word com o ACERTO FINAL e apagar tudo?")) return;

    const cur = await householdRef.collection("expenses").get();
    const hist = await householdRef.collection("historico").get();
    
    let all = [], ts = 0, tr = 0;
    [...cur.docs, ...hist.docs].forEach(d => {
        let e = d.data(); all.push(e);
        if(e.payer === "Sara") ts += e.amount; else tr += e.amount;
    });

    let diff = (ts - tr) / 2;
    let acertoFinal = (Math.abs(diff) < 0.01) ? "Contas equilibradas." : (diff > 0 ? `Rui deve ${diff.toFixed(2)}€ à Sara` : `Sara deve ${Math.abs(diff).toFixed(2)}€ ao Rui`);

    const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType } = docx;
    const doc = new Document({
        sections: [{
            children: [
                new Paragraph({ children: [new TextRun({ text: "RELATÓRIO FINAL DE CONTAS", bold: true, size: 32 })] }),
                new Paragraph({ text: "Gerado em: " + new Date().toLocaleString() }),
                new Paragraph({ text: "" }),
                new Paragraph({ children: [new TextRun({ text: "ACERTO DE CONTAS (HISTÓRICO + ATUAL):", bold: true, size: 24 })] }),
                new Paragraph({ children: [new TextRun({ text: acertoFinal, bold: true, color: "FF0000", size: 28 })] }),
                new Paragraph({ text: "" }),
                new Table({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    rows: [
                        new TableRow({ children: [new TableCell({children:[new Paragraph("Quem")]}), new TableCell({children:[new Paragraph("Descrição")]}), new TableCell({children:[new Paragraph("Valor")]})] }),
                        ...all.map(e => new TableRow({ children: [new TableCell({children:[new Paragraph(e.payer)]}), new TableCell({children:[new Paragraph(e.description)]}), new TableCell({children:[new Paragraph(e.amount.toFixed(2)+"€")]})] }))
                    ]
                })
            ]
        }]
    });

    Packer.toBlob(doc).then(blob => {
        saveAs(blob, "Relatorio_Contas_Final.docx");
        let batch = db.batch();
        cur.docs.forEach(d => batch.delete(d.ref));
        hist.docs.forEach(d => batch.delete(d.ref));
        batch.commit().then(() => { alert("Tudo limpo!"); location.reload(); });
    });
};

// MOSTRAR/ESCONDER HISTÓRICO
document.getElementById("histToggle").onclick = function() {
    var s = document.getElementById("hist-section");
    s.style.display = (s.style.display === "none") ? "block" : "none";
    if(s.style.display === "block") {
        householdRef.collection("historico").get().then(snap => {
            let t = 0; snap.forEach(doc => t += doc.data().amount);
            document.getElementById("histTotal").textContent = t.toFixed(2) + "€";
        });
    }
};
