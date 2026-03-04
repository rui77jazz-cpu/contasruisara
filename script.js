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
let jaArquiveiNestaSessao = false;
const LOCK_TIMEOUT_MS = 30000; // 30 segundos — lock expira automaticamente

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
        jaArquiveiNestaSessao = false; // ✅ Reset ao limpar lista
    } else {
        s.style.background = "#fee2e2";
        dadosAtuais.divida = diff > 0
            ? `👨 Rui deve ${diff.toFixed(2)}€ a 👩 Sara`
            : `👩 Sara deve ${Math.abs(diff).toFixed(2)}€ a 👨 Rui`;
        if(Math.abs(diff) < 0.01) { s.style.background="#d1fae5"; dadosAtuais.divida="Contas equilibradas."; }
        s.innerHTML = `<b>${dadosAtuais.divida}</b>`;
    }
});

// 2. ATUALIZAÇÃO VISUAL DOS BOTÕES E TRIGGER DE ARQUIVO
householdRef.onSnapshot(async docSnap => {
    var data = docSnap.data() || {};
    var v = data.archiveVotes || { sara: false, rui: false };
    var archiveLock = data.archiveLock || null;
    var archiveLockTime = data.archiveLockTime || null;

    // Actualiza visual dos botões
    document.getElementById("archiveSara").style.background = v.sara ? "#10b981" : "#d1fae5";
    document.getElementById("archiveSara").style.color    = v.sara ? "#fff" : "#065f46";
    document.getElementById("archiveSara").style.border   = v.sara ? "2px solid #10b981" : "2px solid #a7f3d0";

    document.getElementById("archiveRui").style.background = v.rui ? "#10b981" : "#d1fae5";
    document.getElementById("archiveRui").style.color    = v.rui ? "#fff" : "#065f46";
    document.getElementById("archiveRui").style.border   = v.rui ? "2px solid #10b981" : "2px solid #a7f3d0";

    // ✅ VERIFICA SE LOCK ESTÁ EXPIRADO E LIBERTA-O
    if(archiveLock && archiveLockTime) {
        var lockAge = Date.now() - new Date(archiveLockTime).getTime();
        if(lockAge > LOCK_TIMEOUT_MS) {
            console.log("⏰ Lock expirado, a libertar...");
            await householdRef.set({ archiveLock: null, archiveLockTime: null }, { merge: true });
            return; // O onSnapshot vai disparar de novo sem lock
        }
    }

    // ✅ VERIFICA SE DEVE ARQUIVAR
    if(v.sara && v.rui && dadosAtuais.lista.length > 0 && !jaArquiveiNestaSessao && !archiveLock) {
        console.log("🔒 Tentando adquirir lock para arquivar...");

        try {
            let conseguiuLock = await db.runTransaction(async (transaction) => {
                let docAtual = await transaction.get(householdRef);
                let lockAtual = (docAtual.data() || {}).archiveLock;

                if(lockAtual) {
                    console.log("⏳ Lock já existe, outro dispositivo está a arquivar");
                    return false;
                }

                transaction.update(householdRef, {
                    archiveLock: myId,
                    archiveLockTime: new Date().toISOString()
                });
                return true;
            });

            if(conseguiuLock) {
                jaArquiveiNestaSessao = true;
                await arquivarDespesas();
            }
        } catch (error) {
            console.error("❌ Erro ao tentar adquirir lock:", error);
            alert("❌ Erro ao arquivar: " + error.message);
        }
    }
});

// 3. FUNÇÃO DE VOTAR — cada aparelho só pode votar num
async function votar(p) {
    console.log(`🗳️ Voto de ${p}`);

    try {
        var docSnap = await householdRef.get();
        var v = (docSnap.data() || {}).archiveVotes || { sara: false, rui: false, saraDevice: "", ruiDevice: "" };
        var c = p.toLowerCase();
        var outro = c === "sara" ? "rui" : "sara";

        // Se já votou no outro, bloqueia
        if(v[outro + "Device"] === myId && !v[c]) {
            alert(`❌ Este aparelho já votou como ${outro === "sara" ? "Sara 👩" : "Rui 👨"}.\nCada aparelho só pode votar num.`);
            return;
        }

        var novoVoto = !v[c];
        var up = {};
        up["archiveVotes." + c] = novoVoto;
        up["archiveVotes." + c + "Device"] = novoVoto ? myId : "";

        await householdRef.set(up, { merge: true });
        console.log(`✅ Voto de ${p}: ${novoVoto}`);
    } catch(err) {
        console.error("❌ Erro ao votar:", err);
        alert("❌ Erro ao registar voto: " + err.message);
    }
}

document.getElementById("archiveSara").onclick = () => votar("Sara");
document.getElementById("archiveRui").onclick  = () => votar("Rui");

