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

let dadosAtuais = { ts: 0, tr: 0, textoDivida: "", lista: [] };

// 1. MONITORIZAÇÃO DA LISTA ATUAL
householdRef.collection("expenses").orderBy("date", "desc").onSnapshot(snap => {
    var list = document.getElementById("list");
    list.innerHTML = "";
    dadosAtuais.ts = 0; dadosAtuais.tr = 0; dadosAtuais.lista = [];

    snap.forEach(doc => {
        var e = doc.data();
        dadosAtuais.lista.push(e);
        if(e.payer === "Sara") dadosAtuais.ts += e.amount; else dadosAtuais.tr += e.amount;
        list.innerHTML += `
            <div class="expense-item">
                <div class="exp-info">
                    <span class="exp-date">${e.date.split('-').reverse().join('/')}</span>
                    <span class="exp-desc"><b>${e.payer}</b>: ${e.description}</span>
                </div>
                <span style="font-weight:bold">${e.amount.toFixed(2)}€</span>
            </div>`;
    });

    document.getElementById("totalSum").textContent = (dadosAtuais.ts + dadosAtuais.tr).toFixed(2);
    document.getElementById("balanceSara").textContent = dadosAtuais.ts.toFixed(2) + "€";
    document.getElementById("balanceRui").textContent = dadosAtuais.tr.toFixed(2) + "€";

    var s = document.getElementById("settlements"), diff = (dadosAtuais.ts - dadosAtuais.tr) / 2;
    if((dadosAtuais.ts + dadosAtuais.tr) === 0) {
        s.style.background = "#f1f5f9"; s.innerHTML = "Sem despesas ativas.";
        dadosAtuais.textoDivida = "Tudo certo (0.00€)";
    } else if (Math.abs(diff) < 0.01) {
        s.style.background = "#d1fae5"; s.innerHTML = "✅ Contas Certas!";
        dadosAtuais.textoDivida = "Contas equilibradas.";
    } else {
        s.style.background = "#fee2e2";
        let texto = diff > 0 ? `👨 Rui deve ${diff.toFixed(2)}€ a 👩 Sara` : `👩 Sara deve ${Math.abs(diff).toFixed(2)}€ a 👨 Rui`;
        s.innerHTML = `<b>${texto}</b>`;
        dadosAtuais.textoDivida = texto;
    }
});

// 2. LÓGICA DE APROVAÇÃO E FECHO AUTOMÁTICO
householdRef.onSnapshot(async doc => {
    var v = (doc.data() || {}).archiveVotes || { sara: false, rui: false };
    var bS = document.getElementById("archiveSara"), bR = document.getElementById("archiveRui");

    bS.style.background = v.sara ? "#10b981" : "#f1f5f9";
    bS.style.color = v.sara ? "#fff" : "#64748b";
    bR.style.background = v.rui ? "#10b981" : "#f1f5f9";
    bR.style.color = v.rui ? "#fff" : "#64748b";

    // SE OS DOIS APROVAREM: GERA RELATÓRIO E LIMPA TUDO
    if(v.sara && v.rui) {
        if(dadosAtuais.lista.length > 0) {
            await gerarRelatorioCompleto();
            await limparTudoAposFecho();
            alert("Contas Fechadas! Relatório gerado e lista limpa.");
        } else {
            // Se aprovarem sem despesas, apenas faz reset aos votos
            await householdRef.update({ "archiveVotes": { sara: false, rui: false, saraDev: "", ruiDev: "" } });
        }
    }
});

async function votar(p) {
    var doc = await householdRef.get();
    var v = (doc.data() || {}).archiveVotes || { sara: false, rui: false, saraDev: "", ruiDev: "" };
    var c = p.toLowerCase(), o = (c === "sara") ? "rui" : "sara";
    if (v[o+"Dev"] === myId && !v[c]) { alert("Este telemóvel já votou por outra pessoa!"); return; }
    var up = {}; up["archiveVotes."+c] = !v[c]; up["archiveVotes."+c+"Dev"] = v[c] ? "" : myId;
    await householdRef.update(up);
}
document.getElementById("archiveSara").onclick = () => votar("Sara");
document.getElementById("archiveRui").onclick = () => votar("Rui");

// 3. RELATÓRIO COMPLETO
async function gerarRelatorioCompleto() {
    const { Document, Packer, Paragraph, TextRun, AlignmentType } = docx;
    let lines = [
        new Paragraph({ children: [new TextRun({ text: "RELATÓRIO DE FECHO DE CONTAS", bold: true, size: 32 })], alignment: AlignmentType.CENTER }),
        new Paragraph({ text: `Data do Fecho: ${new Date().toLocaleString()}` }),
        new Paragraph({ text: "" }),
        new Paragraph({ children: [new TextRun({ text: "RESUMO FINANCEIRO:", bold: true })] }),
        new Paragraph({ text: `Total Gasto: ${(dadosAtuais.ts + dadosAtuais.tr).toFixed(2)}€` }),
        new Paragraph({ text: `Total Sara: ${dadosAtuais.ts.toFixed(2)}€` }),
        new Paragraph({ text: `Total Rui: ${dadosAtuais.tr.toFixed(2)}€` }),
        new Paragraph({ children: [new TextRun({ text: `ACERTO DE CONTAS: ${dadosAtuais.textoDivida}`, bold: true, color: "FF0000" })] }),
        new Paragraph({ text: "" }),
        new Paragraph({ children: [new TextRun({ text: "DETALHE DAS DESPESAS:", bold: true })] })
    ];

    dadosAtuais.lista.forEach(e => {
        lines.push(new Paragraph({ text: `${e.date} | ${e.payer}: ${e.description} -> ${e.amount.toFixed(2)}€` }));
    });

    const doc = new Document({ sections: [{ children: lines }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `Fecho_Contas_${new Date().toISOString().split('T')[0]}.docx`);
}

async function limparTudoAposFecho() {
    var snap = await householdRef.collection("expenses").get();
    let b = db.batch();
    snap.docs.forEach(d => b.delete(d.ref));
    await b.commit();
    // Reset dos votos
    await householdRef.update({ "archiveVotes": { sara: false, rui: false, saraDev: "", ruiDev: "" } });
}

// 4. RESTANTES FUNÇÕES (GUARDAR E HISTÓRICO)
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

document.getElementById("btnToggleHist").onclick = () => {
    var s = document.getElementById("hist-section");
    s.style.display = s.style.display === "block" ? "none" : "block";
    if(s.style.display === "block") consultarTotal(30);
};

async function consultarTotal(dias) {
    var limite = new Date();
    limite.setHours(0,0,0,0);
    if(dias > 0) limite.setDate(limite.getDate() - dias);
    var snap = await householdRef.collection("arquivo_permanente").where("date", ">=", limite.toISOString().split('T')[0]).get();
    var t = 0; snap.forEach(d => t += d.data().amount);
    document.getElementById("histTotal").textContent = t.toFixed(2);
}

async function apagarTudoPermanente() {
    if(confirm("Apagar histórico eterno?")) {
        var snap = await householdRef.collection("arquivo_permanente").get();
        let b = db.batch(); snap.docs.forEach(d => b.delete(d.ref));
        await b.commit(); alert("Arquivo limpo.");
    }
}
