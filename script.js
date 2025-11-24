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

// --- Adicionar Despesa ---
async function addExpense(payer, amount, date, description) {
  await db
    .collection("households")
    .doc("sara_rui")
    .collection("expenses")
    .add({
      payer,
      amount,
      date,
      description
    });

  alert("Despesa gravada no Firebase!");
}

// --- Carregar despesas ---
async function loadExpenses() {
  const list = document.getElementById("expenseList");
  list.innerHTML = "";

  const snap = await db
    .collection("households")
    .doc("sara_rui")
    .collection("expenses")
    .orderBy("date", "desc")
    .get();

  snap.forEach((doc) => {
    const e = doc.data();
    const li = document.createElement("li");
    li.textContent = `${e.date} — ${e.payer}: €${e.amount} (${e.description})`;
    list.appendChild(li);
  });
}

// --- Ligar ao formulário e inicialização — aguardar DOM carregado ---
document.addEventListener("DOMContentLoaded", () => {
  // ligar o formulário
  const form = document.getElementById("expenseForm");
  if (form) {
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();

      const payerEl = document.getElementById("payer");
      const amountEl = document.getElementById("amount");
      const dateEl = document.getElementById("date"); // se não tiveres campo date pode ficar vazio
      const descriptionEl = document.getElementById("description");

      const payer = payerEl ? payerEl.value : "";
      const amount = amountEl ? parseFloat(amountEl.value) : NaN;
      const date = dateEl ? dateEl.value : new Date().toISOString().slice(0, 10);
      const description = descriptionEl ? descriptionEl.value : "";

      if (!payer) { alert("Selecione o pagador."); return; }
      if (!amount || amount <= 0) { alert("Quantia inválida."); return; }
      if (!description) { alert("Adicione uma descrição."); return; }

      await addExpense(payer, Math.round(amount * 100) / 100, date, description);
      // recarregar
      await loadExpenses();

      // reset
      form.reset();
      if (payerEl) payerEl.value = "";
      if (amountEl) amountEl.focus();
    });
  }

  // ligar botão limpar (se existe)
  const clearBtn = document.getElementById("clearAllBtn");
  if (clearBtn) clearBtn.addEventListener("click", clearAllExpenses);

  // chamar loadExpenses após o DOM estar pronto
  loadExpenses();
});

