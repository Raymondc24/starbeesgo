document.addEventListener('DOMContentLoaded', async () => {
    const urlParams = new URLSearchParams(window.location.search);
    let userId = urlParams.get("userId");

    // If userId not in URL, fallback to Firebase auth
    if (!userId) {
        await new Promise(resolve => {
            firebase.auth().onAuthStateChanged(user => {
                if (user) userId = user.uid;
                resolve();
            });
        });
    }

    const checkoutBody = document.getElementById('checkoutBody');

    // Load all orders for this user (not received)
    async function loadOrders(snapshot) {
        checkoutBody.innerHTML = "";
        if (!snapshot || snapshot.empty) {
            window.location.href = `Stall_Selection_Index.html?userId=${userId}`;
            return;
        }

        for (const doc of snapshot.docs) {
            const order = doc.data();
            const orderId = order.orderId;
            const stallId = order.stallId;
            const orderDate = order.orderDate; // <-- get orderDate from order
            const stallDoc = await db.collection("stalls").doc(stallId).get();
            const stall = stallDoc.exists ? stallDoc.data() : {};

            // Order block
            const block = document.createElement("div");
            block.className = "checkout-order-block";
            block.innerHTML = `
                <div class="order-info">
                    <div class="order-id">Order ID: ${orderId}</div>
                    <div class="order-meta">
                        <span>${stall.name || "Stall"}</span>
                    </div>
                </div>
                <img class="order-stall-img" src="${stall.imageUrl || 'https://via.placeholder.com/48'}" alt="Stall" />
                <span class="order-status">${order.status.charAt(0).toUpperCase() + order.status.slice(1)}</span>
            `;
            block.onclick = () => {
                window.location.href = `Checkout_Index.html?userId=${userId}&stallId=${stallId}&orderId=${orderId}&orderDate=${encodeURIComponent(orderDate || "")}`;
            };
            block.setAttribute("data-orderid", orderId);
            checkoutBody.appendChild(block);
        }
    }

    // Back button
    document.getElementById("backBtn").onclick = () => {
        window.location.href = `Stall_Selection_Index.html?userId=${userId}`;
    };

    // Initial load
    const initialSnapshot = await db.collection("transactions")
        .where("userId", "==", userId)
        .where("status", "in", ["pending", "done"])
        .orderBy("timestamp", "desc")
        .get();
    await loadOrders(initialSnapshot);

    db.collection("transactions")
        .where("userId", "==", userId)
        .where("status", "in", ["pending", "done"])
        .orderBy("timestamp", "desc")
        .onSnapshot(loadOrders);
});