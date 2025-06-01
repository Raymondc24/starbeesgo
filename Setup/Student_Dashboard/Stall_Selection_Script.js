// --- Navigation Functions ---
function goToStall(stallId, userId) {
  window.location.href = `Food_Selection_Index.html?userId=${userId}&stallId=${stallId}`;
}

function goToCartScreen(userId) {
  window.location.href = `Cart_Screen_Index.html?userId=${userId}`;
}

function goToCheckoutScreen(userId) {
  window.location.href = `Checkout_Screen_Index.html?userId=${userId}`;
}

// --- Load Registered Stalls ---
async function loadRegisteredStalls() {
  const stallContainer = document.querySelector(".stall-container");
  stallContainer.innerHTML = "";

  const stallsSnap = await db.collection("stalls").orderBy("order").get();
  stallsSnap.forEach(doc => {
    const stall = doc.data();
    const stallDiv = document.createElement("div");
    stallDiv.className = "stall";
    stallDiv.innerHTML = `
      <img src="${stall.imageUrl}" />
      <div>
        <strong>${stall.name}</strong>
        <div>Phone Number - ${stall.phone || ''}</div>
        ${!stall.isOpen ? '<div class="closed-label">Closed</div>' : ''}
      </div>
    `;
    if (stall.isOpen) {
      stallDiv.onclick = () => goToStall(doc.id, firebase.auth().currentUser.uid);
    } else {
      stallDiv.classList.add("stall-disabled");
      stallDiv.title = "Stall is closed";
    }
    stallContainer.appendChild(stallDiv);
  });
}

// --- Cart & Checkout Button State ---
async function updateCartButtonState() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) {
    console.error("Error: User is not authenticated.");
    return;
  }

  const cartButton = document.getElementById("cartButton");
  const checkoutButton = document.getElementById("checkoutButton");
  if (!cartButton) {
    console.error("Error: cartButton element not found.");
    return;
  }
  if (!checkoutButton) {
    console.error("Error: checkoutButton element not found.");
    return;
  }

  // --- Cart Button Logic ---
  const cartSnapshot = await db.collection("cart")
    .where("userId", "==", userId)
    .where("quantity", ">", 0)
    .get();

  if (cartSnapshot.empty) {
    cartButton.style.filter = "opacity(50%)";
    cartButton.style.cursor = "not-allowed";
    cartButton.disabled = true;
  } else {
    cartButton.style.filter = "opacity(100%)";
    cartButton.style.cursor = "pointer";
    cartButton.disabled = false;
  }

  // --- Checkout Button Logic ---
  const orderSnapshot = await db.collection("transactions")
    .where("userId", "==", userId)
    .where("status", "!=", "received")
    .limit(1)
    .get();

  if (orderSnapshot.empty) {
    checkoutButton.style.filter = "opacity(50%)";
    checkoutButton.style.cursor = "not-allowed";
    checkoutButton.disabled = true;
  } else {
    checkoutButton.style.filter = "opacity(100%)";
    checkoutButton.style.cursor = "pointer";
    checkoutButton.disabled = false;
  }

  cartButton.onclick = () => goToCartScreen(userId);
  checkoutButton.onclick = () => goToCheckoutScreen(userId);
}

// --- Auth State & Logout ---
firebase.auth().onAuthStateChanged(async (user) => {
  if (user) {
    await loadRegisteredStalls();
    await updateCartButtonState(); // Update cart button state on page load
  } else {
    console.error("Error: User is not authenticated.");
    window.location.href = '../Login_or_Register/loginanim.html'; // Redirect to login page
  }
});

document.getElementById('logoutButton').addEventListener('click', async () => {
  await auth.signOut();
  window.location.href = '../Login_or_Register/loginanim.html';
});