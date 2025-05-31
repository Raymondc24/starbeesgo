// 1. Global Variables
let manageMode = false;

// 2. Utility Functions
function getStallIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('stallId');
}

// 3. Cart Data Functions
async function addItemToCart(stallId, foodId, quantity) {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) {
    console.error("Error: User is not authenticated.");
    return;
  }
  const cartRef = db.collection("cart").doc(`${userId}_${stallId}_${foodId}`);
  const cartDoc = await cartRef.get();

  if (cartDoc.exists) {
    await cartRef.update({
      quantity: firebase.firestore.FieldValue.increment(quantity)
    });
  } else {
    await cartRef.set({
      userId,
      stallId,
      foodId,
      quantity,
      name: "Food Name", // Replace with actual food name
      price: 10, // Replace with actual price
      imageUrl: "" // Replace with actual image URL
    });
  }
  await updateCartButtonState();
}

async function fetchCartDataWithRetry(retries = 3) {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) {
    console.error("Error: User is not authenticated.");
    return null;
  }
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const cartSnapshot = await db.collection("cart")
        .where("userId", "==", userId)
        .where("quantity", ">", 0)
        .get();
      return cartSnapshot;
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error);
      if (attempt === retries) {
        console.error("All retry attempts failed.");
        throw error;
      }
    }
  }
}

async function resetBasketQuantity() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) {
    console.error("Error: User is not authenticated.");
    return;
  }
  const cartSnapshot = await db.collection("cart")
    .where("userId", "==", userId)
    .get();

  if (cartSnapshot.empty) {
    console.log("No items in the cart. Redirecting to stall selection index...");
    window.location.href = `Stall_Selection_Index.html?userId=${userId}`;
    return;
  }

  const batch = db.batch();
  cartSnapshot.forEach(doc => {
    const cartRef = db.collection("cart").doc(doc.id);
    batch.update(cartRef, { quantity: 0 });
  });

  await batch.commit();
  console.log("Basket quantity reset to 0.");
}

async function loadCartData() {
  const cartBody = document.getElementById("cartBody");
  cartBody.innerHTML = "";

  const userId = firebase.auth().currentUser?.uid;
  if (!userId) {
    console.error("Error: User is not authenticated.");
    return;
  }

  const cartSnapshot = await db.collection("cart")
    .where("userId", "==", userId)
    .where("quantity", ">", 0)
    .get();

  if (cartSnapshot.empty) {
    console.log("No items in the cart. Redirecting to stall selection index...");
    window.location.href = `Stall_Selection_Index.html?userId=${userId}`;
    return;
  }

  // Group items by stallId
  const stallsMap = {};
  cartSnapshot.forEach(doc => {
    const data = doc.data();
    if (!stallsMap[data.stallId]) {
      stallsMap[data.stallId] = { totalQuantity: 0, stallId: data.stallId };
    }
    stallsMap[data.stallId].totalQuantity += data.quantity;
  });

  // Collect stall details into an array
  const stallArray = [];
  for (const stallId in stallsMap) {
    const stallData = stallsMap[stallId];
    const stallDoc = await db.collection("stalls").doc(stallId).get();

    const stallName = stallDoc.exists ? stallDoc.data().name : "Unknown Stall";
    const stallImage = stallDoc.exists ? stallDoc.data().imageUrl : "https://via.placeholder.com/150";
    const isOpen = stallDoc.exists ? stallDoc.data().isOpen : false;

    stallArray.push({
      stallId,
      stallName,
      stallImage,
      isOpen,
      totalQuantity: stallData.totalQuantity
    });
  }

  // Sort the array by stallName (ascending)
  stallArray.sort((a, b) => a.stallName.localeCompare(b.stallName));

  // Render sorted stalls
  for (const stall of stallArray) {
    const row = document.createElement("div");
    row.className = "cart-row cart-stall-block";
    row.setAttribute("data-stall-id", stall.stallId);

    if (!stall.isOpen) {
      row.classList.add("cart-stall-closed");
    }

    row.innerHTML = `
      <input type="checkbox" class="stall-checkbox" style="display: none;" />
      <div class="details">
        <h4>${stall.stallName} ${!stall.isOpen ? '<span class="closed-label">(Closed)</span>' : ''}</h4>
        <p>${stall.totalQuantity} items</p>
      </div>
      <img src="${stall.stallImage}" alt="${stall.stallName}" />
    `;
    cartBody.appendChild(row);

    row.addEventListener("click", (event) => {
      if (!manageMode) {
        window.location.href = `Cart_Index.html?userId=${userId}&stallId=${stall.stallId}`;
      }
    });
  }

  // Attach event listeners to dynamically added checkboxes
  const checkboxes = document.querySelectorAll(".stall-checkbox");
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener("change", (event) => {
      event.stopPropagation();
      updateSelectAllCheckbox();
    });
  });

  updateSelectAllCheckbox();
}

