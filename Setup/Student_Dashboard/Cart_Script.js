document.addEventListener('DOMContentLoaded', function() {
  const urlParams = new URLSearchParams(window.location.search);
  const stallId = urlParams.get("stallId");

  let localCart = {};

  document.getElementById("backBtn").addEventListener("click", async () => {
    await saveCartToFirestore();
    window.location.href = `Food_Selection_Index.html?stallId=${stallId}`;
  });

  document.getElementById('addItemsBtn').addEventListener('click', async () => {
    await saveCartToFirestore();
    window.location.href = `Food_Selection_Index.html?stallId=${stallId}`;
  });

  document.getElementById("paymentBtn").addEventListener("click", async () => {
    await saveCartToFirestore();
    window.location.href = `Payment_Selection_Index.html?stallId=${stallId}`;
  });

  function updateCartSummary() {
    let subtotal = 0;
    Object.values(localCart).forEach(item => {
      subtotal += item.price * item.quantity;
    });
    document.getElementById('subtotalAmount').textContent = `RM${subtotal.toFixed(2)}`;
    document.getElementById('totalAmount').textContent = `RM${subtotal.toFixed(2)}`;
  }

  function renderCartItems() {
    const cartItemsList = document.getElementById('cartItemsList');
    cartItemsList.innerHTML = '';
    const sortedItems = Object.values(localCart).sort((a, b) => {
      if (a.category < b.category) return -1;
      if (a.category > b.category) return 1;
      return 0;
    });

    sortedItems.forEach((item, index) => {
      const itemTotal = item.price * item.quantity;
      const cartItem = document.createElement('div');
      cartItem.className = 'cart-item';
      cartItem.id = `cart-item-${item.foodId}`;
      cartItem.innerHTML = `
        <div class="item-number">${index + 1}.</div>
        ${item.imageUrl ? `<img src="${item.imageUrl}" alt="${item.name}" class="cart-item-image" />` : ''}
        <div class="item-details">
          <h4>${item.name}</h4>
        </div>
        <div class="quantity-controls">
          <button class="qty-btn" data-foodid="${item.foodId}" data-action="decrement">-</button>
          <span data-price="${item.price}">${item.quantity}</span>
          <button class="qty-btn" data-foodid="${item.foodId}" data-action="increment">+</button>
        </div>
        <div class="item-total">RM${itemTotal.toFixed(2)}</div>
      `;
      cartItemsList.appendChild(cartItem);
    });

    updateCartSummary();
    attachQtyButtonListeners();

    // Redirect if cart is empty
    if (Object.keys(localCart).length === 0) {
      // Show notice
      cartItemsList.innerHTML = `<div class="empty-cart-notice">Cart is empty. Redirecting to menu...</div>`;
      setTimeout(() => {
        window.location.href = `Food_Selection_Index.html?stallId=${stallId}`;
      }, 1500); // 1.5 seconds delay
    }
  }

  function attachQtyButtonListeners() {
    document.querySelectorAll('.qty-btn').forEach(btn => {
      btn.onclick = async function() {
        const foodId = btn.getAttribute('data-foodid');
        const action = btn.getAttribute('data-action');
        if (!localCart[foodId]) return;
        if (action === 'increment') {
          localCart[foodId].quantity += 1;
        } else if (action === 'decrement') {
          localCart[foodId].quantity -= 1;
          if (localCart[foodId].quantity <= 0) {
            delete localCart[foodId];
          }
        }
        renderCartItems();
        await saveCartToFirestore(); // Save after every change
      };
    });
  }

  async function loadCartItems() {
    try {
      const user = firebase.auth().currentUser;
      if (!user || !stallId) return;
      const cartSnapshot = await db.collection('cart')
        .where('userId', '==', user.uid)
        .where('stallId', '==', stallId)
        .get();

      localCart = {};
      cartSnapshot.docs.forEach(doc => {
        const item = doc.data();
        if (item.quantity > 0) {
          localCart[item.foodId] = { ...item };
        }
      });

      renderCartItems();
    } catch (err) {
      console.error('Error loading cart items from Firestore:', err);
    }
  }

  async function saveCartToFirestore() {
    try {
      const user = firebase.auth().currentUser;
      if (!user || !stallId) return;
      const batch = db.batch();

      const cartRef = db.collection('cart');
      const prevCart = await cartRef
        .where('userId', '==', user.uid)
        .where('stallId', '==', stallId)
        .get();
      prevCart.forEach(doc => batch.delete(doc.ref));

      Object.values(localCart).forEach(item => {
        const docId = `${user.uid}_${stallId}_${item.foodId}`;
        const docRef = cartRef.doc(docId);
        batch.set(docRef, {
          ...item,
          userId: user.uid,
          stallId: stallId,
        });
      });

      await batch.commit();
    } catch (err) {
      console.error('Error saving cart to Firestore:', err);
    }
  }

  // Fetch and set stall name
  async function setStallName() {
    if (stallId) {
      const stallDoc = await db.collection("stalls").doc(stallId).get();
      if (stallDoc.exists) {
        document.getElementById("stallName").textContent = stallDoc.data().name;
      } else {
        document.getElementById("stallName").textContent = "Stall";
      }
    } else {
      document.getElementById("stallName").textContent = "Stall";
    }
  }

  firebase.auth().onAuthStateChanged(user => {
    if (user) {
      loadCartItems();
    }
  });

  // Call this after DOMContentLoaded
  setStallName();
});