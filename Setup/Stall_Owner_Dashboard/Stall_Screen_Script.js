// Get stallId from URL
const urlParams = new URLSearchParams(window.location.search);
const stallId = urlParams.get("stallId");

document.addEventListener("DOMContentLoaded", async () => {
  if (!stallId) return;

  const stallDoc = await db.collection("stalls").doc(stallId).get();
  if (stallDoc.exists) {
    const data = stallDoc.data();
    document.getElementById("stallName").textContent = data.name || "Stall Name";
    document.getElementById("stallImage").src = data.imageUrl || "";
    document.getElementById("nickname").textContent = data.nickname || "Nickname";

    // Fetch owner name from users collection
    if (data.ownerId) {
      const ownerDoc = await db.collection("users").doc(data.ownerId).get();
      if (ownerDoc.exists) {
        document.getElementById("ownerName").textContent = ownerDoc.data().name;
      } else {
        document.getElementById("ownerName").textContent = "Owner not found";
      }
    } else {
      document.getElementById("ownerName").textContent = "No owner";
    }

    const stallOpenCheckbox = document.getElementById("stallOpenCheckbox");
    const stallStatusLabel = document.getElementById("stallStatusLabel");

    // Use the already fetched stallDoc
    const isOpen = data.isOpen ?? false;
    stallOpenCheckbox.checked = isOpen;
    stallStatusLabel.textContent = isOpen ? "Open" : "Closed";
    stallStatusLabel.style.color = isOpen ? "#4caf50" : "#d32f2f";

    // Update status on toggle
    stallOpenCheckbox.addEventListener("change", async () => {
      const isOpen = stallOpenCheckbox.checked;
      stallStatusLabel.textContent = isOpen ? "Open" : "Closed";
      stallStatusLabel.style.color = isOpen ? "#4caf50" : "#d32f2f";
      await db.collection("stalls").doc(stallId).update({ isOpen });
    });
  } else {
    alert("Stall not found!");
    window.history.back();
  }
});

// Profile Maintenance button
document.getElementById("profileButton").addEventListener("click", () => {
  window.location.href = `Profile_Maintenance_Index.html?stallId=${stallId}`;
});

// Order List button
document.getElementById("orderListButton").addEventListener("click", () => {
  window.location.href = `Order_List_Index.html?stallId=${stallId}`;
});

// Food Management button
document.getElementById("foodManagementButton").addEventListener("click", () => {
  window.location.href = `Food_Menu_Index.html?stallId=${stallId}`;
});

// Payment Method button
document.getElementById("paymentMethodButton").addEventListener("click", () => {
  window.location.href = `Payment_Method_Index.html?stallId=${stallId}`;
});

// Logout button
document.getElementById("logoutButton").addEventListener("click", async () => {
  const user = firebase.auth().currentUser;
  if (user && stallId) {
    // Delete all cart items for this user and stall
    const cartRef = db.collection('cart');
    const cartSnapshot = await cartRef
      .where('userId', '==', user.uid)
      .where('stallId', '==', stallId)
      .get();

    console.log("Cart items found:", cartSnapshot.size); // <-- Add this line

    if (!cartSnapshot.empty) {
      const batch = db.batch();
      cartSnapshot.forEach(doc => {
        console.log("Deleting cart doc:", doc.id); // <-- Add this line
        batch.delete(doc.ref);
      });
      await batch.commit();
      console.log("Batch delete committed.");
    } else {
      console.log("No cart items to delete.");
    }
  }
  // Set basket count to 0 if element exists
  const basketCountElem = document.getElementById('itemCount');
  if (basketCountElem) {
    basketCountElem.textContent = '0';
  }

  // Clear cart index/list in DOM if exists
  const cartIndexElem = document.getElementById('cartItemsList');
  if (cartIndexElem) {
    cartIndexElem.innerHTML = '';
  }
  await firebase.auth().signOut();
  window.location.href = "../Login_or_Register/loginanim.html";
});

firebase.auth().onAuthStateChanged(user => {
  if (!user) {
    window.location.href = "../Login_or_Register/loginanim.html";
  }
  console.log("user.uid:", user.uid);
  console.log("stallId:", stallId);
});