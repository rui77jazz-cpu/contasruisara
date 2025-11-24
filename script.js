// Guarda tudo no localStorage
function loadExpenses() {
  return JSON.parse(localStorage.getItem("expenses") || "[]");
}

function saveExpenses(list) {
  localStorage.setItem("expenses", JSON.stringify(list));
}

let expenses = loadExpenses();

function render() {
  const list = document.getElementById("list");
  list.innerHTML = "";

  expenses.forEach((e, i) => {
    const div = document.createElement("div");
    div.innerHTML = `
      <p><strong>${e.payer}</strong> pagou <strong>${e.amount}€</strong></p>
      <p>${e.description}</p>
      <button onclick="removeExpense(${i})">Remover</button>
      <hr>
    `;
    list.appendChild(div);
  });

  updateTotals();
}

function updateTotals() {
  let sara = 0;
  let rui = 0;
  let total = 0;

  expenses.forEach(e => {
    total += e.amount;
    if (e.payer === "Sara") sara += e.amount;
    if (e.payer === "Rui") rui += e.amount;
  });

  document.getElementById("balanceSara").textContent = sara;
  document.getElementById("balanceRui").textContent = rui;
  document.getElementById("totalSum").textContent = total;

  // Liquidação simples
  const settle = document.getElementById("settlements");
  settle.innerHTML = "";

  const diff = sara - rui;
  if (Math.abs(diff) < 0.01) {
    settle.textContent = "Tudo equilibrado.";
  } else if (diff > 0) {
    settle.textContent = `Rui deve pagar ${diff.toFixed(2)}€ à Sara.`;
  } else {
    settle.textContent = `Sara deve pagar ${(diff * -1).toFixed(2)}€ ao Rui.`;
  }
}

function removeExpense(i) {
  expenses.splice(i, 1);
  saveExpenses(expenses);
  render();
}

document.getElementById("expenseForm").addEventListener("submit", function (e) {
  e.preventDefault();

  const payer = document.getElementById("payer").value;
  const amount = parseFloat(document.getElementById("amount").value);
  const date = document.getElementById("date").value;
  const description = document.getElementById("description").value;

  if (isNaN(amount) || amount <= 0) {
    alert("Quantia inválida.");
    return;
  }

  expenses.unshift({ payer, amount, date, description });
  saveExpenses(expenses);
  render();

  document.getElementById("expenseForm").reset();
});

render();
