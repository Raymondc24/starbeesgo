document.addEventListener("DOMContentLoaded", async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const stallId = urlParams.get("stallId");
    const userId = urlParams.get("userId");

    const paymentCategoryButtonsContainer = document.getElementById("paymentCategoryButtonsContainer");
    const paymentButtonsContainer = document.getElementById("paymentButtonsContainer");
    const stallImage = document.getElementById("stallImage");
    const stallNameSpan = document.querySelector("#stallName span");
    const totalAmount = document.getElementById("totalAmount");
    const orderIdElement = document.getElementById("orderId");
    const itemList = document.getElementById("itemList");
    const issueDate = document.getElementById("issueDate");
    const dueDate = document.getElementById("dueDate");

    let cartItems = [];
    let total = 0;
    let timer = null;
    let paymentSelected = false;
    let preGeneratedOrderId = "-";
    let preGeneratedOrderDate = "";

    // Generate next order ID for today and this stall (using UTC+8)
    async function generateNextOrderId() {
        const serverDate = await getServerDate();
        // Add 8 hours for UTC+8
        const utc8Date = new Date(serverDate.getTime() + 8 * 60 * 60 * 1000);
        const orderDate = utc8Date.toISOString().slice(0, 10); // "YYYY-MM-DD"
        const snapshot = await db.collection("transactions")
            .where("orderDate", "==", orderDate)
            .where("stallId", "==", stallId)
            .orderBy("orderId", "desc")
            .limit(1)
            .get();
        let lastOrderId = snapshot.empty ? 0 : parseInt(snapshot.docs[0].data().orderId, 10);
        return {
            orderId: (lastOrderId + 1).toString().padStart(4, "0"),
            orderDate
        };
    }

    // Fetch Stall Details
    const fetchStallDetails = async () => {
        const stallDoc = await db.collection("stalls").doc(stallId).get();
        if (stallDoc.exists) {
            const stallData = stallDoc.data();
            stallImage.src = stallData.imageUrl;
            stallNameSpan.textContent = stallData.name;
        }
    };

    // Fetch and Display Item List & Calculate Total
    const fetchItemList = async () => {
        itemList.innerHTML = "";
        total = 0;
        cartItems = [];
        const itemsSnapshot = await db.collection("cart").where("stallId", "==", stallId).get();
        if (itemsSnapshot.empty) {
            window.location.href = `Stall_Selection_Index.html?stallId=${stallId}`;
            return;
        }
        itemsSnapshot.forEach(doc => {
            const item = doc.data();
            cartItems.push({ ...item, id: doc.id });
            let itemTotal = item.totalPrice;
            if (typeof itemTotal !== "number") {
                itemTotal = (item.price && item.quantity) ? item.price * item.quantity : 0;
            }
            total += itemTotal;
            const listItem = document.createElement("li");
            listItem.textContent = `${item.name}: RM ${itemTotal.toFixed(2)} ------ x${item.quantity} `;
            itemList.appendChild(listItem);
        });
        totalAmount.textContent = `RM ${total.toFixed(2)}`;
    };

    // Set Issue and Due Dates
    const now = new Date();
    issueDate.textContent = now.toLocaleString();
    dueDate.textContent = new Date(now.getTime() + 3 * 60000).toLocaleString();

    // Timer for 3 minutes
    timer = setTimeout(() => {
        if (!paymentSelected) {
            alert("Payment unsuccessful. Time expired.");
            window.location.href = `Stall_Selection_Index.html?userId=${userId}`;
        }
    }, 3 * 60 * 1000);

    // Fetch unique payment categories for this stall
    async function renderPaymentCategoryButtons() {
        paymentCategoryButtonsContainer.innerHTML = "";
        const snapshot = await db.collection("paymentMethods")
            .where("stallId", "==", stallId)
            .get();
        if (snapshot.empty) return;

        // Sort categories by name (ascending)
        const categories = [...new Set(snapshot.docs.map(doc => doc.data().category))]
            .sort((a, b) => a.localeCompare(b));
        categories.forEach(category => {
            const btn = document.createElement("button");
            btn.className = "payment-category-btn";
            btn.textContent = category;
            btn.onclick = () => fetchPaymentMethods(category);
            paymentCategoryButtonsContainer.appendChild(btn);
        });
    }

    // Fetch and render payment methods for a category
    const fetchPaymentMethods = async (category) => {
        paymentButtonsContainer.innerHTML = "";
        const snapshot = await db.collection("paymentMethods")
            .where("stallId", "==", stallId)
            .where("category", "==", category)
            .get();

        // Sort payment methods by name (ascending)
        const sortedDocs = snapshot.docs.slice().sort((a, b) => {
            const nameA = a.data().name || "";
            const nameB = b.data().name || "";
            return nameA.localeCompare(nameB);
        });

        sortedDocs.forEach(doc => {
            const data = doc.data();
            const button = document.createElement("button");
            button.classList.add("payment-btn");
            button.innerHTML = `
                ${data.iconUrl ? `<img src="${data.iconUrl}" alt="${data.name}" class="payment-method-icon">` : ""}
                <span>${data.name}</span>
            `;
            button.addEventListener("click", () => processPayment(data));
            paymentButtonsContainer.appendChild(button);
        });
    };

    // Process Payment
    const processPayment = async (paymentMethod) => {
        paymentSelected = true;
        clearTimeout(timer);
        alert(`Processing payment via ${paymentMethod.name}...`);
        setTimeout(async () => {
            alert("Payment successful!");

            // Use pre-generated orderId and orderDate
            const newOrderId = preGeneratedOrderId;
            const orderDate = preGeneratedOrderDate;

            // 2. Reset the cart after payment
            const batch = db.batch();
            cartItems.forEach(item => {
                const ref = db.collection("cart").doc(item.id);
                batch.delete(ref);
            });
            await batch.commit();

            // 3. Add transaction with up-to-date orderId and orderDate
            await db.collection("transactions").add({
                orderId: newOrderId || "",
                stallId: stallId || "",
                paymentMethod: paymentMethod?.name || "",
                amount: typeof total === "number" ? total : 0,
                timestamp: firebase.firestore.FieldValue.serverTimestamp(),
                orderDate: orderDate || "",
                userId: userId || "",
                status: "pending",
                items: cartItems.map(item => ({
                    name: item.name || "",
                    quantity: typeof item.quantity === "number" ? item.quantity : 0,
                    price: typeof item.price === "number" ? item.price : 0,
                    totalPrice: typeof item.totalPrice === "number"
                        ? item.totalPrice
                        : (item.price && item.quantity ? item.price * item.quantity : 0),
                    category: item.category || "" // <-- Add this line
                }))
            });

            window.location.href = `Checkout_Index.html?userId=${userId}&stallId=${stallId}&orderId=${newOrderId}&orderDate=${orderDate}`;
        }, 2000);
    };

    // Back Button
    document.getElementById("backToCartBtn").addEventListener("click", () => {
        window.location.href = `Cart_Index.html?userId=${userId}&stallId=${stallId}`;
    });

    // Initialize Page
    await fetchStallDetails();
    await fetchItemList();
    await renderPaymentCategoryButtons();

    // Generate and show next order ID before payment
    const { orderId, orderDate } = await generateNextOrderId();
    preGeneratedOrderId = orderId;
    preGeneratedOrderDate = orderDate;
    orderIdElement.textContent = orderId;

    async function getServerDate() {
        await db.collection("serverTime").doc("now").set({ timestamp: firebase.firestore.FieldValue.serverTimestamp() });
        const snap = await db.collection("serverTime").doc("now").get();
        const serverTimestamp = snap.data().timestamp.toDate();
        return serverTimestamp;
    }

    // After successful payment/order creation:
    async function clearCart() {
        const user = firebase.auth().currentUser;
        if (!user || !stallId) return;

        const batch = db.batch();
        const cartRef = db.collection('cart');
        const prevCart = await cartRef
            .where('userId', '==', user.uid)
            .where('stallId', '==', stallId)
            .get();

        prevCart.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        console.log("Cart cleared after checkout");
    }
});