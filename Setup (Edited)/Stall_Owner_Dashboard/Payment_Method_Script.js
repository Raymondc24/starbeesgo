document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const stallId = urlParams.get("stallId");

    const paymentMethodsList = document.getElementById("paymentMethodsList");
    const addPaymentForm = document.getElementById("addPaymentForm");
    const addCategory = document.getElementById("addCategory");
    const addName = document.getElementById("addName");
    const categoryButtonsContainer = document.getElementById("categoryButtons");
    const urlInput = document.getElementById("url");
    const apiInput = document.getElementById("api");
    const submitBtn = addPaymentForm.querySelector("button[type='submit']");

    let adminPaymentMethods = [];
    let currentCategory = null;

    // Fetch admin payment methods for dropdowns
    async function fetchAdminPaymentMethods() {
        const snap = await db.collection("adminPaymentMethods").get();
        adminPaymentMethods = snap.docs.map(doc => doc.data());
        // Populate category select
        const categories = [...new Set(adminPaymentMethods.map(pm => pm.category))];
        addCategory.innerHTML = `<option value="">Select Category</option>`;
        categories.forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat;
            opt.textContent = cat;
            addCategory.appendChild(opt);
        });
        // Clear name select
        addName.innerHTML = `<option value="">Select Name</option>`;
    }

    // Populate name select based on category
    addCategory.addEventListener("change", () => {
        const selectedCat = addCategory.value;
        addName.innerHTML = `<option value="">Select Name</option>`;
        if (!selectedCat) return;
        const names = adminPaymentMethods
            .filter(pm => pm.category === selectedCat)
            .map(pm => pm.name);
        [...new Set(names)].forEach(name => {
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            addName.appendChild(opt);
        });
    });

    // Fetch and display payment methods and categories
    async function fetchAndRender(selectedCategory = null) {
        // 1. Fetch all payment methods for this stall
        const snapshot = await db.collection("paymentMethods")
            .where("stallId", "==", stallId)
            .get();

        // 2. Extract unique categories and sort ascending
        const categories = [...new Set(snapshot.docs.map(doc => doc.data().category))].sort((a, b) => a.localeCompare(b));

        // 3. Render category buttons
        categoryButtonsContainer.innerHTML = "";
        categories.forEach(category => {
            const btn = document.createElement("button");
            btn.className = "category-btn";
            btn.textContent = category;
            if ((selectedCategory || currentCategory) === category) btn.classList.add("active");
            btn.onclick = () => {
                currentCategory = category;
                fetchAndRender(category);
            };
            categoryButtonsContainer.appendChild(btn);
        });

        // 4. Determine which category to show
        const categoryToShow = selectedCategory || currentCategory;
        currentCategory = categoryToShow;

        // 5. Show payment methods for the selected category
        paymentMethodsList.innerHTML = "";
        if (!categoryToShow) {
            // Don't show any list if no category selected
            return;
        }

        const filteredSnapshot = await db.collection("paymentMethods")
            .where("stallId", "==", stallId)
            .where("category", "==", categoryToShow)
            .get();

        if (filteredSnapshot.empty) {
            paymentMethodsList.innerHTML = "<div style='margin:20px 0;'>No payment method.</div>";
            return;
        }

        const paymentMethods = [];
        filteredSnapshot.forEach(doc => {
            const data = doc.data();
            paymentMethods.push({ id: doc.id, data });
        });
        paymentMethods.sort((a, b) => a.data.name.localeCompare(b.data.name));

        paymentMethods.forEach(({ id, data }) => {
            // Find the icon from adminPaymentMethods
            const adminPM = adminPaymentMethods.find(pm => pm.category === data.category && pm.name === data.name);
            const iconUrl = adminPM && adminPM.iconUrl ? adminPM.iconUrl : "";

            const card = document.createElement("div");
            card.className = "payment-option";
            card.style.margin = "10px";
            card.innerHTML = `
                ${iconUrl ? `<img src="${iconUrl}" alt="icon" style="max-width:40px;max-height:40px;display:block;margin-bottom:8px;">` : ""}
                <div style="font-weight:bold; font-size:1.1em; margin-bottom:8px;">${data.name}</div>
                <div style="margin-top:10px;">
                    <button class="select-payment-btn edit-btn" data-id="${id}" style="margin-right:5px;">Edit</button>
                    <button class="select-payment-btn" style="background:#dc3545;" data-id="${id}">Delete</button>
                </div>
            `;
            card.querySelector(".edit-btn").addEventListener("click", () => editPaymentMethod(id));
            card.querySelectorAll("button")[1].addEventListener("click", () => deletePaymentMethod(id));
            paymentMethodsList.appendChild(card);
        });
    }

    // Add a new payment method
    const defaultAddHandler = async (e) => {
        e.preventDefault();
        const category = addCategory.value;
        const name = addName.value;
        const url = urlInput.value;
        const api = apiInput.value;

        // Find iconUrl from adminPaymentMethods
        const adminPM = adminPaymentMethods.find(pm => pm.category === category && pm.name === name);
        const iconUrl = adminPM && adminPM.iconUrl ? adminPM.iconUrl : "";

        await db.collection("paymentMethods").add({
            stallId,
            category,
            name,
            url,
            api,
            iconUrl // <-- add this line
        });

        alert("Payment method added successfully!");
        addPaymentForm.reset();
        submitBtn.textContent = "Add Payment Method";
        currentCategory = null;
        fetchAndRender();
    };
    addPaymentForm.onsubmit = defaultAddHandler;

    // Edit a payment method
    const editPaymentMethod = async (id) => {
        const doc = await db.collection("paymentMethods").doc(id).get();
        const data = doc.data();

        addCategory.value = data.category;
        addCategory.dispatchEvent(new Event('change'));
        setTimeout(() => {
            addName.value = data.name;
        }, 0);
        urlInput.value = data.url || "";
        apiInput.value = data.api || "";

        submitBtn.textContent = "Done";

        addPaymentForm.onsubmit = async (e) => {
            e.preventDefault();
            // Find iconUrl from adminPaymentMethods
            const adminPM = adminPaymentMethods.find(pm => pm.category === addCategory.value && pm.name === addName.value);
            const iconUrl = adminPM && adminPM.iconUrl ? adminPM.iconUrl : "";

            await db.collection("paymentMethods").doc(id).update({
                category: addCategory.value,
                name: addName.value,
                url: urlInput.value,
                api: apiInput.value,
                iconUrl // <-- add this line
            });

            alert("Payment method updated successfully!");
            addPaymentForm.reset();
            addPaymentForm.onsubmit = defaultAddHandler;
            submitBtn.textContent = "Add Payment Method";
            currentCategory = null;
            fetchAndRender();
        };
    };

    // Delete a payment method
    const deletePaymentMethod = async (id) => {
        if (confirm("Are you sure you want to delete this payment method?")) {
            await db.collection("paymentMethods").doc(id).delete();
            alert("Payment method deleted successfully!");
            fetchAndRender(currentCategory);
        }
    };

    // Initial fetch
    fetchAdminPaymentMethods().then(() => fetchAndRender());

    document.getElementById("backBtn").addEventListener("click", () => {
        window.location.href = `Stall_Screen_Index.html?stallId=${stallId}`;
    });
});