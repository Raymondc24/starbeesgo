document.addEventListener("DOMContentLoaded", () => {
    const urlParams = new URLSearchParams(window.location.search);
    const stallId = urlParams.get("stallId");

    const paymentMethodsList = document.getElementById("paymentMethodsList");
    const addPaymentForm = document.getElementById("addPaymentForm");

    // Fetch and display payment methods
    const fetchPaymentMethods = async () => {
        paymentMethodsList.innerHTML = ""; // Clear the list
        const snapshot = await db.collection("paymentMethods").where("stallId", "==", stallId).get();
        snapshot.forEach(doc => {
            const data = doc.data();
            const listItem = document.createElement("li");
            listItem.innerHTML = `
                <strong>${data.category} - ${data.name}</strong>
                <button class="edit-btn" data-id="${doc.id}">Edit</button>
                <button class="delete-btn" data-id="${doc.id}">Delete</button>
            `;
            paymentMethodsList.appendChild(listItem);
        });

        // Add event listeners for edit and delete buttons
        document.querySelectorAll(".edit-btn").forEach(button => {
            button.addEventListener("click", () => editPaymentMethod(button.dataset.id));
        });
        document.querySelectorAll(".delete-btn").forEach(button => {
            button.addEventListener("click", () => deletePaymentMethod(button.dataset.id));
        });
    };

    // Add a new payment method
    addPaymentForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const category = document.getElementById("category").value;
        const name = document.getElementById("name").value;
        const url = document.getElementById("url").value;
        const api = document.getElementById("api").value;

        await db.collection("paymentMethods").add({
            stallId,
            category,
            name,
            url,
            api
        });

        alert("Payment method added successfully!");
        addPaymentForm.reset();
        fetchPaymentMethods();
    });

    // Edit a payment method
    const editPaymentMethod = async (id) => {
        const doc = await db.collection("paymentMethods").doc(id).get();
        const data = doc.data();

        document.getElementById("category").value = data.category;
        document.getElementById("name").value = data.name;
        document.getElementById("url").value = data.url;
        document.getElementById("api").value = data.api;

        addPaymentForm.onsubmit = async (e) => {
            e.preventDefault();
            await db.collection("paymentMethods").doc(id).update({
                category: document.getElementById("category").value,
                name: document.getElementById("name").value,
                url: document.getElementById("url").value,
                api: document.getElementById("api").value
            });

            alert("Payment method updated successfully!");
            addPaymentForm.reset();
            addPaymentForm.onsubmit = addPaymentFormSubmitHandler; // Reset to default handler
            fetchPaymentMethods();
        };
    };

    // Delete a payment method
    const deletePaymentMethod = async (id) => {
        if (confirm("Are you sure you want to delete this payment method?")) {
            await db.collection("paymentMethods").doc(id).delete();
            alert("Payment method deleted successfully!");
            fetchPaymentMethods();
        }
    };

    // Fetch payment methods on page load
    fetchPaymentMethods();
});