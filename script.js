// --- Firebase Config ---
const firebaseConfig = {
  apiKey: "AIzaSyCle9Kx3OVD7mnZfXubKyIGW6COYrGI304",
  authDomain: "contassararui.firebaseapp.com",
  projectId: "contassararui",
  storageBucket: "contassararui.firebasestorage.app",
  messagingSenderId: "760330070358",
  appId: "1:760330070358:web:5d1f213133bfdbe902cef7"
};

// Inicializar Firebase
firebase.initializeApp(firebaseConfig);

// Obter Firestore
const db = firebase.firestore();

// Variável para guardar o estado das despesas
let expenses = []; 

// --- Funções Auxiliares ---

// Função para formatar a data (opcional, mas bom para display)
function formatDate(isoDate) {
  const parts = isoDate.split('-');
  return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/AAAA
}

// 1. Renderizar uma Despesa (usando a estrutura do index.html)
function renderExpense(doc) {
  const e = doc.data();
  const expenseId = doc.id;
  const item = document.createElement("div");
  item.className = "expense-item";

  item.innerHTML = `
    <p>
      <strong>${e.payer} pagou ${e.amount.toFixed(2)} €</strong>
      <button data-id="${expenseId}">Apagar</button>
    </p>
    <p class="description">${e.description} (${formatDate(e.date)})</p>
  `;

  // Ligar o botão de apagar
  item.querySelector('button').addEventListener('click', () => {
    deleteExpense(expenseId);
  });
  
  return item;
}

// 2. Atualizar o Resumo do Saldo
function updateBalance(expenses) {
  let totalSaraPaid = 0;
  let totalRuiPaid = 0;
  let totalSum = 0;
  
  // Calcular o que cada um pagou
  expenses.forEach(e => {
    totalSum += e.amount;
    if (e.payer === 'Sara') {
      totalSaraPaid += e.amount;
    } else {
      totalRuiPaid += e.amount;
    }
  });

  let settlementMessage = "";
  
  // Calcular o acerto
  if (totalSaraPaid > totalRuiPaid) {
    const diff = (totalSaraPaid - totalRuiPaid) / 2;
    settlementMessage = `**Rui** deve transferir **${diff.toFixed(2)} €** a **Sara** para acertar as contas.`;
  } else if (totalRuiPaid > totalSaraPaid) {
    const diff = (totalRuiPaid - totalSaraPaid) / 2;
    settlementMessage = `**Sara** deve transferir **${diff.toFixed(2)} €** a **Rui** para acertar as contas.`;
  } else {
    settlementMessage = "As contas estão certas! Ninguém deve nada a ninguém.";
  }
  
  // Atualizar a interface
  document.getElementById("balanceSara").textContent = totalSaraPaid.toFixed(2);
  document.getElementById("balanceRui").textContent = totalRuiPaid.toFixed(2);
  document.getElementById("totalSum").textContent = totalSum.toFixed(2);
  document.getElementById("settlements").innerHTML = settlementMessage;
}


// --- Funções de Data Access (CRUD) ---

// Adicionar Despesa
async function addExpense(payer, amount, date, description) {
  await db
    .collection("households")
    .doc("sara_rui")
    .collection("expenses")
    .add({
      payer,
      amount, // Guardar como number
      date,
      description
    });

  // Não usar alert aqui para não interromper
}

// Apagar Despesa
async function deleteExpense(expenseId) {
  if (!confirm("Tem certeza que quer apagar esta despesa?")) return;

  try {
    await db
      .collection("households")
      .doc("sara_rui")
      .collection("expenses")
      .doc(expenseId)
      .delete();
    
    //alert("Despesa apagada!");
    await loadExpenses(); // Recarregar a lista
  } catch (error) {
    console.error("Erro ao apagar despesa:", error);
    alert("Erro ao apagar despesa. Verifique as regras do Firebase.");
  }
}

// Limpar Todas as Despesas
async function clearAllExpenses() {
  if (!confirm("ATENÇÃO: Tem certeza que quer APAGAR TODAS AS DESPESAS? Esta ação não pode ser desfeita.")) {
    return;
  }

  try {
    const batch = db.batch();
    
    // Obter todas as despesas
    const snap = await db
      .collection("households")
      .doc("sara_rui")
      .collection("expenses")
      .get();

    snap.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    alert("Todas as despesas foram apagadas!");
    await loadExpenses(); // Recarregar a lista (que estará vazia)
  } catch (error) {
    console.error("Erro ao limpar todas as despesas:", error);
    alert("Erro ao limpar despesas. Verifique as regras do Firebase.");
  }
}

// Carregar despesas
async function loadExpenses() {
  // CORREÇÃO: Usar ID "list" do HTML
  const list = document.getElementById("list"); 
  const loadingStatus = document.getElementById("loading-status");
  list.innerHTML = "";
  loadingStatus.textContent = "A carregar despesas...";
  
  try {
    const snap = await db
      .collection("households")
      .doc("sara_rui")
      .collection("expenses")
      .orderBy("date", "desc")
      .get();
      
    expenses = []; // Reset do array de estado
    
    // 1. Construir a lista e preencher o array
    snap.forEach((doc) => {
      list.appendChild(renderExpense(doc));
      expenses.push(doc.data());
    });
    
    // 2. Atualizar o saldo
    updateBalance(expenses);
    
    // 3. Status
    if (snap.empty) {
      loadingStatus.textContent = "Não há despesas registadas.";
    } else {
      loadingStatus.textContent = `Despesas carregadas: ${snap.docs.length}`;
    }
    
  } catch (error) {
    console.error("Erro ao carregar despesas:", error);
    loadingStatus.textContent = "Erro ao ligar à base de dados. Verifique a sua conexão ou regras do Firebase.";
  }
}


// --- Ligar ao formulário e inicialização ---
document.addEventListener("DOMContentLoaded", () => {
  // ligar o formulário
  const form = document.getElementById("expenseForm");
  if (form) {
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();

      const payerEl = document.getElementById("payer");
      const amountEl = document.getElementById("amount");
      // O seu HTML não tem campo date, então gera-se a data de hoje
      const date = new Date().toISOString().slice(0, 10); 
      const descriptionEl = document.getElementById("description");

      const payer = payerEl ? payerEl.value : "";
      // Usar valueAsNumber e arredondar a 2 casas decimais
      const amount = amountEl ? Math.round(amountEl.valueAsNumber * 100) / 100 : NaN; 
      const description = descriptionEl ? descriptionEl.value : "";

      if (!payer) { alert("Selecione o pagador."); return; }
      if (!amount || amount <= 0) { alert("Quantia inválida."); return; }
      if (!description) { alert("Adicione uma descrição."); return; }

      await addExpense(payer, amount, date, description); 
      
      // recarregar e atualizar o saldo
      await loadExpenses();
      
      // Feedback rápido
      document.getElementById("loading-status").textContent = "Despesa gravada!";

      // reset
      form.reset();
      if (payerEl) payerEl.value = "";
      if (amountEl) amountEl.focus();
    });
  }

  // ligar botão limpar
  const clearBtn = document.getElementById("clearAllBtn");
  if (clearBtn) clearBtn.addEventListener("click", clearAllExpenses);

  // chamar loadExpenses após o DOM estar pronto
  loadExpenses();
});

