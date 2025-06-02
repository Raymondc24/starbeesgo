// Global state
let allFoods = [];
let cart = {};
let sortOption = 'name';
let sortDirection = 'asc';
let currentUserId = null;
let userClickedDropdown = false; // Add this new flag

// DOM references
const categoryDropdown = document.getElementById('categoryDropdown');
const sortDropdown = document.getElementById('sortDropdown');
const sortArrow = document.getElementById('sortArrow');
const menuItems = document.getElementById('menuItems');
const itemCount = document.getElementById('itemCount');
const totalPrice = document.getElementById('totalPrice');

const urlParams = new URLSearchParams(window.location.search);
const stallId = urlParams.get("stallId");

// Get current user
firebase.auth().onAuthStateChanged(async user => {
  if (user) {
    currentUserId = user.uid;
    await loadCartFromFirestore(); // Load cart data after user is set
    loadFoods();

    // Attach event listeners here if needed
    categoryDropdown.addEventListener('change', () => {
      userClickedDropdown = true; // Set flag on manual dropdown change
      scrollToCategory(categoryDropdown.value);
      // Reset the flag after a delay to allow smooth scroll to proceed
      // without the observer immediately overriding the dropdown.
      setTimeout(() => {
        userClickedDropdown = false;
      }, 800); // Adjust this delay if needed (e.g., based on smooth scroll duration)
    });

    sortDropdown.addEventListener('change', () => {
      setSortOption(sortDropdown.value);
      renderFoods();
    });

    document.getElementById('searchInput').addEventListener('input', renderFoods);
    document.getElementById('sortArrow').addEventListener('click', toggleSortDirection);
  }
});

// Load cart from Firestore (for this user and stall)
async function loadCartFromFirestore() {
  try {
    if (!currentUserId || !stallId) return;
    const cartSnapshot = await db.collection('cart')
      .where('userId', '==', currentUserId)
      .where('stallId', '==', stallId)
      .get();
    cart = {};
    cartSnapshot.forEach(doc => {
      const item = doc.data();
      // Use item.foodId as the key, not doc.id!
      cart[item.foodId] = {
        qty: item.quantity,
        price: item.price,
        name: item.name,
        imageUrl: item.imageUrl || '',
        category: item.category || '' // <-- Add this line
      };
    });
    updateCartSummary();
  } catch (err) {
    console.error('Error loading cart from Firestore:', err);
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

// On DOM load
document.addEventListener('DOMContentLoaded', async () => {
  await updateBasketQuantity(); // Update basket quantity on page load
  setStallName();
});

// Load from Firestore
async function loadFoods() {
  try {
    const snapshot = await db.collection('foods').where('stallId', '==', stallId).get();
    allFoods = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    updateCategoryDropdown();
    renderFoods();
    updateCartSummary();
  } catch (err) {
    console.error('Error loading foods:', err);
  }
}

// Update category dropdown
function updateCategoryDropdown() {
  const categories = Array.from(new Set(allFoods.map(f => f.category))).sort(); // Sort categories alphabetically
  categoryDropdown.innerHTML = '';
  categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    categoryDropdown.appendChild(opt);
  });
}

// Scroll to category
function scrollToCategory(category) {
  const section = document.getElementById(`section-${category}`);
  if (!section) return;

  const heading = section.querySelector('h2'); // Get the category heading
  if (heading) {
    const offset = heading.getBoundingClientRect().top + window.scrollY - 200; // Adjust offset to align with the heading
    window.scrollTo({ top: offset, behavior: 'smooth' });
  }
}

