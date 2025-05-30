// Navigate to a specific stall's food selection page (for students)
function goToStall(number) {
  window.location.href = `Food_Selection_Index_${number}.html`;
}

// Navigate to the cart screen
function goToCartScreen() {
  window.location.href = "Cart_Screen_Index.html";
}

// Fetch and render only registered stalls for the student
async function loadRegisteredStalls() {
  const stallContainer = document.querySelector(".stall-container");
  stallContainer.innerHTML = "";

  // Get current user ID
  const userId = firebase.auth().currentUser.uid;
  console.log("Current user ID:", userId);

  // Fetch student user document
  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    console.log("User doc does not exist");
    return;
  }

  // Assume registeredStalls is an array of stall IDs in the user document
  const registeredStalls = userDoc.data().registeredStalls || [];
  console.log("Registered stalls:", registeredStalls);

  if (registeredStalls.length === 0) {
    stallContainer.innerHTML = "<p>No registered stalls found.</p>";
    return;
  }

  // Fetch all stall details in parallel
  const stallPromises = registeredStalls.map(stallId =>
    db.collection("stalls").doc(stallId).get()
  );
  const stallDocs = await Promise.all(stallPromises);

  // Render each registered stall
  stallDocs.forEach(stallDoc => {
    if (!stallDoc.exists) {
      console.log("Stall doc does not exist for ID:", stallDoc.id);
      return;
    }
    const stallData = stallDoc.data();
    const stallDiv = document.createElement("div");
    stallDiv.className = "stall";

    // Disable logic and design
    if (!stallData.isOpen) {
      stallDiv.classList.add("stall-disabled");
      stallDiv.title = "Stall is closed";
    } else {
      stallDiv.onclick = () => {
        window.location.href = `Food_Selection_Index.html?stallId=${stallDoc.id}`;
      };
    }

    stallDiv.innerHTML = `
      <img src="${stallData.imageUrl}" alt="${stallData.name}" />
      <div>
        <strong>${stallData.name}</strong>
        <div>Phone Number - ${stallData.phone || ''}</div>
        ${!stallData.isOpen ? '<div class="closed-label">Closed</div>' : ''}
      </div>
    `;
    stallContainer.appendChild(stallDiv);
  });
}

// On page load, after Firebase Auth is ready
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

async function updateCartButtonState() {
  const userId = firebase.auth().currentUser?.uid;
  if (!userId) {
    console.error("Error: User is not authenticated.");
    return;
  }

  const cartSnapshot = await db.collection("cart")
    .where("userId", "==", userId)
    .where("quantity", ">", 0)
    .get();

  const cartButton = document.getElementById("cartButton");
  if (!cartButton) {
    console.error("Error: cartButton element not found.");
    return;
  }

  if (cartSnapshot.empty) {
    // Disable the cart button and reduce brightness
    cartButton.style.filter = "opacity(50%)";
    cartButton.style.cursor = "not-allowed";
    cartButton.disabled = true;
  } else {
    // Enable the cart button and reset brightness
    cartButton.style.filter = "opacity(100%)";
    cartButton.style.cursor = "pointer";
    cartButton.disabled = false;
  }
}