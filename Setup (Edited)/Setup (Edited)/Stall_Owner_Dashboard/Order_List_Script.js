// Assumes Firebase is initialized and db is available

document.addEventListener("DOMContentLoaded", async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const stallId = urlParams.get("stallId");

  document.getElementById("backBtn").onclick = () => {
    window.location.href = `Stall_Screen_Index.html?stallId=${stallId}`;
  };

  const productionList = document.getElementById("productionList");
  const collectionList = document.getElementById("collectionList");

  // Listen for real-time updates
  db.collection("transactions")
    .where("stallId", "==", stallId)
    .where("status", "in", ["pending", "done"])
    .orderBy("timestamp", "asc")
    .onSnapshot(snapshot => {
      // Clear lists
      productionList.innerHTML = "";
      collectionList.innerHTML = "";

      snapshot.forEach(doc => {
        const order = doc.data();
        const orderId = order.orderId;
        const items = order.items || [];
        const status = order.status;

        // Build food items list
        const foodListHtml = items.map(item =>
          `<li>${item.name} <span style="color:#888;">x${item.quantity}</span></li>`
        ).join("");

        // Order block HTML
        const block = document.createElement("div");
        block.className = "order-block";
        block.innerHTML = `
          <div class="order-info">
            <div class="order-id">Order ID: ${orderId}</div>
            <ul class="food-list">${foodListHtml}</ul>
          </div>
          <button class="order-action-btn">${status === "pending" ? "Done" : "Received"}</button>
        `;

        // Button logic
        const btn = block.querySelector(".order-action-btn");
        if (status === "pending") {
          btn.onclick = async () => {
            await doc.ref.update({ status: "done" });
          };
          productionList.appendChild(block);
        } else if (status === "done") {
          btn.onclick = async () => {
            await doc.ref.update({ status: "received" });
          };
          collectionList.appendChild(block);
        }
      });
    });
});