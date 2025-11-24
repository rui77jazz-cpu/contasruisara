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
const app = firebase.initializeApp(firebaseConfig);
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

// --- Ligar ao formulário ---
document.getElementById("expenseForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();

  const payer = document.getElementById("payer").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const date = document.getElementById("date").value;
  const description = document.getElementById("description").value;

  await addExpense(payer, amount, date, description);
  loadExpenses();
});

// Quando a página abrir → carregar despesas
loadExpenses();


