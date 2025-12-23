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
let editandoId = null;

// 1. ATUALIZAÇÃO DA LISTA NO ECRÃ
householdRef.collection("expenses").orderBy("date", "desc").onSnapshot(snap => {
    var list = document.getElementById("list");
    list.innerHTML = "";
    dadosAtuais.ts = 0; dadosAtuais.tr = 0; dadosAtuais.lista = [];

    snap.forEach(doc => {
        var e = doc.data();
        dadosAtuais.lista.push(e);
        if(e.payer === "Sara") dadosAtuais.ts += e.amount; else dadosAtuais.tr += e.amount;
        
        list.innerHTML += `<div class="expense-item">
            <div class="exp-info">
                <span class="exp-date">${e.date.split('-').reverse().join('/')}</span>
                <span><b>${e.payer}</b>: ${e.description}</span>
            </div>
            <div class="expense-actions">
                <b>${e.amount.toFixed(2)}€</b>
                <button onclick="editarDespesa('${doc.id}', '${e.payer}', ${e.amount}, '${e.description}', '${e.date}')" class="btn-action">✏️</button>
                <button onclick="apagarDespesa('${doc.id}')" class="btn-action delete">🗑️</button>
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
    
    console.log("📋 Lista atualizada - Total de despesas:", dadosAtuais.lista.length);
});

// 2. LÓGICA DE ARQUIVAR (SALDAR) - COM DEBUG E RESET DOS BOTÕES
householdRef.onSnapshot(async doc => {
    var v = (doc.data() || {}).archiveVotes || { sara: false, rui: false };
    
    console.log("🔍 DEBUG - Votos:", v);
    console.log("🔍 DEBUG - Lista atual tem:", dadosAtuais.lista.length, "despesas");
    console.log("🔍 DEBUG - Sara votou?", v.sara);
    console.log("🔍 DEBUG - Rui votou?", v.rui);
    
    // ATUALIZA VISUAL DOS BOTÕES
    document.getElementById("archiveSara").style.background = v.sara ? "#10b981" : "#d1fae5";
    document.getElementById("archiveSara").style.color = v.sara ? "#fff" : "#065f46";
    document.getElementById("archiveSara").style.border = v.sara ? "2px solid #10b981" : "2px solid #a7f3d0";
    
    document.getElementById("archiveRui").style.background = v.rui ? "#10b981" : "#d1fae5";
    document.getElementById("archiveRui").style.color = v.rui ? "#fff" : "#065f46";
    document.getElementById("archiveRui").style.border = v.rui ? "2px solid #10b981" : "2px solid #a7f3d0";

    if(v.sara && v.rui && dadosAtuais.lista.length > 0) {
        console.log("🔄 INICIANDO ARQUIVAMENTO...");
        console.log("📊 Número de despesas a arquivar:", dadosAtuais.lista.length);
        
        try {
            // COPIA PARA O ARQUIVO PERMANENTE ANTES DE LIMPAR
            var snap = await householdRef.collection("expenses").get();
            console.log("📦 Documentos obtidos do Firebase:", snap.size);
            
            let b = db.batch();
            let contador = 0;
            
            // Copia cada despesa para o arquivo permanente
            for (const d of snap.docs) {
                let dados = d.data();
                console.log(`✅ Copiando despesa ${contador + 1}:`, dados);
                await householdRef.collection("arquivo_permanente").add(dados);
                b.delete(d.ref);
                contador++;
            }
            
            console.log(`✅ ${contador} despesas copiadas para arquivo_permanente`);
            
            await b.commit();
            console.log("✅ Lista atual limpa");
            
            // RESET COMPLETO DOS VOTOS
            await householdRef.update({ 
                "archiveVotes": { 
                    sara: false, 
                    rui: false, 
                    saraDev: "", 
                    ruiDev: "" 
                } 
            });
            console.log("✅ Votos resetados");
            
            alert(`✅ ${contador} despesas arquivadas com sucesso!\n\nContas saldadas! 🎉`);
        } catch (error) {
            console.error("❌ ERRO ao arquivar:", error);
            alert("❌ Erro ao arquivar: " + error.message);
        }
    } else {
        if(v.sara && v.rui) {
            console.log("⚠️ Ambos votaram mas lista está vazia!");
        }
    }
});

async function votar(p) {
    console.log(`🗳️ Voto de ${p}`);
    var doc = await householdRef.get();
    var v = (doc.data() || {}).archiveVotes || { sara: false, rui: false, saraDev: "", ruiDev: "" };
    var c = p.toLowerCase(), o = (c === "sara") ? "rui" : "sara";
    if (v[o+"Dev"] === myId && !v[c]) return alert("Erro: Outro utilizador já votou aqui.");
    var up = {}; up["archiveVotes."+c] = !v[c]; up["archiveVotes."+c+"Dev"] = v[c] ? "" : myId;
    await householdRef.update(up);
    console.log(`✅ Voto de ${p} registado`);
}
document.getElementById("archiveSara").onclick = () => votar("Sara");
document.getElementById("archiveRui").onclick = () => votar("Rui");

// 3. FUNÇÕES DE EDITAR E APAGAR (GLOBAIS)
window.editarDespesa = async function(id, payer, amount, description, date) {
    console.log("✏️ Editando despesa:", id);
    editandoId = id;
    document.getElementById("payer").value = payer;
    document.getElementById("amount").value = amount;
    document.getElementById("description").value = description;
    document.querySelector(".btn-save").textContent = "✓ Atualizar Despesa";
    document.querySelector(".btn-save").style.background = "#f59e0b";
    window.scrollTo(0, 0);
}

window.apagarDespesa = async function(id) {
    if(confirm("Apagar esta despesa?")) {
        console.log("🗑️ Apagando despesa:", id);
        await householdRef.collection("expenses").doc(id).delete();
        console.log("✅ Despesa apagada");
    }
}

// 4. CONSULTA E RELATÓRIO DO HISTÓRICO
window.consultarTotal = async function(dias) {
    console.log(`📊 Consultando total dos últimos ${dias} dias`);
    let lim = new Date(); lim.setHours(0,0,0,0);
    lim.setDate(lim.getDate() - parseInt(dias));
    let iso = lim.toISOString().split('T')[0];
    
    let snap = await householdRef.collection("arquivo_permanente").where("date", ">=", iso).get();
    console.log(`📦 Encontradas ${snap.size} despesas arquivadas`);
    let t = 0; snap.forEach(d => t += d.data().amount);
    document.getElementById("histTotal").textContent = t.toFixed(2);
}

document.getElementById("btnDownloadHist").onclick = async () => {
    let dias = document.getElementById("timeFilter").value;
    console.log(`📥 Gerando relatório dos últimos ${dias} dias`);
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

    if(listaH.length === 0) {
        console.log("⚠️ Nenhuma despesa arquivada encontrada");
        return alert("Não existem despesas arquivadas neste período!");
    }

    console.log(`📄 Gerando relatório com ${listaH.length} despesas`);
    
    // SEM BALANÇO (null) - contas já foram saldadas ao arquivar
    await gerarRelatorio(listaH, `RELATORIO_HISTORICO_${dias}_DIAS`, tsH, trH, null);
};

// 5. FUNÇÃO DE RELATÓRIO
async function gerarRelatorio(lista, nome, s, r, balanco) {
    console.log("📝 Gerando documento Word...");
    const { Document, Packer, Paragraph, TextRun, AlignmentType } = docx;
    let corpo = [
        new Paragraph({ children: [new TextRun({ text: nome.replace(/_/g," "), bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
        new Paragraph({ text: "" }),
        new Paragraph({ text: `Total de Gastos no Período: ${(s+r).toFixed(2)}€` }),
        new Paragraph({ text: `Total Sara: ${s.toFixed(2)}€ | Total Rui: ${r.toFixed(2)}€` })
    ];
    
    // SÓ ADICIONA BALANÇO SE NÃO FOR NULL (ou seja, se não for relatório histórico)
    if(balanco !== null) {
        corpo.push(new Paragraph({ children: [new TextRun({ text: `BALANÇO FINAL: ${balanco}`, bold: true, color: "FF0000" })] }));
    } else {
        corpo.push(new Paragraph({ children: [new TextRun({ text: `CONTAS SALDADAS ✅`, bold: true, color: "00AA00" })] }));
    }
    
    corpo.push(new Paragraph({ text: "--------------------------------------------------------" }));
    corpo.push(new Paragraph({ text: "" }));

    lista.sort((a,b) => b.date.localeCompare(a.date)).forEach(e => {
        corpo.push(new Paragraph({ text: `${e.date.split('-').reverse().join('/')} | ${e.payer}: ${e.description} - ${e.amount.toFixed(2)}€` }));
    });
    
    const doc = new Document({ sections: [{ children: corpo }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `${nome}_${new Date().toISOString().split('T')[0]}.docx`);
    console.log("✅ Documento gerado e download iniciado");
}

// 6. SUBMIT DO FORMULÁRIO
document.getElementById("expenseForm").onsubmit = async (e) => {
    e.preventDefault();
    var obj = { 
        payer: document.getElementById("payer").value, 
        amount: parseFloat(document.getElementById("amount").value), 
        description: document.getElementById("description").value, 
        date: new Date().toISOString().split('T')[0] 
    };
    
    if(editandoId) {
        console.log("✏️ Atualizando despesa:", editandoId);
        await householdRef.collection("expenses").doc(editandoId).update(obj);
        editandoId = null;
        document.querySelector(".btn-save").textContent = "✓ Guardar";
        document.querySelector(".btn-save").style.background = "#10b981";
        console.log("✅ Despesa atualizada");
    } else {
        console.log("➕ Adicionando nova despesa:", obj);
        await householdRef.collection("expenses").add(obj);
        console.log("✅ Despesa adicionada (SÓ na lista atual)");
    }
    
    e.target.reset();
};

// 7. TOGGLE DO HISTÓRICO
document.getElementById("btnToggleHist").onclick = () => {
    var s = document.getElementById("hist-section");
    s.style.display = s.style.display === "block" ? "none" : "block";
    if(s.style.display === "block") {
        console.log("📊 Abrindo arquivo permanente");
        consultarTotal(30);
    }
};

// 8. APAGAR TODO O HISTÓRICO PERMANENTE
window.apagarTudoPermanente = async function() {
    if(confirm("Deseja apagar TODO o histórico eterno?")) {
        console.log("🗑️ Limpando arquivo permanente...");
        let snap = await householdRef.collection("arquivo_permanente").get();
        console.log(`📦 Encontradas ${snap.size} despesas para apagar`);
        let b = db.batch(); 
        snap.docs.forEach(d => b.delete(d.ref));
        await b.commit(); 
        console.log("✅ Arquivo permanente limpo");
        location.reload();
    }
}

console.log("✅ Script carregado e Firebase inicializado");