// Render food list
function renderFoods() {
  const searchQuery = document.getElementById('searchInput').value.toLowerCase();
  const grouped = {};

  // Group foods by category
  allFoods.forEach(food => {
    if (!food.name.toLowerCase().includes(searchQuery)) return;
    if (!grouped[food.category]) grouped[food.category] = [];
    grouped[food.category].push(food);
  });

  // Sort categories alphabetically
  const sortedCategories = Object.keys(grouped).sort();

  menuItems.innerHTML = '';

  // Render each category in sorted order
  sortedCategories.forEach(category => {
    const foods = grouped[category];
    const section = document.createElement('section');
    section.id = `section-${category}`;
    section.setAttribute('data-category', category);

    // Only display the heading if there are visible items in the category
    if (foods.length > 0) {
      section.innerHTML = `<h2>${category.charAt(0).toUpperCase() + category.slice(1)}</h2><div class="food-row"></div>`;
    } else {
      section.innerHTML = ''; // Remove the heading completely if no items are visible
    }

    const row = section.querySelector('.food-row');

    // Sort foods within the category if needed
    const sortedFoods = sortFoods(foods);
    sortedFoods.forEach(food => {
      const itemQty = cart[food.id]?.qty || 0;
      const div = document.createElement('div');
      div.className = 'menu-item' + (food.available ? '' : ' sold-out');

      const imgTag = food.img ? `<img src="${food.img}" alt="${food.name}">` : '';

      div.innerHTML = `
        ${imgTag}
        <div class="details">
          <h3>${food.name}</h3>
          <p class="price">RM${food.price.toFixed(2)}</p>
          ${!food.available ? '<p class="sold-label">Sold Out</p>' : ''}
        </div>
        <div class="quantity-select">
          <button ${food.available ? '' : 'disabled'} onclick="updateCart('${food.id}', -1, ${food.price})">-</button>
          <span>${itemQty}</span>
          <button ${food.available ? '' : 'disabled'} onclick="updateCart('${food.id}', 1, ${food.price})">+</button>
        </div>
      `;
      row.appendChild(div);
    });

    // Append the section only if it has visible items
    if (foods.length > 0) {
      menuItems.appendChild(section);
    }
  });

  // Re-attach IntersectionObserver
  sectionObserver.disconnect();
  attachObserver();
}

// Sorting logic
function sortFoods(foods) {
  return foods.sort((a, b) => {
    if (sortOption === 'availability') {
      if (a.available !== b.available) {
        return sortDirection === 'asc'
          ? (a.available ? -1 : 1)
          : (a.available ? 1 : -1);
      }
      const catCompare = a.category.localeCompare(b.category);
      if (catCompare !== 0) return catCompare;
      return a.name.localeCompare(b.name);
    }

    let valA = a[sortOption];
    let valB = b[sortOption];

    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
    }

    const result = valA > valB ? 1 : valA < valB ? -1 : 0;
    return sortDirection === 'asc' ? result : -result;
  });
}

// Save cart to Firestore (for this user and stall)
async function saveCartToFirestore() {
  try {
    if (!currentUserId || !stallId) return;
    const cartRef = db.collection('cart');
    const batch = db.batch();

    // Remove only this user's cart for this stall
    const existingCart = await cartRef
      .where('userId', '==', currentUserId)
      .where('stallId', '==', stallId)
      .get();
    existingCart.forEach(doc => batch.delete(doc.ref));

    // Add updated cart items
    Object.keys(cart).forEach(foodId => {
      const item = cart[foodId];
      const foodItem = allFoods.find(f => f.id === foodId);
      const docRef = cartRef.doc(); // Use auto-ID or `${currentUserId}_${stallId}_${foodId}`
      batch.set(docRef, {
        userId: currentUserId,
        stallId: stallId,
        foodId: foodId,
        name: item.name,
        price: item.price,
        quantity: item.qty,
        imageUrl: foodItem?.img || '',
        category: foodItem?.category || '' // <-- Add this line to save category
      });
    });

    await batch.commit();
    console.log('Cart saved to Firestore');
  } catch (err) {
    console.error('Error saving cart to Firestore:', err);
  }
}

// Cart interaction
function updateCart(foodId, change, price) {
  if (!cart[foodId]) cart[foodId] = { qty: 0, price, name: allFoods.find(f => f.id === foodId).name };
  cart[foodId].qty += change;
  if (cart[foodId].qty <= 0) delete cart[foodId];
  saveCartToFirestore(); // Save cart to Firestore
  renderFoods();
  updateCartSummary(); // Only this, remove updateBasketQuantity()
}

