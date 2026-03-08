
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

var ARCHIVE_PASS = "123-pass";

let dadosAtuais = { ts: 0, tr: 0, lista: [] };
let editandoId = null;

function mostrarErro(msg) {
    var s = document.getElementById("settlements");
    s.style.background = "#fee2e2";
    s.innerHTML = "<b style='color:red'>❌ " + msg + "</b>";
    console.error(msg);
}

// ── 1. LISTA DE DESPESAS ──────────────────────────────────────────────────
householdRef.collection("expenses").orderBy("date", "desc").onSnapshot(snap => {
    var list = document.getElementById("list");
    list.innerHTML = "";
    dadosAtuais.ts = 0; dadosAtuais.tr = 0; dadosAtuais.lista = [];

    snap.forEach(doc => {
        var e = doc.data();
        dadosAtuais.lista.push({ id: doc.id, ...e });
        if (e.payer === "Sara") dadosAtuais.ts += e.amount;
        else dadosAtuais.tr += e.amount;

        list.innerHTML += `<div class="expense-item">
            <div class="exp-info">
                <span class="exp-date">${e.date.split('-').reverse().join('/')}</span>
                <span><b>${e.payer}</b>: ${e.description}</span>
            </div>
            <div class="expense-actions">
                <b>${e.amount.toFixed(2)}€</b>
                <button onclick="editarDespesa('${doc.id}','${e.payer}',${e.amount},'${e.description}','${e.date}')" class="btn-action">✏️</button>
                <button onclick="apagarDespesa('${doc.id}')" class="btn-action delete">🗑️</button>
            </div>
        </div>`;
    });

    document.getElementById("totalSum").textContent = (dadosAtuais.ts + dadosAtuais.tr).toFixed(2);
    document.getElementById("balanceSara").textContent = dadosAtuais.ts.toFixed(2) + "€";
    document.getElementById("balanceRui").textContent = dadosAtuais.tr.toFixed(2) + "€";

    var s = document.getElementById("settlements");
    var diff = (dadosAtuais.ts - dadosAtuais.tr) / 2;
    if (dadosAtuais.lista.length === 0) {
        s.style.background = "#f1f5f9";
        s.innerHTML = "Tudo saldado!";
    } else if (Math.abs(diff) < 0.01) {
        s.style.background = "#d1fae5";
        s.innerHTML = "<b>Contas equilibradas.</b>";
    } else {
        s.style.background = "#fee2e2";
        var msg = diff > 0
            ? "👨 Rui deve " + diff.toFixed(2) + "€ a 👩 Sara"
            : "👩 Sara deve " + Math.abs(diff).toFixed(2) + "€ a 👨 Rui";
        s.innerHTML = "<b>" + msg + "</b>";
    }
}, err => mostrarErro("Despesas: " + err.message));

// ── 2. BOTÃO ARQUIVAR COM PALAVRA-PASSE ───────────────────────────────────
document.getElementById("btnArquivar").onclick = function() {
    if (dadosAtuais.lista.length === 0) {
        alert("Não há despesas para arquivar.");
        return;
    }
    var pass = prompt("🔒 Introduz a palavra-passe para arquivar e saldar:");
    if (pass === null) return; // cancelou
    if (pass !== ARCHIVE_PASS) {
        alert("❌ Palavra-passe incorreta.");
        return;
    }
    arquivarDespesas();
};

// ── 3. ARQUIVAR ───────────────────────────────────────────────────────────
async function arquivarDespesas() {
    console.log("🔄 A arquivar...");
    try {
        var snap = await householdRef.collection("expenses").get();

        if (snap.size === 0) return;

        var batchCopia = db.batch();
        snap.docs.forEach(d => {
            batchCopia.set(householdRef.collection("arquivo_permanente").doc(), d.data());
        });
        await batchCopia.commit();

        var batchApaga = db.batch();
        snap.docs.forEach(d => batchApaga.delete(d.ref));
        await batchApaga.commit();

        alert("✅ " + snap.size + " despesas arquivadas!\n\nContas saldadas! 🎉");

    } catch (err) {
        mostrarErro("Arquivo falhou: " + err.message);
    }
}

// ── 4. EDITAR / APAGAR ────────────────────────────────────────────────────
window.editarDespesa = async function(id, payer, amount, description, date) {
    editandoId = id;
    document.getElementById("payer").value = payer;
    document.getElementById("amount").value = amount;
    document.getElementById("description").value = description;
    document.querySelector(".btn-save").textContent = "✓ Atualizar Despesa";
    document.querySelector(".btn-save").style.background = "#f59e0b";
    window.scrollTo(0, 0);
};

window.apagarDespesa = async function(id) {
    if (confirm("Apagar esta despesa?")) {
        await householdRef.collection("expenses").doc(id).delete();
    }
};

