// Assumes Firebase is already initialized and db is available

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("orderId");
  const stallId = urlParams.get("stallId");
  if (!orderId) {
    document.getElementById("checkoutBody").innerHTML = "<p>Order not found.</p>";
    return;
  }

  // Query the transactions collection for the orderId
  const querySnapshot = await db.collection("transactions").where("orderId", "==", orderId).get();
  if (querySnapshot.empty) {
    document.getElementById("checkoutBody").innerHTML = "<p>Order not found.</p>";
    return;
  }
  const orderDoc = querySnapshot.docs[0];
  const order = orderDoc.data();

  // Fetch stall details
  const stallDoc = await db.collection("stalls").doc(order.stallId).get();
  const stall = stallDoc.exists ? stallDoc.data() : {};

  // Render order details
  renderOrderDetails(orderId, order, stall);

  // Back button logic
  document.getElementById("backButton").onclick = () => {
    window.location.href = `Stall_Selection_Index.html?stallId=${stallId}`;
  };
});

function renderOrderDetails(orderId, order, stall) {
  const checkoutBody = document.getElementById("checkoutBody");

  let paymentIconHtml = "";
  if (order.paymentMethod) {
    db.collection("adminPaymentMethods")
      .where("name", "==", order.paymentMethod)
      .limit(1)
      .get()
      .then(snap => {
        if (!snap.empty) {
          const iconUrl = snap.docs[0].data().iconUrl;
          paymentIconHtml = `<img src="${iconUrl}" alt="${order.paymentMethod}" class="payment-method-icon" />`;
        }
        render();
      });
  } else {
    render();
  }

  function render() {
    const isPending = order.status === "pending";
    checkoutBody.innerHTML = `
      <div class="order-card">
        <div class="order-id-block">
          <div class="order-id-label">Order ID:</div>
          <div class="order-id-digit">${orderId}</div>
        </div>
        <div class="stall-info-block">
          <img class="stall-image" src="${stall.imageUrl || 'https://via.placeholder.com/70'}" alt="Stall Image" />
          <div class="stall-name">${stall.name || 'Stall Name'}</div>
          <div class="stall-phone">Owner Phone: ${stall.phone || '-'}</div>
        </div>
        <div class="items-section">
          <div class="items-title">Items Purchased:</div>
          <ul class="items-list">
            ${(order.items || []).map(item => `
              <li>
                <span>${item.name}</span>
                <span>x${item.quantity}</span>
              </li>
            `).join('')}
          </ul>
        </div>
        <div class="total-section">
          <span class="total-label">Total</span>
          <span class="total-right">
            ${paymentIconHtml}
            <span class="total-amount">RM ${order.amount ? order.amount.toFixed(2) : "0.00"}</span>
          </span>
        </div>
        <button class="received-btn" id="receivedBtn"${isPending ? " disabled" : ""}>
          ${isPending ? "Pending" : "Receive"}
        </button>
      </div>
    `;

    if (!isPending) {
      document.getElementById("receivedBtn").onclick = async () => {
        // Find the Firestore docId by orderId
        const querySnapshot = await db.collection("transactions").where("orderId", "==", orderId).get();
        if (!querySnapshot.empty) {
          const docRef = querySnapshot.docs[0].ref;
          await docRef.update({ status: "received" });
          window.location.href = `Stall_Selection_Index.html?userId=${order.userId}`;
        }
      };
    }
  }
}