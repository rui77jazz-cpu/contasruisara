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

let dadosAtuais = { ts: 0, tr: 0, divida: "", lista: [] };
let editandoId = null; // Variável para controlar edição

// 1. ATUALIZAÇÃO DA LISTA NO ECRÃ
householdRef.collection("expenses").orderBy("date", "desc").onSnapshot(snap => {
    var list = document.getElementById("list");
    list.innerHTML = "";
    dadosAtuais.ts = 0; dadosAtuais.tr = 0; dadosAtuais.lista = [];

    snap.forEach(doc => {
        var e = doc.data();
        dadosAtuais.lista.push(e);
        if(e.payer === "Sara") dadosAtuais.ts += e.amount; else dadosAtuais.tr += e.amount;
        
        // ADICIONA BOTÕES DE EDITAR E APAGAR
        list.innerHTML += `<div class="expense-item">
            <div class="exp-info">
                <span class="exp-date">${e.date.split('-').reverse().join('/')}</span>
                <span><b>${e.payer}</b>: ${e.description}</span>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
                <b>${e.amount.toFixed(2)}€</b>
                <button onclick="editarDespesa('${doc.id}', '${e.payer}', ${e.amount}, '${e.description}', '${e.date}')" style="background:#60a5fa;color:#fff;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:0.8rem">✏️</button>
                <button onclick="apagarDespesa('${doc.id}')" style="background:#ef4444;color:#fff;border:none;padding:5px 10px;border-radius:5px;cursor:pointer;font-size:0.8rem">🗑️</button>
            </div>
        </div>`;
    });

    document.getElementById("totalSum").textContent = (dadosAtuais.ts + dadosAtuais.tr).toFixed(2);
    document.getElementById("balanceSara").textContent = dadosAtuais.ts.toFixed(2) + "€";
    document.getElementById("balanceRui").textContent = dadosAtuais.tr.toFixed(2) + "€";

    var s = document.getElementById("settlements"), diff = (dadosAtuais.ts - dadosAtuais.tr) / 2;
    if(dadosAtuais.lista.length === 0) {
        s.style.background = "#f1f5f9"; s.innerHTML = "Tudo saldado!";
        dadosAtuais.divida = "Sem dívidas pendentes.";
    } else {
        s.style.background = "#fee2e2";
        dadosAtuais.divida = diff > 0 ? `👨 Rui deve ${diff.toFixed(2)}€ a 👩 Sara` : `👩 Sara deve ${Math.abs(diff).toFixed(2)}€ a 👨 Rui`;
        if(Math.abs(diff) < 0.01) { s.style.background="#d1fae5"; dadosAtuais.divida="Contas equilibradas."; }
        s.innerHTML = `<b>${dadosAtuais.divida}</b>`;
    }
});

// 2. LÓGICA DE ARQUIVAR (SALDAR) - COPIA PARA O PERMANENTE ANTES DE LIMPAR
householdRef.onSnapshot(async doc => {
    var v = (doc.data() || {}).archiveVotes || { sara: false, rui: false };
    document.getElementById("archiveSara").style.background = v.sara ? "#10b981" : "#dbeafe";
    document.getElementById("archiveSara").style.color = v.sara ? "#fff" : "#1e40af";
    document.getElementById("archiveRui").style.background = v.rui ? "#10b981" : "#dbeafe";
    document.getElementById("archiveRui").style.color = v.rui ? "#fff" : "#1e40af";

    if(v.sara && v.rui && dadosAtuais.lista.length > 0) {
        // COPIA PARA O ARQUIVO PERMANENTE ANTES DE LIMPAR
        var snap = await householdRef.collection("expenses").get();
        let b = db.batch();
        
        // Copia cada despesa para o arquivo permanente
        snap.docs.forEach(d => {
            let dados = d.data();
            householdRef.collection("arquivo_permanente").add(dados);
            b.delete(d.ref); // Apaga da lista atual
        });
        
        await b.commit();
        await householdRef.update({ "archiveVotes": { sara: false, rui: false, saraDev: "", ruiDev: "" } });
    }
});

async function votar(p) {
    var doc = await householdRef.get();
    var v = (doc.data() || {}).archiveVotes || { sara: false, rui: false, saraDev: "", ruiDev: "" };
    var c = p.toLowerCase(), o = (c === "sara") ? "rui" : "sara";
    if (v[o+"Dev"] === myId && !v[c]) return alert("Erro: Outro utilizador já votou aqui.");
    var up = {}; up["archiveVotes."+c] = !v[c]; up["archiveVotes."+c+"Dev"] = v[c] ? "" : myId;
    await householdRef.update(up);
}
document.getElementById("archiveSara").onclick = () => votar("Sara");
document.getElementById("archiveRui").onclick = () => votar("Rui");

