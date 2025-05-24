document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const stallId = urlParams.get("stallId");

    const paymentButtonsContainer = document.getElementById("paymentButtonsContainer");
    const stallImage = document.getElementById("stallImage");
    const stallName = document.getElementById("stallName span");
    const totalAmount = document.getElementById("totalAmount");
    const orderIdElement = document.getElementById("orderId");
    const itemList = document.getElementById("itemList");
    const issueDate = document.getElementById("issueDate");
    const dueDate = document.getElementById("dueDate");

    // Generate Order ID
    const generateOrderId = async () => {
        const snapshot = await db.collection("transactions").orderBy("orderId", "desc").limit(1).get();
        let lastOrderId = snapshot.empty ? 0 : snapshot.docs[0].data().orderId;
        return lastOrderId + 1;
    };

    const orderId = await generateOrderId();
    orderIdElement.textContent = orderId;

    // Fetch Stall Details
    const fetchStallDetails = async () => {
        const stallDoc = await db.collection("stalls").doc(stallId).get();
        if (stallDoc.exists) {
            const stallData = stallDoc.data();
            stallImage.src = stallData.imageUrl;
            stallName.textContent = stallData.name;
            totalAmount.textContent = `RM ${stallData.totalAmount.toFixed(2)}`;
        }
    };

    // Fetch and Display Item List
    const fetchItemList = async () => {
        const itemsSnapshot = await db.collection("cart").where("stallId", "==", stallId).get();
        itemsSnapshot.forEach(doc => {
            const item = doc.data();
            const listItem = document.createElement("li");
            listItem.textContent = `${item.name} x${item.quantity} - RM ${item.totalPrice.toFixed(2)}`;
            itemList.appendChild(listItem);
        });
    };

    // Set Issue and Due Dates
    const now = new Date();
    issueDate.textContent = now.toLocaleString();
    dueDate.textContent = new Date(now.getTime() + 3 * 60000).toLocaleString();

    // Fetch Payment Methods by Category
    const fetchPaymentMethods = async (category) => {
        paymentButtonsContainer.innerHTML = "";
        const snapshot = await db.collection("paymentMethods").where("stallId", "==", stallId).where("category", "==", category).get();
        snapshot.forEach(doc => {
            const data = doc.data();
            const button = document.createElement("button");
            button.classList.add("payment-btn");
            button.innerHTML = `<img src="${data.iconUrl}" alt="${data.name}"><br>${data.name}`;
            button.addEventListener("click", () => processPayment(data));
            paymentButtonsContainer.appendChild(button);
        });
    };

    // Process Payment
    const processPayment = async (paymentMethod) => {
        alert(`Processing payment via ${paymentMethod.name}...`);
        setTimeout(async () => {
            alert("Payment successful!");
            await db.collection("transactions").add({
                orderId,
                stallId,
                paymentMethod: paymentMethod.name,
                amount: parseFloat(totalAmount.textContent.replace("RM ", "")),
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });
            window.location.href = `Checkout_Index.html?stallId=${stallId}`;
        }, 2000);
    };

    // Event Listeners for Category Buttons
    document.getElementById("eWalletBtn").addEventListener("click", () => fetchPaymentMethods("eWallet"));
    document.getElementById("creditCardBtn").addEventListener("click", () => fetchPaymentMethods("Credit/Debit Card"));
    document.getElementById("onlineBankingBtn").addEventListener("click", () => fetchPaymentMethods("Online Banking"));

    // Back Button
    document.getElementById("backToCartBtn").addEventListener("click", () => {
        window.location.href = `Cart_Index.html?stallId=${stallId}`;
    });

    // Initialize Page
    await fetchStallDetails();
    await fetchItemList();
});