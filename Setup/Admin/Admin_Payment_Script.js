let editingId = null;
let uploadedIconUrl = "";
let currentCategory = null;

// DOM elements
const paymentForm = document.getElementById("paymentForm");
const categorySelect = document.getElementById("category");
const newCategoryInput = document.getElementById("newCategory");
const nameInput = document.getElementById("name");
const iconFileInput = document.getElementById("iconFileInput");
const iconPreview = document.getElementById("iconPreview");
const removeIconBtn = document.getElementById("removeIconBtn");
const submitBtn = document.getElementById("submitBtn");
const categoryButtons = document.getElementById("categoryButtons");
const paymentTable = document.getElementById("paymentTable");
const paymentTableBody = document.getElementById("paymentTableBody");
const categoryInput = document.getElementById("categoryInput");
const categoryList = document.getElementById("categoryList");

// --- CATEGORY HANDLING ---

async function getAllCategories() {
    const snap = await db.collection("adminPaymentMethods").get();
    const categories = new Set();
    snap.forEach(doc => {
        categories.add(doc.data().category);
    });
    return Array.from(categories);
}

async function renderCategorySelect(selected = "") {
    const categories = await getAllCategories();
    categorySelect.innerHTML = `<option value="">Select Category</option>`;
    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        opt.textContent = cat;
        categorySelect.appendChild(opt);
    });
    if (selected) categorySelect.value = selected;
}

async function renderCategoryList(selected = "") {
    const categories = await getAllCategories();
    categoryList.innerHTML = "";
    categories.forEach(cat => {
        const opt = document.createElement("option");
        opt.value = cat;
        categoryList.appendChild(opt);
    });
    if (selected) categoryInput.value = selected;
}

async function renderCategoryButtons(selected = null) {
    const categories = await getAllCategories();
    categories.sort(); // Sort ascending
    categoryButtons.innerHTML = "";
    categories.forEach(cat => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = cat;
        btn.className = "category-btn" + (cat === selected ? " active" : "");
        btn.onclick = () => {
            currentCategory = cat;
            renderCategoryButtons(cat);
            renderPaymentList(cat);
        };
        categoryButtons.appendChild(btn);
    });
}

// --- PAYMENT LIST ---

async function renderPaymentList(category) {
    paymentTableBody.innerHTML = "";
    paymentTable.classList.add("hidden");
    if (!category) return;

    const snap = await db.collection("adminPaymentMethods")
        .where("category", "==", category)
        .get();

    if (snap.empty) return;

    // Collect and sort by name
    const rows = [];
    snap.forEach(doc => {
        const data = doc.data();
        rows.push({ id: doc.id, data });
    });
    rows.sort((a, b) => a.data.name.localeCompare(b.data.name));

    rows.forEach(({ id, data }) => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td class="icon-cell">${data.iconUrl ? `<img src="${data.iconUrl}" alt="icon">` : ""}</td>
            <td>${data.name}</td>
            <td>${data.category}</td>
            <td>
                <button class="action-btn" onclick="editPaymentMethod('${id}')">Edit</button>
                <button class="action-btn remove-btn" onclick="removePaymentMethod('${id}')">Remove</button>
            </td>
        `;
        paymentTableBody.appendChild(tr);
    });
    paymentTable.classList.remove("hidden");
}

// --- FORM HANDLING ---

window.editPaymentMethod = async function(id) {
    const doc = await db.collection("adminPaymentMethods").doc(id).get();
    if (!doc.exists) return;
    const data = doc.data();
    editingId = id;
    nameInput.value = data.name;
    await renderCategoryList(data.category);
    categoryInput.value = data.category;
    if (data.iconUrl) {
        uploadedIconUrl = data.iconUrl;
        iconPreview.src = uploadedIconUrl;
        iconPreview.style.display = "inline";
        removeIconBtn.style.display = "inline";
    } else {
        uploadedIconUrl = "";
        iconPreview.style.display = "none";
        removeIconBtn.style.display = "none";
    }
    submitBtn.textContent = "Done";
};

window.removePaymentMethod = async function(id) {
    if (confirm("Are you sure you want to remove this payment method?")) {
        await db.collection("adminPaymentMethods").doc(id).delete();
        await renderCategorySelect(currentCategory);
        await renderCategoryButtons(currentCategory);
        await renderPaymentList(currentCategory);
    }
};

paymentForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const category = categoryInput.value.trim();
    if (!category || !nameInput.value.trim()) {
        alert("Please fill in all required fields.");
        return;
    }

    const data = {
        category,
        name: nameInput.value.trim(),
        iconUrl: uploadedIconUrl
    };

    if (editingId) {
        await db.collection("adminPaymentMethods").doc(editingId).update(data);
        editingId = null;
        submitBtn.textContent = "Add Payment Method";
    } else {
        await db.collection("adminPaymentMethods").add(data);
    }

    paymentForm.reset();
    await renderCategoryList();
    categoryInput.value = ""; // <-- This ensures the input is always blank
    uploadedIconUrl = "";
    iconPreview.style.display = "none";
    removeIconBtn.style.display = "none";
    await renderCategoryButtons();
    currentCategory = category;
    await renderPaymentList(category);
});

// --- ICON UPLOAD ---

iconFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = () => {
            uploadedIconUrl = reader.result;
            iconPreview.src = uploadedIconUrl;
            iconPreview.style.display = "inline";
            removeIconBtn.style.display = "inline";
        };
        reader.readAsDataURL(file);
    }
});

removeIconBtn.addEventListener("click", () => {
    uploadedIconUrl = "";
    iconPreview.src = "";
    iconPreview.style.display = "none";
    removeIconBtn.style.display = "none";
    iconFileInput.value = "";
});

// --- INITIAL LOAD ---

(async function init() {
    await renderCategoryList();
    await renderCategoryButtons();
})();

// --- BACK BUTTON ---
document.getElementById("backBtn").onclick = function() {
    window.location.href = "Admin_Main_Index.html";
};