// 3. FUNÇÕES DE EDITAR E APAGAR (GLOBAIS)
window.editarDespesa = async function(id, payer, amount, description, date) {
    editandoId = id;
    document.getElementById("payer").value = payer;
    document.getElementById("amount").value = amount;
    document.getElementById("description").value = description;
    document.querySelector(".btn-save").textContent = "✓ Atualizar Despesa";
    document.querySelector(".btn-save").style.background = "#f59e0b";
    window.scrollTo(0, 0); // Scroll para o topo
}

window.apagarDespesa = async function(id) {
    if(confirm("Apagar esta despesa?")) {
        await householdRef.collection("expenses").doc(id).delete();
    }
}

// 4. CONSULTA E RELATÓRIO DO HISTÓRICO
window.consultarTotal = async function(dias) {
    let lim = new Date(); lim.setHours(0,0,0,0);
    lim.setDate(lim.getDate() - parseInt(dias));
    let iso = lim.toISOString().split('T')[0];
    
    let snap = await householdRef.collection("arquivo_permanente").where("date", ">=", iso).get();
    let t = 0; snap.forEach(d => t += d.data().amount);
    document.getElementById("histTotal").textContent = t.toFixed(2);
}

document.getElementById("btnDownloadHist").onclick = async () => {
    let dias = document.getElementById("timeFilter").value;
    let lim = new Date(); lim.setHours(0,0,0,0);
    lim.setDate(lim.getDate() - parseInt(dias));
    let iso = lim.toISOString().split('T')[0];
    
    let snap = await householdRef.collection("arquivo_permanente").where("date", ">=", iso).get();
    let listaH = [], tsH = 0, trH = 0;
    
    snap.forEach(d => {
        let e = d.data();
        listaH.push(e);
        if(e.payer === "Sara") tsH += e.amount; else trH += e.amount;
    });

    if(listaH.length === 0) return alert("Não existem despesas arquivadas neste período!");

    let diffH = (tsH - trH) / 2;
    let balancoH = diffH > 0 ? `Rui deve ${diffH.toFixed(2)}€ a Sara` : `Sara deve ${Math.abs(diffH).toFixed(2)}€ a Rui`;
    if(Math.abs(diffH) < 0.01) balancoH = "Contas equilibradas.";

    await gerarRelatorio(listaH, `RELATORIO_HISTORICO_${dias}_DIAS`, tsH, trH, balancoH);
};

// 5. FUNÇÃO DE RELATÓRIO (só é chamada manualmente)
async function gerarRelatorio(lista, nome, s, r, balanco) {
    const { Document, Packer, Paragraph, TextRun, AlignmentType } = docx;
    let corpo = [
        new Paragraph({ children: [new TextRun({ text: nome.replace(/_/g," "), bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: `Total de Gastos no Período: ${(s+r).toFixed(2)}€` }),
        new Paragraph({ text: `Total Sara: ${s.toFixed(2)}€ | Total Rui: ${r.toFixed(2)}€` }),
        new Paragraph({ children: [new TextRun({ text: `BALANÇO FINAL: ${balanco}`, bold: true, color: "FF0000" })] }),
        new Paragraph({ text: "--------------------------------------------------------" }),
        new Paragraph({ text: "" })
    ];

    lista.sort((a,b) => b.date.localeCompare(a.date)).forEach(e => {
        corpo.push(new Paragraph({ text: `${e.date.split('-').reverse().join('/')} | ${e.payer}: ${e.description} - ${e.amount.toFixed(2)}€` }));
    });
    
    const doc = new Document({ sections: [{ children: corpo }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${nome}_${new Date().toISOString().split('T')[0]}.docx`);
}

// 6. SUBMIT DO FORMULÁRIO (ADICIONAR OU ATUALIZAR)
document.getElementById("expenseForm").onsubmit = async (e) => {
    e.preventDefault();
    var obj = { 
        payer: document.getElementById("payer").value, 
        amount: parseFloat(document.getElementById("amount").value), 
        description: document.getElementById("description").value, 
        date: new Date().toISOString().split('T')[0] 
    };
    
    if(editandoId) {
        // ATUALIZAR despesa existente
        await householdRef.collection("expenses").doc(editandoId).update(obj);
        editandoId = null;
        document.querySelector(".btn-save").textContent = "✓ Guardar";
        document.querySelector(".btn-save").style.background = "#10b981";
    } else {
        // ADICIONAR nova despesa (SÓ na lista atual)
        await householdRef.collection("expenses").add(obj);
    }
    
    e.target.reset();
};

// 7. TOGGLE DO HISTÓRICO
document.getElementById("btnToggleHist").onclick = () => {
    var s = document.getElementById("hist-section");
    s.style.display = s.style.display === "block" ? "none" : "block";
    if(s.style.display === "block") consultarTotal(30);
};

// 8. APAGAR TODO O HISTÓRICO PERMANENTE
window.apagarTudoPermanente = async function() {
    if(confirm("Deseja apagar TODO o histórico eterno?")) {
        let snap = await householdRef.collection("arquivo_permanente").get();
        let b = db.batch(); snap.docs.forEach(d => b.delete(d.ref));
        await b.commit(); location.reload();
    }
}