// 4. FUNÇÃO DE ARQUIVAR
async function arquivarDespesas() {
    console.log("🔄 ARQUIVANDO DESPESAS...");

    try {
        var snap = await householdRef.collection("expenses").get();

        if(snap.size === 0) {
            console.log("⚠️ Nenhuma despesa para arquivar");
            await householdRef.set({
                archiveLock: null,
                archiveVotes: { sara: false, rui: false, saraDevice: "", ruiDevice: "" }
            }, { merge: true });
            return;
        }

        console.log(`📦 ${snap.size} despesas para arquivar`);

        // Copia para arquivo_permanente
        let batchArquivo = db.batch();
        snap.docs.forEach(d => {
            let novoDocRef = householdRef.collection("arquivo_permanente").doc();
            batchArquivo.set(novoDocRef, d.data());
        });
        await batchArquivo.commit();
        console.log(`✅ Copiadas para arquivo_permanente`);

        // Apaga da lista atual
        let batchDelete = db.batch();
        snap.docs.forEach(d => batchDelete.delete(d.ref));
        await batchDelete.commit();
        console.log("✅ Lista atual limpa");

        // Reset votos e lock
        await householdRef.set({
            archiveVotes: { sara: false, rui: false, saraDevice: "", ruiDevice: "" },
            archiveLock: null,
            archiveLockTime: null
        }, { merge: true });
        console.log("✅ Votos resetados e lock liberado");

        alert(`✅ ${snap.size} despesas arquivadas com sucesso!\n\nContas saldadas! 🎉`);

    } catch (error) {
        console.error("❌ ERRO ao arquivar:", error);
        // ✅ Liberta o lock mesmo em caso de erro
        await householdRef.set({ archiveLock: null, archiveLockTime: null }, { merge: true });
        alert("❌ Erro ao arquivar: " + error.message);
    }
}

// 5. FUNÇÕES DE EDITAR E APAGAR
window.editarDespesa = async function(id, payer, amount, description, date) {
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
        await householdRef.collection("expenses").doc(id).delete();
    }
}

// 6. CONSULTA E RELATÓRIO DO HISTÓRICO
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
    await gerarRelatorio(listaH, `RELATORIO_HISTORICO_${dias}_DIAS`, tsH, trH, null);
};

// 7. FUNÇÃO DE RELATÓRIO
async function gerarRelatorio(lista, nome, s, r, balanco) {
    console.log("📝 Gerando documento Word...");

    try {
        const { Document, Packer, Paragraph, TextRun, AlignmentType } = docx;
        let corpo = [
            new Paragraph({ children: [new TextRun({ text: nome.replace(/_/g," "), bold: true, size: 28 })], alignment: AlignmentType.CENTER }),
            new Paragraph({ text: "" }),
            new Paragraph({ text: `Total de Gastos no Período: ${(s+r).toFixed(2)}€` }),
            new Paragraph({ text: `Total Sara: ${s.toFixed(2)}€ | Total Rui: ${r.toFixed(2)}€` })
        ];

        corpo.push(balanco !== null
            ? new Paragraph({ children: [new TextRun({ text: `BALANÇO FINAL: ${balanco}`, bold: true, color: "FF0000" })] })
            : new Paragraph({ children: [new TextRun({ text: `CONTAS SALDADAS ✅`, bold: true, color: "00AA00" })] })
        );

        corpo.push(new Paragraph({ text: "--------------------------------------------------------" }));
        corpo.push(new Paragraph({ text: "" }));

        lista.sort((a,b) => b.date.localeCompare(a.date)).forEach(e => {
            corpo.push(new Paragraph({ text: `${e.date.split('-').reverse().join('/')} | ${e.payer}: ${e.description} - ${e.amount.toFixed(2)}€` }));
        });

        const doc = new Document({ sections: [{ children: corpo }] });
        const blob = await Packer.toBlob(doc);
        const nomeArquivo = `${nome}_${new Date().toISOString().split('T')[0]}.docx`;

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [new File([blob], nomeArquivo)] })) {
            const file = new File([blob], nomeArquivo, { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
            try {
                await navigator.share({ files: [file], title: 'Relatório de Despesas', text: 'Relatório gerado pela app Sara & Rui' });
            } catch (err) {
                fazerDownloadTradicional(blob, nomeArquivo);
            }
        } else {
            fazerDownloadTradicional(blob, nomeArquivo);
        }
    } catch (error) {
        console.error("❌ Erro ao gerar relatório:", error);
        alert("❌ Erro ao gerar relatório: " + error.message);
    }
}

function fazerDownloadTradicional(blob, nomeArquivo) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = nomeArquivo; a.style.display = 'none';
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
}

// 8. SUBMIT DO FORMULÁRIO
document.getElementById("expenseForm").onsubmit = async (e) => {
    e.preventDefault();
    var obj = {
        payer: document.getElementById("payer").value,
        amount: parseFloat(document.getElementById("amount").value),
        description: document.getElementById("description").value,
        date: new Date().toISOString().split('T')[0]
    };

    if(editandoId) {
        await householdRef.collection("expenses").doc(editandoId).update(obj);
        editandoId = null;
        document.querySelector(".btn-save").textContent = "✓ Guardar";
        document.querySelector(".btn-save").style.background = "#10b981";
    } else {
        await householdRef.collection("expenses").add(obj);
    }
    e.target.reset();
};

// 9. TOGGLE DO HISTÓRICO
document.getElementById("btnToggleHist").onclick = () => {
    var s = document.getElementById("hist-section");
    s.style.display = s.style.display === "block" ? "none" : "block";
    if(s.style.display === "block") consultarTotal(30);
};

// 10. APAGAR TODO O HISTÓRICO PERMANENTE
window.apagarTudoPermanente = async function() {
    if(confirm("Deseja apagar TODO o histórico eterno?")) {
        let snap = await householdRef.collection("arquivo_permanente").get();
        let b = db.batch();
        snap.docs.forEach(d => b.delete(d.ref));
        await b.commit();
        location.reload();
    }
}

console.log("✅ Script carregado e Firebase inicializado");
