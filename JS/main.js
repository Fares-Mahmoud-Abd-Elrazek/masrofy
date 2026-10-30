(() => {
    const storageKey = "masrofy.expenses.v1";
    const categories = ["Food", "Transport", "Bills", "Fun", "Other"];
    const categoryColors = {
        Food: "#0f766e",
        Transport: "#38a69a",
        Bills: "#75c8b7",
        Fun: "#e5a84b",
        Other: "#9aa9a5"
    };
    const currency = new Intl.NumberFormat("en-EG", {
        style: "currency",
        currency: "EGP",
        maximumFractionDigits: 2
    });

    const element = (id) => {
        const found = document.getElementById(id);
        if (!found) {
            throw new Error(`Required page element #${id} was not found.`);
        }
        return found;
    };

    const form = element("expenseForm");
    const descriptionInput = element("desc");
    const amountInput = element("amount");
    const categoryInput = element("category");
    const dateInput = element("date");
    const submitButton = element("submitExpense");
    const cancelEditButton = element("cancelEdit");
    const monthFilter = element("monthFilter");
    const categoryFilter = element("categoryFilter");
    const expenseBody = element("expenseBody");
    const message = element("appMessage");
    const expensesHeading = element("dashboardTitle");
    const categoryCanvas = element("categoryChart");
    const categoryLegend = element("categoryLegend");

    let expenses = [];
    let editingId = null;
    function showMessage(text, type = "success") {
        message.textContent = text;
        message.className = `alert alert-${type}`;
    }

    function clearMessage() {
        message.textContent = "";
        message.className = "alert d-none";
    }

    function dateToISO(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
    }

    function isValidISODate(value) {
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return false;
        }

        const [year, month, day] = value.split("-").map(Number);
        const date = new Date(year, month - 1, day);
        return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
    }

    function parseStoredExpenses(value) {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) {
            throw new Error("Saved expenses are not in the expected format.");
        }

        return parsed.map((expense) => {
            const validExpense =
                expense &&
                typeof expense.id === "string" &&
                typeof expense.description === "string" &&
                expense.description.trim().length > 0 &&
                Number.isInteger(expense.amountCents) &&
                expense.amountCents > 0 &&
                categories.includes(expense.category) &&
                isValidISODate(expense.date);

            if (!validExpense) {
                throw new Error("Saved expense data contains an invalid entry.");
            }

            return expense;
        });
    }

    function saveExpenses(nextExpenses) {
        try {
            localStorage.setItem(storageKey, JSON.stringify(nextExpenses));
        } catch (error) {
            showMessage("Your change could not be saved in this browser. Check available storage and try again.", "danger");
            console.error("Could not save expenses to browser storage.", error);
            return false;
        }

        expenses = nextExpenses;
        return true;
    }

    function getMonthKey(date) {
        return date.slice(0, 7);
    }

    function getCurrentMonthKey() {
        return dateToISO(new Date()).slice(0, 7);
    }

    function getPreviousMonthKey() {
        const date = new Date();
        date.setDate(1);
        date.setMonth(date.getMonth() - 1);
        return dateToISO(date).slice(0, 7);
    }

    function getVisibleExpenses() {
        const selectedMonth = monthFilter.value;
        const selectedCategory = categoryFilter.value;

        return expenses
            .filter((expense) => {
                const matchesMonth =
                    selectedMonth === "all-time" ||
                    (selectedMonth === "this-month" && getMonthKey(expense.date) === getCurrentMonthKey()) ||
                    (selectedMonth === "last-month" && getMonthKey(expense.date) === getPreviousMonthKey());
                const matchesCategory = selectedCategory === "all" || expense.category === selectedCategory;
                return matchesMonth && matchesCategory;
            })
            .sort((first, second) => second.date.localeCompare(first.date) || second.id.localeCompare(first.id));
    }

    function getMonthExpenses() {
        const selectedMonth = monthFilter.value;
        return expenses.filter((expense) => {
            if (selectedMonth === "all-time") {
                return true;
            }
            const key = selectedMonth === "this-month" ? getCurrentMonthKey() : getPreviousMonthKey();
            return getMonthKey(expense.date) === key;
        });
    }

    function getAverageDayCount(filteredExpenses) {
        if (monthFilter.value === "this-month") {
            return new Date().getDate();
        }

        if (monthFilter.value === "last-month") {
            const [year, month] = getPreviousMonthKey().split("-").map(Number);
            return new Date(year, month, 0).getDate();
        }

        if (filteredExpenses.length === 0) {
            return 0;
        }

        const dates = filteredExpenses.map((expense) => new Date(`${expense.date}T00:00:00`).getTime());
        const dayMilliseconds = 24 * 60 * 60 * 1000;
        return Math.floor((Math.max(...dates) - Math.min(...dates)) / dayMilliseconds) + 1;
    }

    function formatDate(isoDate) {
        const [year, month, day] = isoDate.split("-").map(Number);
        return new Date(year, month - 1, day).toLocaleDateString("en-EG", {
            day: "2-digit",
            month: "short",
            year: "numeric"
        });
    }

    function updateHeading() {
        if (monthFilter.value === "all-time") {
            expensesHeading.textContent = "All time";
            return;
        }

        const monthKey = monthFilter.value === "this-month" ? getCurrentMonthKey() : getPreviousMonthKey();
        const [year, month] = monthKey.split("-").map(Number);
        expensesHeading.textContent = new Date(year, month - 1, 1).toLocaleDateString("en-EG", {
            month: "long",
            year: "numeric"
        });
    }

    function appendCell(row, text, className = "") {
        const cell = document.createElement("td");
        cell.textContent = text;
        if (className) {
            cell.className = className;
        }
        row.append(cell);
        return cell;
    }

    function renderExpenses(visibleExpenses) {
        expenseBody.replaceChildren();

        if (visibleExpenses.length === 0) {
            const row = document.createElement("tr");
            const cell = appendCell(row, "No expenses found for this filter.", "text-center text-body-secondary py-4");
            cell.colSpan = 5;
            expenseBody.append(row);
            return;
        }

        visibleExpenses.forEach((expense) => {
            const row = document.createElement("tr");
            appendCell(row, formatDate(expense.date));
            appendCell(row, expense.description);
            appendCell(row, expense.category);
            appendCell(row, currency.format(expense.amountCents / 100), "text-end");

            const actionsCell = document.createElement("td");
            actionsCell.className = "text-end text-nowrap";

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.className = "btn btn-outline-secondary btn-sm me-1";
            editButton.dataset.action = "edit";
            editButton.dataset.id = expense.id;
            editButton.textContent = "Edit";
            editButton.setAttribute("aria-label", `Edit ${expense.description}`);

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "btn btn-outline-danger btn-sm";
            deleteButton.dataset.action = "delete";
            deleteButton.dataset.id = expense.id;
            deleteButton.textContent = "Delete";
            deleteButton.setAttribute("aria-label", `Delete ${expense.description}`);

            actionsCell.append(editButton, deleteButton);
            row.append(actionsCell);
            expenseBody.append(row);
        });
    }

    function getCategoryTotals(filteredExpenses) {
        return categories
            .map((category) => ({
                category,
                amountCents: filteredExpenses
                    .filter((expense) => expense.category === category)
                    .reduce((total, expense) => total + expense.amountCents, 0)
            }))
            .filter((item) => item.amountCents > 0);
    }

    function renderCategoryChart(totals, totalCents) {
        const context = categoryCanvas.getContext("2d");
        if (!context) {
            throw new Error("This browser cannot draw the category chart.");
        }

        const width = categoryCanvas.clientWidth;
        const height = 220;
        const pixelRatio = window.devicePixelRatio || 1;
        categoryCanvas.width = width * pixelRatio;
        categoryCanvas.height = height * pixelRatio;
        categoryCanvas.style.height = `${height}px`;
        context.scale(pixelRatio, pixelRatio);
        context.clearRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;
        const outerRadius = Math.min(width * 0.32, height * 0.43);
        const innerRadius = outerRadius * 0.62;

        if (totalCents === 0) {
            context.beginPath();
            context.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
            context.arc(centerX, centerY, innerRadius, Math.PI * 2, 0, true);
            context.fillStyle = "#e7efec";
            context.fill();
        } else {
            let startAngle = -Math.PI / 2;
            totals.forEach(({ category, amountCents }) => {
                const endAngle = startAngle + (amountCents / totalCents) * Math.PI * 2;
                context.beginPath();
                context.arc(centerX, centerY, outerRadius, startAngle, endAngle);
                context.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
                context.closePath();
                context.fillStyle = categoryColors[category];
                context.fill();
                startAngle = endAngle;
            });
        }

        context.fillStyle = "#183330";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.font = "600 14px Inter, sans-serif";
        context.fillText(totalCents === 0 ? "No data" : currency.format(totalCents / 100), centerX, centerY, innerRadius * 1.8);

        categoryCanvas.setAttribute(
            "aria-label",
            totals.length === 0
                ? "No spending in this period."
                : `Spending by category. Total: ${currency.format(totalCents / 100)}.`
        );

        categoryLegend.replaceChildren();
        if (totals.length === 0) {
            const emptyLegend = document.createElement("li");
            emptyLegend.className = "text-body-secondary small text-center";
            emptyLegend.textContent = "No expenses in this period.";
            categoryLegend.append(emptyLegend);
            return;
        }

        totals.forEach(({ category, amountCents }) => {
            const item = document.createElement("li");
            item.className = "category-legend-item";

            const label = document.createElement("span");
            label.className = "category-legend-label";
            const swatch = document.createElement("span");
            swatch.className = "category-swatch";
            swatch.style.backgroundColor = categoryColors[category];
            swatch.setAttribute("aria-hidden", "true");
            label.append(swatch, document.createTextNode(category));

            const amount = document.createElement("span");
            amount.className = "category-legend-amount";
            amount.textContent = `${currency.format(amountCents / 100)} (${Math.round((amountCents / totalCents) * 100)}%)`;
            item.append(label, amount);
            categoryLegend.append(item);
        });
    }

    function render() {
        const monthExpenses = getMonthExpenses();
        const visibleExpenses = getVisibleExpenses();
        const totalCents = monthExpenses.reduce((total, expense) => total + expense.amountCents, 0);
        const categoryTotals = getCategoryTotals(monthExpenses);
        const dayCount = getAverageDayCount(monthExpenses);

        element("totalSpent").textContent = currency.format(totalCents / 100);
        element("totalCategory").textContent = String(categoryTotals.length);
        element("dailyAverage").textContent = currency.format(dayCount === 0 ? 0 : totalCents / dayCount / 100);
        element("txCount").textContent = String(monthExpenses.length);

        updateHeading();
        renderExpenses(visibleExpenses);
        renderCategoryChart(categoryTotals, totalCents);
    }

    function resetForm() {
        form.reset();
        dateInput.value = dateToISO(new Date());
        editingId = null;
        submitButton.textContent = "Add expense";
        cancelEditButton.classList.add("d-none");
    }

    function startEditing(expense) {
        editingId = expense.id;
        descriptionInput.value = expense.description;
        amountInput.value = (expense.amountCents / 100).toFixed(2);
        categoryInput.value = expense.category;
        dateInput.value = expense.date;
        submitButton.textContent = "Save changes";
        cancelEditButton.classList.remove("d-none");
        descriptionInput.focus();
        clearMessage();
    }

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        clearMessage();

        const description = descriptionInput.value.trim();
        const amount = Number(amountInput.value);
        const amountCents = Math.round(amount * 100);
        const category = categoryInput.value;
        const date = dateInput.value;

        if (!description || description.length > 100 || !Number.isFinite(amount) || amountCents <= 0 ||
            !categories.includes(category) || !isValidISODate(date)) {
            showMessage("Enter a description, a positive amount, a category, and a valid date.", "danger");
            return;
        }

        if (editingId) {
            const updatedExpenses = expenses.map((expense) =>
                expense.id === editingId
                    ? { ...expense, description, amountCents, category, date }
                    : expense
            );
            if (saveExpenses(updatedExpenses)) {
                resetForm();
                render();
                showMessage("Expense updated.");
            }
            return;
        }

        const id = typeof window.crypto?.randomUUID === "function"
            ? window.crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        if (saveExpenses([...expenses, { id, description, amountCents, category, date }])) {
            resetForm();
            render();
            showMessage("Expense added.");
        }
    });

    cancelEditButton.addEventListener("click", () => {
        resetForm();
        clearMessage();
    });

    expenseBody.addEventListener("click", (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) {
            return;
        }

        const expense = expenses.find((item) => item.id === button.dataset.id);
        if (!expense) {
            showMessage("That expense could not be found. Refresh the page and try again.", "danger");
            return;
        }

        if (button.dataset.action === "edit") {
            startEditing(expense);
            return;
        }

        if (button.dataset.action === "delete") {
            const remainingExpenses = expenses.filter((item) => item.id !== expense.id);
            if (saveExpenses(remainingExpenses)) {
                if (editingId === expense.id) {
                    resetForm();
                }
                render();
                showMessage("Expense deleted.");
            }
        }
    });

    monthFilter.addEventListener("change", render);
    categoryFilter.addEventListener("change", render);
    window.addEventListener("resize", () => {
        const filteredExpenses = getMonthExpenses();
        const totals = getCategoryTotals(filteredExpenses);
        const totalCents = filteredExpenses.reduce((total, expense) => total + expense.amountCents, 0);
        renderCategoryChart(totals, totalCents);
    });

    try {
        const storedExpenses = localStorage.getItem(storageKey);
        expenses = storedExpenses === null ? [] : parseStoredExpenses(storedExpenses);
        dateInput.value = dateToISO(new Date());
    } catch (error) {
        form.querySelectorAll("input, select, button").forEach((control) => {
            control.disabled = true;
        });
        monthFilter.disabled = true;
        categoryFilter.disabled = true;
        showMessage("Saved expenses could not be loaded. Your browser data was left unchanged; check the browser console for details.", "danger");
        console.error("Could not load expenses from browser storage.", error);
    }

    render();
})();