// 4. UI State Functions
function goBack() {
  const userId = firebase.auth().currentUser?.uid;
  if (userId) {
    window.location.href = `Stall_Selection_Index.html?userId=${userId}`;
  } else {
    console.error("Error: User is not authenticated.");
  }
}

function toggleManageMode() {
  manageMode = !manageMode;

  const manageButton = document.getElementById("manageButton");
  const cartFooter = document.getElementById("cartFooter");
  const checkboxes = document.querySelectorAll(".stall-checkbox");

  if (manageMode) {
    manageButton.textContent = "Cancel";
    cartFooter.classList.remove("hidden");
    checkboxes.forEach(checkbox => (checkbox.style.display = "block"));
  } else {
    manageButton.textContent = "Manage";
    cartFooter.classList.add("hidden");
    checkboxes.forEach(checkbox => (checkbox.style.display = "none"));
  }
}

function toggleSelectAll() {
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  const checkboxes = document.querySelectorAll(".stall-checkbox");

  checkboxes.forEach(checkbox => {
    checkbox.checked = selectAllCheckbox.checked;
  });
}

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  const checkboxes = document.querySelectorAll(".stall-checkbox");
  const allChecked = Array.from(checkboxes).every(checkbox => checkbox.checked);

  selectAllCheckbox.checked = allChecked;
}

// 5. Event Handlers
async function removeSelectedItems() {
  const checkboxes = document.querySelectorAll(".stall-checkbox:checked");

  if (checkboxes.length === 0) {
    alert("No items selected to remove.");
    return;
  }

  const batch = db.batch();

  for (const checkbox of checkboxes) {
    const stallDiv = checkbox.closest(".cart-stall-block");
    const stallId = stallDiv.getAttribute("data-stall-id");

    if (!stallId) {
      console.error("Error: Missing stallId for a selected item.");
      continue;
    }

    const cartSnapshot = await db.collection("cart")
      .where("userId", "==", firebase.auth().currentUser?.uid)
      .where("stallId", "==", stallId)
      .get();

    cartSnapshot.forEach(doc => {
      const cartRef = db.collection("cart").doc(doc.id);
      batch.delete(cartRef);
    });

    stallDiv.remove();
  }

  await batch.commit();
  console.log("Selected items removed.");

  // Check if the cart is now empty and redirect if necessary
  const userId = firebase.auth().currentUser?.uid;
  const updatedCartSnapshot = await db.collection("cart")
    .where("userId", "==", userId)
    .where("quantity", ">", 0)
    .get();

  if (updatedCartSnapshot.empty) {
    console.log("Cart is now empty. Redirecting to stall selection index...");
    window.location.href = `Stall_Selection_Index.html?userId=${userId}`;
  }
}

function attachEventListeners() {
  const backButton = document.getElementById("backButton");
  if (backButton) {
    backButton.addEventListener("click", goBack);
  } else {
    console.error("Error: backButton element not found.");
  }

  const manageButton = document.getElementById("manageButton");
  if (manageButton) {
    manageButton.addEventListener("click", toggleManageMode);
  } else {
    console.error("Error: manageButton element not found.");
  }

  const selectAllCheckbox = document.getElementById("selectAllCheckbox");
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener("change", toggleSelectAll);
  } else {
    console.error("Error: selectAllCheckbox element not found.");
  }

  const checkboxes = document.querySelectorAll(".stall-checkbox");
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener("change", (event) => {
      event.stopPropagation();
      updateSelectAllCheckbox();
    });
  });

  const removeSelectedButton = document.getElementById("removeSelectedButton");
  if (removeSelectedButton) {
    removeSelectedButton.addEventListener("click", removeSelectedItems);
  } else {
    console.error("Error: removeSelectedButton element not found.");
  }
}

// 6. Initialization
document.addEventListener('DOMContentLoaded', async () => {
  firebase.auth().onAuthStateChanged(async (user) => {
    if (user) {
      attachEventListeners();
      if (document.getElementById("cartBody")) {
        await loadCartData();
      }
    } else {
      console.error("Error: User is not authenticated.");
      window.location.href = "loginanim.html";
    }
  });
});