// Cart summary
function updateCartSummary() {
  let totalQty = 0;
  let totalRM = 0;

  Object.values(cart).forEach(item => {
    totalQty += item.qty;
    totalRM += item.qty * item.price;
  });

  itemCount.textContent = totalQty;
  totalPrice.textContent = 'RM' + totalRM.toFixed(2);

  // Enable or disable the basket button based on cart state
  const cartButton = document.getElementById('cartButton');
  if (totalQty === 0) {
    cartButton.disabled = true;
    cartButton.style.backgroundColor = 'lightgreen';
  } else {
    cartButton.disabled = false;
    cartButton.style.backgroundColor = '';
  }
}

// Sorting controls
function setSortOption(option) {
  sortOption = option;
  sortDirection = 'asc';
  sortArrow.textContent = '↑';
}

function toggleSortDirection() {
  sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
  sortArrow.textContent = sortDirection === 'asc' ? '↑' : '↓';
  renderFoods();
}

// Category detection on scroll
const observerOptions = {
  root: null,
  rootMargin: '-25% 0px -75% 0px', // Ensure the heading is centered in the viewport
  threshold: 0
};

let currentlyVisibleCategory = null;

const sectionObserver = new IntersectionObserver((entries) => {
  if (userClickedDropdown) {
    // If the scroll was initiated by a user's click on the dropdown,
    // do not let the observer change the dropdown value during this specific scroll.
    // The dropdown already reflects the user's intended selection.
    return;
  }

  let topMostEntry = null;

  entries.forEach(entry => {
    if (entry.isIntersecting) {
      // Find the top-most visible section
      if (!topMostEntry || entry.boundingClientRect.top < topMostEntry.boundingClientRect.top) {
        topMostEntry = entry;
      }
    }
  });

  if (topMostEntry) {
    const newCategory = topMostEntry.target.getAttribute('data-category');

    // Update the dropdown only when the category changes
    if (currentlyVisibleCategory !== newCategory) {
      currentlyVisibleCategory = newCategory;
      // Only update the dropdown's value if it's actually different
      // to prevent triggering an unnecessary 'change' event.
      if (categoryDropdown.value !== newCategory) {
        categoryDropdown.value = newCategory;
      }
      // console.log(`Category changed to: ${newCategory}`); // Debugging
    }
  }
}, observerOptions);

// Attach the observer to all category sections
function attachObserver() {
  document.querySelectorAll('section[data-category]').forEach(section => { // Ensure observing sections with data-category
    sectionObserver.observe(section);
  });
}

// REMOVE or COMMENT OUT the following lines:
// This block incorrectly tries to observe h2 elements with an observer
// that expects data-category on the target element itself.
/*
// Attach the observer to all category headings
document.querySelectorAll('section').forEach(section => {
  sectionObserver.observe(section.querySelector('h2'));
});
*/

// Basket button action
document.getElementById('cartButton').addEventListener('click', async () => {
  if (currentUserId && stallId) {
    await saveCartToFirestore(); // Save cart to Firestore
    window.location.href = `Cart_Index.html?userId=${currentUserId}&stallId=${stallId}`;
  } else {
    console.error('User ID or Stall ID is not set.');
  }
});

document.getElementById('backBtn').addEventListener('click', () => {
  if (currentUserId) {
    window.location.href = `Stall_Selection_Index.html?userId=${currentUserId}`;
  } else {
    console.error('User ID is not set.');
  }
});

// Example: update basket quantity on Food Selection page
async function updateBasketQuantity() {
  const user = firebase.auth().currentUser;
  if (!user || !stallId) return;
  const cartSnapshot = await db.collection('cart')
    .where('userId', '==', user.uid)
    .where('stallId', '==', stallId)
    .get();

  let totalQty = 0;
  cartSnapshot.docs.forEach(doc => {
    const item = doc.data();
    totalQty += item.quantity;
  });

  document.getElementById('itemCount').textContent = totalQty; // Make sure you have an element with this ID
}

// Call updateBasketQuantity() after any cart change and on page load

window.addEventListener('pageshow', async (event) => {
  // Wait until currentUserId is set
  if (!currentUserId) {
    await new Promise(resolve => {
      const unsubscribe = firebase.auth().onAuthStateChanged(user => {
        if (user) {
          currentUserId = user.uid;
          unsubscribe();
          resolve();
        }
      });
    });
  }
  await loadCartFromFirestore();
  renderFoods();         // <-- Add this line!
  updateCartSummary();
});