// ── 5. HISTÓRICO ──────────────────────────────────────────────────────────
window.consultarTotal = async function(dias) {
    var lim = new Date(); lim.setHours(0,0,0,0);
    lim.setDate(lim.getDate() - parseInt(dias));
    var iso = lim.toISOString().split('T')[0];
    var snap = await householdRef.collection("arquivo_permanente").where("date", ">=", iso).get();
    var t = 0; snap.forEach(d => t += d.data().amount);
    document.getElementById("histTotal").textContent = t.toFixed(2);
};

document.getElementById("btnDownloadHist").onclick = async () => {
    var dias = document.getElementById("timeFilter").value;
    var lim = new Date(); lim.setHours(0,0,0,0);
    lim.setDate(lim.getDate() - parseInt(dias));
    var iso = lim.toISOString().split('T')[0];
    var snap = await householdRef.collection("arquivo_permanente").where("date", ">=", iso).get();
    var listaH = [], tsH = 0, trH = 0;
    snap.forEach(d => {
        var e = d.data(); listaH.push(e);
        if (e.payer === "Sara") tsH += e.amount; else trH += e.amount;
    });
    if (listaH.length === 0) return alert("Sem despesas arquivadas neste período!");
    await gerarRelatorio(listaH, "RELATORIO_HISTORICO_" + dias + "_DIAS", tsH, trH, null);
};

// ── 6. RELATÓRIO WORD ─────────────────────────────────────────────────────
async function gerarRelatorio(lista, nome, s, r, balanco) {
    try {
        const { Document, Packer, Paragraph, TextRun, AlignmentType } = docx;
        var corpo = [
            new Paragraph({ children: [new TextRun({ text: nome.replace(/_/g," "), bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: "Total: " + (s+r).toFixed(2) + "€  |  Sara: " + s.toFixed(2) + "€  |  Rui: " + r.toFixed(2) + "€" }),
            balanco !== null
                ? new Paragraph({ children: [new TextRun({ text: "BALANÇO: " + balanco, bold: true, color: "FF0000" })] })
                : new Paragraph({ children: [new TextRun({ text: "CONTAS SALDADAS ✅", bold: true, color: "00AA00" })] }),
            new Paragraph({ text: "────────────────────────────────────────" }),
            new Paragraph({ text: "" })
        ];
        lista.sort((a,b) => b.date.localeCompare(a.date)).forEach(e => {
            corpo.push(new Paragraph({ text: e.date.split('-').reverse().join('/') + " | " + e.payer + ": " + e.description + " — " + e.amount.toFixed(2) + "€" }));
        });

        const doc = new Document({ sections: [{ children: corpo }] });
        const blob = await Packer.toBlob(doc);
        const nomeArquivo = nome + "_" + new Date().toISOString().split('T')[0] + ".docx";

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], nomeArquivo)] })) {
            try {
                await navigator.share({ files: [new File([blob], nomeArquivo, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' })], title: 'Relatório' });
                return;
            } catch (_) {}
        }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = nomeArquivo; a.style.display = 'none';
        document.body.appendChild(a); a.click();
        setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
    } catch (err) {
        mostrarErro("Relatório: " + err.message);
    }
}

// ── 7. FORMULÁRIO ─────────────────────────────────────────────────────────
document.getElementById("expenseForm").onsubmit = async (e) => {
    e.preventDefault();
    var obj = {
        payer: document.getElementById("payer").value,
        amount: parseFloat(document.getElementById("amount").value),
        description: document.getElementById("description").value,
        date: new Date().toISOString().split('T')[0]
    };
    if (editandoId) {
        await householdRef.collection("expenses").doc(editandoId).update(obj);
        editandoId = null;
        document.querySelector(".btn-save").textContent = "✓ Guardar";
        document.querySelector(".btn-save").style.background = "#10b981";
    } else {
        await householdRef.collection("expenses").add(obj);
    }
    e.target.reset();
};

// ── 8. TOGGLE HISTÓRICO ───────────────────────────────────────────────────
document.getElementById("btnToggleHist").onclick = () => {
    var s = document.getElementById("hist-section");
    s.style.display = s.style.display === "block" ? "none" : "block";
    if (s.style.display === "block") consultarTotal(30);
};

// ── 9. LIMPAR BASE DE DADOS ──────────────────────────────────────────────
window.apagarTudoPermanente = async function() {
    if (confirm("Apagar TODO o histórico eterno?")) {
        var snap = await householdRef.collection("arquivo_permanente").get();
        var b = db.batch();
        snap.docs.forEach(d => b.delete(d.ref));
        await b.commit();
        location.reload();
    }
};

console.log("✅ Script carregado");
